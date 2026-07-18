/* Paspoort (deelmodule): het toezicht: incidenten indienen en beoordelen,
   de publieke weergaven, het vervallen van inzages en de lijsten voor lid,
   partner en kantoor. Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/paspoort.js. */
module.exports = (ctx) => {
  const { db, save, crypto, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    leesUploadDataUrl, leeftijdVan, gidsHaal, NIVEAUS, VIEW_TTL_MS, KIND_GRENS,
    lijsten, accountVanKey, memberState, leeftijdVanAccount, log, bevestigingVan, inhoudVoor, codenaamUitGids, id, schoon, nu } = ctx;
  function dienIncidentIn(supplier, key, reden, niveau, actor) {
    lijsten();
    const u = accountVanKey(key);
    if (!u) return { status: 404, error: 'Dit lid heeft geen RTG-geverifieerd paspoort.' };
    const r = schoon(reden, 500);
    if (r.length < 10) return { status: 400, error: 'Beschrijf het incident (minstens 10 tekens).' };
    const nv = ['idkaart', 'paspoort'].includes(niveau) ? niveau : 'idkaart';
    const codenaam = codenaamUitGids(key) || null;
    const inc = {
      id: id(), supplierCode: supplier.code, supplierName: supplier.name,
      key, codenaam, reden: r, gevraagdNiveau: nv, status: 'ingediend',
      door: (actor && actor.name) || 'Team', at: nu(),
      beoordeeldDoor: null, beoordeeldAt: null, besluit: null, verzoekId: null
    };
    db.data.paspoortIncidenten.unshift(inc);
    db.data.paspoortIncidenten = db.data.paspoortIncidenten.slice(0, 50000);
    log({ soort: 'incident-ingediend', incidentId: inc.id, supplierCode: supplier.code, key, codenaam, door: inc.door });
    save();
    // het lid weet dat er een incident loopt; de identiteit is nog NIET vrijgegeven
    notify(key, { icon: '⚠️', title: 'Incident gemeld', body: supplier.name + ' meldde een incident. RTG beoordeelt het; uw identiteit is niet zomaar gedeeld.', scope: 'privacy' });
    sseToOffice('sync', { scope: 'incident' });
    sseToSupplier(supplier.code, 'sync', { scope: 'paspoort' });
    return { ok: true, incident: publiekIncident(inc) };
  }

  // RTG-kantoor beoordeelt: vrijgeven (maakt een goedgekeurde inzage aan) of afwijzen
  function beoordeelIncident(incidentId, besluit, beoordelaar) {
    lijsten();
    const inc = db.data.paspoortIncidenten.find(x => x.id === incidentId);
    if (!inc) return { status: 404, error: 'Incident niet gevonden.' };
    if (inc.status !== 'ingediend') return { status: 409, error: 'Dit incident is al beoordeeld.' };
    inc.beoordeeldAt = nu();
    inc.beoordeeldDoor = schoon(beoordelaar, 60) || 'RTG-kantoor';
    if (besluit === 'vrijgeven') {
      inc.status = 'vrijgegeven'; inc.besluit = 'vrijgeven';
      // een tijdgebonden inzage die de partner kan openen (na RTG-vrijgave, dus
      // zonder toestemming van het lid, maar volledig gelogd)
      const v = {
        id: id(), supplierCode: inc.supplierCode, supplierName: inc.supplierName,
        key: inc.key, codenaam: inc.codenaam, niveau: inc.gevraagdNiveau, status: 'goedgekeurd',
        reden: 'Incident: ' + inc.reden.slice(0, 120), door: 'RTG-kantoor', incident: true,
        at: nu(), beslistAt: nu(), vervalt: new Date(Date.now() + VIEW_TTL_MS).toISOString()
      };
      db.data.paspoortVerzoeken.unshift(v);
      inc.verzoekId = v.id;
      log({ soort: 'incident-vrijgegeven', incidentId: inc.id, verzoekId: v.id, supplierCode: inc.supplierCode, key: inc.key, door: inc.beoordeeldDoor });
      notifySupplier(inc.supplierCode, { icon: '🔓', title: 'Incident vrijgegeven', body: 'RTG gaf de identiteit voor uw incident vrij. U kunt de inzage 10 minuten openen.' });
      notify(inc.key, { icon: '🔓', title: 'Identiteit vrijgegeven', body: 'RTG gaf na beoordeling uw identiteit vrij aan ' + inc.supplierName + ' wegens het gemelde incident.', scope: 'privacy' });
      sseToCustomer(inc.key, 'sync', { scope: 'paspoort' });
    } else {
      inc.status = 'afgewezen'; inc.besluit = 'afwijzen';
      log({ soort: 'incident-afgewezen', incidentId: inc.id, supplierCode: inc.supplierCode, key: inc.key, door: inc.beoordeeldDoor });
      notifySupplier(inc.supplierCode, { icon: '⛔', title: 'Incident afgewezen', body: 'RTG wees uw incidentverzoek af; de identiteit wordt niet gedeeld.' });
    }
    sseToOffice('sync', { scope: 'incident' });
    sseToSupplier(inc.supplierCode, 'sync', { scope: 'paspoort' });
    save();
    return { ok: true, incident: publiekIncident(inc) };
  }

  /* ---- overzichten ---- */
  function publiekVerzoek(v) {
    return {
      id: v.id, supplierCode: v.supplierCode, supplierName: v.supplierName,
      codenaam: v.codenaam, niveau: v.niveau, status: v.status, reden: v.reden || '',
      incident: !!v.incident, at: v.at, beslistAt: v.beslistAt, vervalt: v.vervalt || null
    };
  }
  function publiekIncident(i) {
    return {
      id: i.id, supplierCode: i.supplierCode, supplierName: i.supplierName,
      codenaam: i.codenaam, reden: i.reden, gevraagdNiveau: i.gevraagdNiveau,
      status: i.status, door: i.door, at: i.at, beoordeeldDoor: i.beoordeeldDoor,
      beoordeeldAt: i.beoordeeldAt, besluit: i.besluit
    };
  }
  function vervalOpschonen() {
    lijsten();
    const nuMs = Date.now();
    let veranderd = false;
    for (const v of db.data.paspoortVerzoeken) {
      if (v.status === 'goedgekeurd' && v.vervalt && new Date(v.vervalt).getTime() < nuMs) { v.status = 'verlopen'; veranderd = true; }
    }
    if (veranderd) save();
  }
  function mijnVerzoeken(key) {
    lijsten();
    return db.data.paspoortVerzoeken.filter(v => v.key === key).slice(0, 60).map(publiekVerzoek);
  }
  function partnerVerzoeken(supplierCode) {
    lijsten(); vervalOpschonen();
    return {
      verzoeken: db.data.paspoortVerzoeken.filter(v => v.supplierCode === supplierCode).slice(0, 60).map(publiekVerzoek),
      incidenten: db.data.paspoortIncidenten.filter(i => i.supplierCode === supplierCode).slice(0, 40).map(publiekIncident)
    };
  }
  function incidentenVoorOffice(alleen) {
    lijsten();
    let lijst = db.data.paspoortIncidenten;
    if (alleen === 'open') lijst = lijst.filter(i => i.status === 'ingediend');
    return lijst.slice(0, 200).map(publiekIncident);
  }

  return { dienIncidentIn, beoordeelIncident, publiekVerzoek, publiekIncident, vervalOpschonen, mijnVerzoeken, partnerVerzoeken, incidentenVoorOffice };
};
