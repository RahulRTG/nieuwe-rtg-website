/* Overheids-PDA, deelbestand "vloer": de drie vloerrollen op elke locatie.
   Receptie meldt bezoekers aan met een badge en schrijft ze uit (op naam
   zoals de balie ze noteert, zonder koppeling aan de kluis), security loopt
   rondes en handelt incidenten af, en de schoonmaak vinkt de dagtaken per
   ruimte af en geeft extra werk door. Krijgt de subctx van ./index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, nu, id, schoon, P, loc, vandaag, zorgTaken, LOCATIES, INCIDENT_SOORTEN } = ctx;

  /* ---- receptie: bezoekers met een badge ---- */
  function pdaBezoekerIn(actor, l, data) {
    l = loc(l); data = data || {};
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const naam = schoon(data.naam, 60);
    if (naam.length < 2) return { status: 400, error: 'Wie meldt zich aan de balie?' };
    const b = { id: id(), locatie: l, naam, voor: schoon(data.voor, 80) || 'bezoek',
      badge: 'B-' + crypto.randomBytes(2).toString('hex').toUpperCase(), door: actor || 'receptie', at: nu(), uit: null };
    P().bezoekers.unshift(b);
    db.data.overheidPda.bezoekers = P().bezoekers.slice(0, 20000);
    save();
    return { ok: true, bezoeker: b };
  }
  function pdaBezoekerUit(actor, bid) {
    const b = P().bezoekers.find(x => x.id === String(bid || ''));
    if (!b) return { status: 404, error: 'Bezoeker niet gevonden.' };
    if (b.uit) return { status: 409, error: 'Deze bezoeker is al uitgeschreven.' };
    b.uit = nu(); b.uitDoor = actor || 'receptie';
    save();
    return { ok: true, bezoeker: b };
  }
  function pdaBezoekers(l) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    return { ok: true, bezoekers: P().bezoekers.filter(b => b.locatie === l && (!b.uit || b.at.slice(0, 10) === vandaag())).slice(0, 100) };
  }

  /* ---- security: rondes en incidenten ---- */
  function pdaRonde(actor, l, bevinding) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const r = { id: id(), locatie: l, checkpoints: LOCATIES[l].ruimtes.length, door: actor || 'security', at: nu() };
    P().rondes.unshift(r);
    db.data.overheidPda.rondes = P().rondes.slice(0, 5000);
    let incident = null;
    if (bevinding && schoon(bevinding.tekst, 300)) {
      const ir = pdaIncident(actor, l, bevinding);
      if (!ir.error) incident = ir.incident;
    }
    save();
    return { ok: true, ronde: r, incident };
  }
  function pdaIncident(actor, l, data) {
    l = loc(l); data = data || {};
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const tekst = schoon(data.tekst, 300);
    if (tekst.length < 3) return { status: 400, error: 'Omschrijf wat er speelt.' };
    const i = { id: id(), locatie: l, ruimte: LOCATIES[l].ruimtes.includes(data.ruimte) ? data.ruimte : LOCATIES[l].ruimtes[0],
      soort: INCIDENT_SOORTEN.includes(data.soort) ? data.soort : 'verdacht',
      ernst: Math.min(3, Math.max(1, Math.round(Number(data.ernst) || 1))),
      tekst, door: actor || 'security', at: nu(), gesloten: null };
    P().incidenten.unshift(i);
    db.data.overheidPda.incidenten = P().incidenten.slice(0, 10000);
    save();
    return { ok: true, incident: i };
  }
  function pdaIncidentSluit(actor, iid, oplossing) {
    const i = P().incidenten.find(x => x.id === String(iid || ''));
    if (!i) return { status: 404, error: 'Incident niet gevonden.' };
    if (i.gesloten) return { status: 409, error: 'Dit incident is al gesloten.' };
    i.gesloten = { door: actor || 'security', oplossing: schoon(oplossing, 300) || 'afgehandeld', at: nu() };
    save();
    return { ok: true, incident: i };
  }
  function pdaIncidenten(l) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    return { ok: true, soorten: INCIDENT_SOORTEN, incidenten: P().incidenten.filter(i => i.locatie === l).slice(0, 60) };
  }

  /* ---- schoonmaak: de dagtaken per ruimte ---- */
  function pdaTaken(l) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    return { ok: true, datum: vandaag(), ruimtes: LOCATIES[l].ruimtes, taken: zorgTaken(l) };
  }
  function pdaTaakKlaar(actor, tid) {
    const t = P().taken.find(x => x.id === String(tid || ''));
    if (!t) return { status: 404, error: 'Taak niet gevonden.' };
    if (t.klaar) return { status: 409, error: 'Deze taak is al afgevinkt.' };
    t.klaar = { door: actor || 'schoonmaak', at: nu() };
    save();
    return { ok: true, taak: t };
  }
  function pdaTaakExtra(actor, l, data) {
    l = loc(l); data = data || {};
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const tekst = schoon(data.tekst, 200);
    if (tekst.length < 3) return { status: 400, error: 'Omschrijf het extra werk.' };
    const t = { id: id(), locatie: l, datum: vandaag(), ruimte: LOCATIES[l].ruimtes.includes(data.ruimte) ? data.ruimte : LOCATIES[l].ruimtes[0],
      tekst, klaar: null, extra: true, door: actor || 'melder' };
    P().taken.push(t);
    save();
    return { ok: true, taak: t };
  }

  return { pdaBezoekerIn, pdaBezoekerUit, pdaBezoekers, pdaRonde, pdaIncident, pdaIncidentSluit,
    pdaIncidenten, pdaTaken, pdaTaakKlaar, pdaTaakExtra };
};
