/* Ervaring-deel "tafels" (kern/ervaring): tafelreserveringen en de
   tafelplanning - van losse aanvragen naar een gedekte avond, met walk-ins
   en komst-meldingen. Verbatim afgesplitst uit kern/ervaring.js. */
const beleid = require('../reservering/beleid');

module.exports = (ctx) => {
  const { db, save, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, zijnVrienden, ticketsVoorSlot, optieAan,
    orderMetRef, boekingMetRef, boekingenVanKlant, id, nu, vandaag, rond, MELDING_SCOPES } = ctx;

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
    save();
    notifySupplier(s.code, { icon: '🪑', title: 'Nieuwe reservering', body: codename + ': ' + datum + ' ' + tijd + ', ' + personen + 'p' + (r.notitie ? ' · ' + r.notitie : '') + (r.perDirect ? ' · per direct' : r.lastMinute ? ' · last-minute' : ' · in bedenktijd') });
    sseToSupplier(s.code, 'sync', { scope: 'reserveringen' });
    sseToOffice('sync', { scope: 'orders' });
    return { ok: true, reservering: r };
  }
  function mijnReserveringen(key) {
    const mijn = (db.data.reserveringen || []).filter(r => r.customerKey === key);
    rijpMaak(mijn);
    return mijn.slice(0, 25);
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
    notifySupplier(r.supplierCode, { icon: '🪑', title: 'Reservering geannuleerd', body: r.customerCodename + ': ' + r.datum + ' ' + r.tijd + ', ' + r.personen + 'p' });
    sseToSupplier(r.supplierCode, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r, boeteCenten };
  }
  // de zaak beslist (elke medewerker, op eigen naam)
  function beslisReservering(supplier, rid, action) {
    const r = (db.data.reserveringen || []).find(x => x.id === rid && x.supplierCode === supplier.code);
    if (!r) return { status: 404, error: 'Reservering niet gevonden.' };
    if (r.status !== 'aangevraagd') return { status: 409, error: 'Deze reservering is al ' + r.status + '.' };
    r.status = action === 'bevestig' ? 'bevestigd' : 'geweigerd';
    save();
    const tekst = r.status === 'bevestigd'
      ? 'Uw tafel bij ' + supplier.name + ' op ' + r.datum + ' om ' + r.tijd + ' (' + r.personen + 'p) is bevestigd.'
      : supplier.name + ' kan uw reservering voor ' + r.datum + ' ' + r.tijd + ' helaas niet plaatsen.';
    notify(r.customerKey, { icon: '🪑', title: supplier.name, body: tekst, scope: 'orders' });
    sseToCustomer(r.customerKey, 'sync', { scope: 'reserveringen' });
    return { ok: true, reservering: r };
  }

  /* ---- 1b. de tafelplanning: van losse aanvragen naar een gedekte avond ----
     De toewijzing, de komst-meldingen en de walk-in draaien als submodule op
     dezelfde context (plus de gedeelde rijpMaak-sweep); zie
     ervaring/tafelplanning.js. */
  const { tafelplanning, reserveringTafel, reserveringKomst, walkIn } = require('./tafelplanning')(ctx, { rijpMaak });

  return { reserveerTafel, mijnReserveringen, annuleerReservering, beslisReservering,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn };
};
