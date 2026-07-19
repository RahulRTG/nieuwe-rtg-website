/* Leden-deel "annuleren" (kern/ervaring/leden): annuleren door het lid en de
   wachtlijst. Ze horen bij elkaar: bij een geannuleerde plek (ticket, event)
   krijgt de eerste op de wachtlijst meteen bericht (meldWachtlijst). Verbatim
   afgesplitst uit leden.js. */
module.exports = (ctx) => {
  const { db, save, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, sseToCustomer,
    ticketsVoorSlot, orderMetRef, boekingMetRef, id, nu } = ctx;

  /* ---- 2. annuleren door het lid ----
     Terugbetaalregels: een betaalde annulering spiegelt de refund-flow van de
     zaak (paid=false, refunded=true). Orders kunnen tot de bereiding begint;
     ritten tot er een chauffeur op zit; tickets tot 24 uur voor het tijdslot;
     overige boekingen zolang ze niet afgerond zijn. */
  function annuleerItem(sess, soort, ref) {
    const key = sess.key;
    if (soort === 'order') {
      const o = orderMetRef(ref);
      if (!o || (o.customerKey || o.customerTier) !== key) return { status: 404, error: 'Bestelling niet gevonden.' };
      if (!['wacht-op-betaling', 'nieuw'].includes(o.status)) return { status: 409, error: 'Deze bestelling is al in behandeling (' + o.status + ') en kan niet meer geannuleerd worden.' };
      const wasBetaald = o.paid;
      if (o.paid) { o.paid = false; o.refunded = true; o.refundedAt = nu(); }
      o.status = wasBetaald ? 'terugbetaald' : 'geweigerd';
      o.geannuleerdDoor = 'lid';
      save();
      if (wasBetaald || o.status !== 'wacht-op-betaling') {
        notifySupplier(o.supplierCode, { icon: '↩️', title: 'Bestelling geannuleerd', body: o.customerCodename + ' annuleerde ' + o.ref + (wasBetaald ? ' (€ ' + o.total + ' retour)' : '') });
        sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
      }
      sseToOffice('sync', { scope: 'orders' });
      return { ok: true, terugbetaald: wasBetaald ? o.total : 0 };
    }
    if (soort === 'ride') {
      const r = db.data.rides.find(x => x.ref === ref && (x.customerKey || x.customerTier) === key);
      if (!r) return { status: 404, error: 'Rit niet gevonden.' };
      if (!['wacht-op-betaling', 'aangevraagd'].includes(r.status) || r.driver)
        return { status: 409, error: 'Deze rit is al toegewezen en kan niet meer geannuleerd worden. Bel de vervoerder.' };
      const wasBetaald = r.paid && r.quote > 0;
      if (wasBetaald) { r.paid = false; r.refunded = true; r.refundedAt = nu(); }
      r.status = 'geweigerd';
      r.geannuleerdDoor = 'lid';
      save();
      notifySupplier(r.supplierCode, { icon: '↩️', title: 'Rit geannuleerd', body: r.customerCodename + ' annuleerde ' + r.ref + (wasBetaald ? ' (€ ' + r.quote + ' retour)' : '') });
      sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' });
      sseToOffice('sync', { scope: 'orders' });
      return { ok: true, terugbetaald: wasBetaald ? r.quote : 0 };
    }
    if (soort === 'boeking') {
      const b = (x => x && (x.customerKey || x.customerTier) === key ? x : undefined)(boekingMetRef(ref));
      if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
      if (['afgerond', 'geweigerd'].includes(b.status)) return { status: 409, error: 'Deze boeking is al ' + b.status + '.' };
      if (b.kind === 'ticket') {
        const slotIso = b.datum + 'T' + (b.tijd || '23:59') + ':00';
        if (new Date(slotIso) - Date.now() < 24 * 3600000)
          return { status: 409, error: 'Tickets annuleert u tot 24 uur voor het tijdslot.' };
      }
      const wasBetaald = b.paid && (b.price || 0) > 0;
      if (wasBetaald) { b.paid = false; b.refunded = true; b.refundedAt = nu(); }
      b.status = 'geweigerd';
      b.geannuleerdDoor = 'lid';
      save();
      notifySupplier(b.supplierCode, { icon: '↩️', title: (b.kind === 'ticket' ? 'Ticket' : 'Boeking') + ' geannuleerd', body: b.customerCodename + ' annuleerde ' + b.ref + (wasBetaald ? ' (€ ' + b.price + ' retour)' : '') });
      sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
      sseToOffice('sync', { scope: 'orders' });
      // vrijgekomen plek: de eerste op de wachtlijst hoort het meteen
      if (b.kind === 'ticket') meldWachtlijst('slot:' + b.supplierCode + ':' + b.activiteitId + ':' + b.datum + ':' + b.tijd);
      return { ok: true, terugbetaald: wasBetaald ? b.price : 0 };
    }
    return { status: 400, error: 'Onbekend soort (order, ride of boeking).' };
  }

  /* ---- 8. wachtlijst ----
     Bij een vol event of tijdslot. Komt er een plek vrij (annulering), dan
     hoort de eerste op de lijst het meteen. */
  function zetOpWachtlijst(sess, codename, body) {
    const s = findSupplier(body.supplierCode);
    if (!s) return { status: 404, error: 'Partner niet gevonden.' };
    let doel = null, omschrijving = null;
    if (body.eventId != null) {
      const e = (s.events || []).find(x => x.id === body.eventId && x.published);
      if (!e) return { status: 404, error: 'Event niet gevonden.' };
      const bezet = (e.guests || []).reduce((n, g) => n + g.qty, 0);
      if (bezet < e.capacity) return { status: 409, error: 'Er is nog plek: meld u gewoon aan.' };
      doel = 'event:' + s.code + ':' + e.id;
      omschrijving = e.name + ' bij ' + s.name + ' (' + e.date + ')';
    } else if (body.activiteitId != null) {
      const act = (s.activiteiten || []).find(a => a.id === body.activiteitId);
      const datum = String(body.datum || ''), tijd = String(body.tijd || '');
      if (!act || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || !(act.tijden || []).includes(tijd)) return { status: 404, error: 'Tijdslot niet gevonden.' };
      const bezet = ticketsVoorSlot(s.code, act.id, datum, tijd).reduce((n, t) => n + (t.personen || 1), 0);
      if (bezet < act.capaciteit) return { status: 409, error: 'Er is nog plek in dit tijdslot: boek gewoon een ticket.' };
      doel = 'slot:' + s.code + ':' + act.id + ':' + datum + ':' + tijd;
      omschrijving = act.naam + ' bij ' + s.name + ' (' + datum + ' ' + tijd + ')';
    } else return { status: 400, error: 'Geef een event of tijdslot op.' };
    const lijst = db.data.wachtlijsten;
    if (lijst.some(w => w.doel === doel && w.key === sess.key)) return { status: 409, error: 'U staat al op deze wachtlijst.' };
    lijst.push({ id: id(), doel, supplierCode: s.code, omschrijving, key: sess.key, codename, at: nu() });
    db.data.wachtlijsten = lijst.slice(-20000);
    save();
    const positie = lijst.filter(w => w.doel === doel).length;
    return { ok: true, positie, omschrijving };
  }
  function mijnWachtlijst(key) {
    return (db.data.wachtlijsten || []).filter(w => w.key === key)
      .map(w => ({ id: w.id, omschrijving: w.omschrijving, at: w.at, positie: db.data.wachtlijsten.filter(x => x.doel === w.doel && x.at <= w.at).length }));
  }
  // een plek is vrijgekomen: de eerste op de lijst krijgt bericht en valt eraf
  function meldWachtlijst(doel) {
    const i = (db.data.wachtlijsten || []).findIndex(w => w.doel === doel);
    if (i < 0) return null;
    const [w] = db.data.wachtlijsten.splice(i, 1);
    save();
    notify(w.key, { icon: '🎉', title: 'Er is een plek vrij!', body: 'Er kwam een plek vrij voor ' + w.omschrijving + '. Wees er snel bij: de plek is niet gereserveerd.', scope: 'wachtlijst' });
    sseToCustomer(w.key, 'sync', { scope: 'wachtlijst' });
    return w;
  }
  // aanmelding voor een event intrekken (maakt de plek vrij voor de wachtlijst)
  function rsvpAnnuleer(key, supplierCode, eventId) {
    const s = findSupplier(supplierCode);
    const e = s && (s.events || []).find(x => x.id === eventId);
    if (!e) return { status: 404, error: 'Event niet gevonden.' };
    const i = (e.guests || []).findIndex(g => g.key === key);
    if (i < 0) return { status: 404, error: 'U staat niet op deze gastenlijst.' };
    const [g] = e.guests.splice(i, 1);
    save();
    notifySupplier(s.code, { icon: '🎟', title: 'Afmelding voor ' + e.name, body: g.codename + ', ' + g.qty + ' pers.' });
    sseToSupplier(s.code, 'sync', { scope: 'events' });
    meldWachtlijst('event:' + s.code + ':' + e.id);
    return { ok: true };
  }

  return { annuleerItem, zetOpWachtlijst, mijnWachtlijst, meldWachtlijst, rsvpAnnuleer };
};
