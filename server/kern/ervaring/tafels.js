/* Ervaring-deel "tafels" (kern/ervaring): tafelreserveringen en de
   tafelplanning - van losse aanvragen naar een gedekte avond, met walk-ins
   en komst-meldingen. Verbatim afgesplitst uit kern/ervaring.js. */
const beleid = require('../reservering/beleid');
const capaciteit = require('../reservering/capaciteit');

module.exports = (ctx) => {
  const { db, save, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, zijnVrienden, ticketsVoorSlot, optieAan,
    orderMetRef, boekingMetRef, boekingenVanKlant, id, nu, vandaag, rond, MELDING_SCOPES, trustPlane,
    bewijsHospitalityBesluit } = ctx;

  function observe(invoer) {
    if (!trustPlane || typeof trustPlane.observe !== 'function') return null;
    try { return trustPlane.observe(invoer); } catch (e) { return null; }
  }
  function metricTimer(invoer) {
    if (!trustPlane || typeof trustPlane.timer !== 'function') return null;
    try { return trustPlane.timer(invoer); } catch (e) { return null; }
  }
  function finish(timer, uitkomst) {
    if (!timer) return null;
    try { return timer.finish(uitkomst); } catch (e) { return null; }
  }
  const beslisReservering = require('./reservering-besluit')({ ...ctx, observe, metricTimer, finish });

  /* Lazy sweep: reserveringen waarvan de 24u-bedenktijd voorbij is worden
     definitief zodra iemand ze opvraagt. Eén keer opslaan als er iets rijpte. */
  function rijpMaak(lijst) {
    let veranderd = false;
    for (const r of lijst) if (beleid.rijp(r, nu())) veranderd = true;
    if (veranderd) save();
  }

  function reserveerTafel(sess, codename, body) {
    const s = findSupplier(body.supplierCode);
    if (!s) return { status: 404, error: 'Partner niet gevonden.' };
    if (!(s.tables || []).length) return { status: 409, error: s.name + ' werkt niet met tafelreserveringen.' };
    if (s.settings && s.settings.reservationsOpen === false) return { status: 409, error: s.name + ' neemt op dit moment geen reserveringen aan.' };
    const datum = String(body.datum || '');
    const tijd = String(body.tijd || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    if (!/^\d{2}:\d{2}$/.test(tijd)) return { status: 400, error: 'Kies een tijd (bijv. 20:00).' };
    const personen = Math.min(20, Math.max(1, parseInt(body.personen, 10) || 2));
    // dubbele aanvraag voor hetzelfde moment tegenhouden
    if ((db.data.reserveringen || []).some(r => r.customerKey === sess.key && r.supplierCode === s.code &&
      r.datum === datum && r.tijd === tijd && ['aangevraagd', 'bevestigd'].includes(r.status)))
      return { status: 409, error: 'U heeft hier al een reservering voor dit moment.' };
    // Beschikbaarheid opnieuw beoordelen bij uitvoering, niet alleen bij tonen.
    const capacityTimer = metricTimer({ capability: 'hospitality.availability.check',
      boundary: 'supplier:' + s.code });
    let beschikbaar;
    try {
      beschikbaar = capaciteit.past(s,db.data.reserveringen,datum,tijd,personen);
      finish(capacityTimer, { outcome: 'SUCCEEDED', domainOutcome: beschikbaar ? 'AVAILABLE' : 'FULL',
        measurementKey: body.idempotencyKey ? 'availability:' + body.idempotencyKey : null });
    } catch (e) {
      finish(capacityTimer, { outcome: 'FAILED', domainOutcome: 'CAPACITY_CHECK_FAILED',
        errorClass: e.code || 'CAPACITY_EXCEPTION' });
      throw e;
    }
    observe({ capability: 'hospitality.availability.check', boundary: 'supplier:' + s.code,
      subjectRef: { domain: 'hospitality', type: 'availability-window', id: s.code + ':' + datum + ':' + tijd },
      predicate: 'hospitality.capacity.available', value: { available: beschikbaar },
      evidence: { available: beschikbaar, requestedSeats: personen, source: 'reservation-capacity' },
      policy: { id: 'hospitality-policy', version: 1, decision: 'SHADOW' } });
    if (!beschikbaar)
      return {status:409,error:'Dit tijdstip is inmiddels vol. Kies een andere tijd.'};
    const bookingTimer = metricTimer({ capability: 'reservation.request', boundary: 'supplier:' + s.code });
    const r = {
      id: id(), supplierCode: s.code, supplierName: s.name,
      customerKey: sess.key, customerCodename: codename, tier: sess.tier,
      datum, tijd, personen, notitie: String(body.notitie || '').slice(0, 140),
      status: 'aangevraagd', at: nu()
    };
    // het gedeelde reserverings-beleid: 24u bedenktijd (of last-minute/per-direct),
    // en een eventuele aanbetaling die de zaak vraagt.
    const aanbetalingCenten = (s.settings && s.settings.aanbetalingCenten) || 0;
    Object.assign(r, beleid.beginToestand({ datum, tijd, perDirect: !!body.perDirect, aanbetalingCenten, nu: nu() }));
    db.data.reserveringen.unshift(r);
    db.data.reserveringen = db.data.reserveringen.slice(0, 20000);
    try { save(); }
    catch (e) {
      finish(bookingTimer, { outcome: 'FAILED', domainOutcome: 'REQUEST_NOT_PERSISTED',
        errorClass: e.code || 'STORAGE_EXCEPTION' });
      throw e;
    }
    finish(bookingTimer, { outcome: 'SUCCEEDED', domainOutcome: 'REQUESTED',
      measurementKey: 'reservation-requested:' + r.id });
    observe({ capability: 'reservation.request', boundary: 'supplier:' + s.code,
      subjectRef: { domain: 'hospitality', type: 'reservation', id: r.id },
      predicate: 'reservation.requested', value: { status: r.status },
      evidence: { status: r.status, supplierRef: s.code, date: datum, time: tijd, people: personen },
      policy: { id: 'hospitality-policy', version: 1, decision: 'SHADOW' } });
    notifySupplier(s.code, { icon: 'table', title: 'Nieuwe reservering', body: codename + ': ' + datum + ' ' + tijd + ', ' + personen + 'p' + (r.notitie ? ' · ' + r.notitie : '') + (r.perDirect ? ' · per direct' : r.lastMinute ? ' · last-minute' : ' · in bedenktijd') });
    sseToSupplier(s.code, 'sync', { scope: 'reserveringen' });
    sseToOffice('sync', { scope: 'orders' });
    return { ok: true, reservering: r };
  }
  function mijnReserveringen(key, limiet = 25) {
    const mijn = (db.data.reserveringen || []).filter(r => r.customerKey === key);
    rijpMaak(mijn);
    return mijn.slice(0, limiet);
  }
  function annuleerReservering(key, rid) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.customerKey === key);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (!['aangevraagd', 'bevestigd'].includes(r.status)) return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
    // per-direct oversloeg de bedenktijd: annuleren kost de kleine straf (de rest gratis)
    const boeteCenten = beleid.annuleerBoeteCenten(r);
    r.status = 'geannuleerd';
    if (boeteCenten) r.annuleerBoeteCenten = boeteCenten;
    save();
    notifySupplier(r.supplierCode, { icon: 'table', title: 'Reservering geannuleerd', body: r.customerCodename + ': ' + r.datum + ' ' + r.tijd + ', ' + r.personen + 'p' });
    sseToSupplier(r.supplierCode, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r, boeteCenten };
  }
  /* ---- 1b. de tafelplanning: van losse aanvragen naar een gedekte avond ----
     De toewijzing, de komst-meldingen en de walk-in draaien als submodule op
     dezelfde context (plus de gedeelde rijpMaak-sweep); zie
     ervaring/tafelplanning.js. */
  const { tafelplanning, reserveringTafel, reserveringKomst, walkIn } = require('./tafelplanning')(ctx, { rijpMaak });

  return { reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn };
};
