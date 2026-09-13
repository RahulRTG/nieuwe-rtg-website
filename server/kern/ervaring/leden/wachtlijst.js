/* Leden-deel "wachtlijst" (kern/ervaring/leden): op de lijst bij een vol event of
   tijdslot, en het bericht zodra er een plek vrijkomt.

   AFGESPLITST VAN ./annuleren.js OP 13 SEPTEMBER 2026, en niet omdat het mooier
   staat: dat bestand kwam op 10237 van de 10240 toegestane bytes (keuringsregel
   13) en had daarmee drie bytes speling -- elke volgende regel, ook een regel
   commentaar, had de keuring laten zakken.

   De naad stond al in de kop van dat bestand beschreven: het waren twee dingen
   die alleen samen stonden omdat een geannuleerde plek de eerste op de wachtlijst
   bericht. Die band blijft: ./annuleren.js roept meldWachtlijst() aan en krijgt
   hem hier vandaan. Er is dus GEEN gedrag veranderd -- de functies staan er
   verbatim, alleen in een eigen fabriek. */
module.exports = (ctx) => {
  /* Elke naam die dit bestand werkelijk gebruikt, en niet een naam meer. De
     eerste versie van de afsplitsing miste er vier (notifySupplier,
     sseToSupplier, sseToCustomer, ticketsVoorSlot) -- die zouden pas bij een
     echte annulering met een wachtlijst zijn opgevallen, als een ReferenceError
     midden in een geldpad. */
  const { db, save, findSupplier, notify, notifySupplier, sseToSupplier,
    sseToCustomer, ticketsVoorSlot, id, nu } = ctx;

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
    notify(w.key, { icon: 'ster', title: 'Er is een plek vrij!', body: 'Er kwam een plek vrij voor ' + w.omschrijving + '. Wees er snel bij: de plek is niet gereserveerd.', scope: 'wachtlijst' });
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
    notifySupplier(s.code, { icon: 'ticket', title: 'Afmelding voor ' + e.name, body: g.codename + ', ' + g.qty + ' pers.' });
    sseToSupplier(s.code, 'sync', { scope: 'events' });
    meldWachtlijst('event:' + s.code + ':' + e.id);
    return { ok: true };
  }

  return { zetOpWachtlijst, mijnWachtlijst, meldWachtlijst, rsvpAnnuleer };
};
