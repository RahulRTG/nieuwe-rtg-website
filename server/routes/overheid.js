/* Routes "overheid": de behandelkant van De Overheid (kern/overheid.js).
   - Rijksambtenaren (partner-app, ingelogd als de rijks-partner RIJK): de regie,
     toeslagen/uitkeringen/bezwaren beoordelen, bekendmakingen plaatsen en een
     stemming openen of sluiten.
   - Ondernemers (elke ingelogde onderneming): inschrijven in het handelsregister
     (KVK) en het eigen uittreksel opvragen.
   Alles achter supplierAuth; de behandel-routes eisen bovendien dat de ingelogde
   partner het rijk zelf is. */
module.exports = (kern) => {
  const { app, supplierAuth, overheid } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function rijk(req, res, next) {
    if (!overheid.magBehandelen(req.supplier)) return res.status(403).json({ error: 'Alleen voor het rijk.' });
    next();
  }
  const wie = req => (req.actor && req.actor.name) || 'rijk';

  /* ---- rijksambtenaren ---- */
  app.post('/api/overheid/regie', supplierAuth, rijk, (req, res) => res.json(overheid.regie()));
  app.post('/api/overheid/toeslagen', supplierAuth, rijk, (req, res) => res.json(overheid.toeslagenLijst(req.body || {})));
  app.post('/api/overheid/toeslag/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.toeslagBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/uitkeringen', supplierAuth, rijk, (req, res) => res.json(overheid.uitkeringenLijst(req.body || {})));
  app.post('/api/overheid/uitkering/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.uitkeringBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/bezwaren', supplierAuth, rijk, (req, res) => res.json(overheid.bezwarenLijst(req.body || {})));
  app.post('/api/overheid/bezwaar/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.bezwaarBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/bekendmaking', supplierAuth, rijk, (req, res) => stuur(res, overheid.bekendmakingMaak(wie(req), req.body || {})));
  app.post('/api/overheid/verkiezing/sluit', supplierAuth, rijk, (req, res) => stuur(res, overheid.verkiezingSluit(req.body.open === true)));
  // provincie (subsidies) & waterschap (meldingen)
  app.post('/api/overheid/subsidies/lijst', supplierAuth, rijk, (req, res) => res.json(overheid.subsidiesLijst(req.body || {})));
  app.post('/api/overheid/subsidie/beslis', supplierAuth, rijk, (req, res) => stuur(res, overheid.subsidieBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/water/meldingen', supplierAuth, rijk, (req, res) => res.json(overheid.waterMeldingenLijst(req.body || {})));
  app.post('/api/overheid/water/melding/zet', supplierAuth, rijk, (req, res) => stuur(res, overheid.waterMeldingZet(wie(req), String(req.body.ref || ''), req.body || {})));
  // het handelsregister-overzicht voor de ambtenaar
  app.post('/api/overheid/kvk/lijst', supplierAuth, rijk, (req, res) => res.json(overheid.kvkLijst()));

  /* ---- het Belastingkantoor: de inspecteurscockpit (kern/overheid/kantoor.js) ---- */
  app.post('/api/overheid/bd/cockpit', supplierAuth, rijk, (req, res) => res.json(overheid.bdCockpit()));
  app.post('/api/overheid/bd/aanslagen', supplierAuth, rijk, (req, res) => res.json(overheid.bdAanslagen(req.body || {})));
  app.post('/api/overheid/bd/btw', supplierAuth, rijk, (req, res) => res.json(overheid.bdBtwBeeld()));
  app.post('/api/overheid/bd/herinnering', supplierAuth, rijk, (req, res) => stuur(res, overheid.bdHerinnering(wie(req), String(req.body.ref || ''))));
  app.post('/api/overheid/bd/regeling', supplierAuth, rijk, (req, res) => stuur(res, overheid.bdRegeling(wie(req), String(req.body.ref || ''), req.body.maanden)));
  app.post('/api/overheid/bd/kwijt', supplierAuth, rijk, (req, res) => stuur(res, overheid.bdKwijtschelding(wie(req), String(req.body.ref || ''), req.body.reden)));
  app.post('/api/overheid/bd/ai', supplierAuth, rijk, async (req, res) => {
    try { res.json(await overheid.bdAI(String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* ---- De Rechtspraak: de rechtbank (kern/overheid/rechtbank.js) ---- */
  app.post('/api/overheid/rb/cockpit', supplierAuth, rijk, (req, res) => res.json(overheid.rbCockpit()));
  app.post('/api/overheid/rb/zaken', supplierAuth, rijk, (req, res) => res.json(overheid.rbZaken(req.body || {})));
  app.post('/api/overheid/rb/zaak', supplierAuth, rijk, (req, res) => stuur(res, overheid.rbZaakMaak(wie(req), req.body || {})));
  app.post('/api/overheid/rb/beroep', supplierAuth, rijk, (req, res) => stuur(res, overheid.rbBeroep(wie(req), String(req.body.ref || ''))));
  app.post('/api/overheid/rb/zitting', supplierAuth, rijk, (req, res) => stuur(res, overheid.rbZitting(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/rb/rol', supplierAuth, rijk, (req, res) => res.json(overheid.rbRol(String(req.body.datum || ''))));
  app.post('/api/overheid/rb/uitspraak', supplierAuth, rijk, (req, res) => stuur(res, overheid.rbUitspraak(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/overheid/rb/ai', supplierAuth, rijk, async (req, res) => {
    try { res.json(await overheid.rbAI(String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* ---- de Overheids-PDA: het personeel van alle rijkskantoren (kern/overheid/pda.js) ---- */
  const L = req => String((req.body || {}).locatie || '');
  app.post('/api/overheid/pda/overzicht', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaOverzicht(L(req))));
  app.post('/api/overheid/pda/bezoeker/in', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaBezoekerIn(wie(req), L(req), req.body || {})));
  app.post('/api/overheid/pda/bezoeker/uit', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaBezoekerUit(wie(req), String(req.body.id || ''))));
  app.post('/api/overheid/pda/bezoekers', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaBezoekers(L(req))));
  app.post('/api/overheid/pda/ronde', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaRonde(wie(req), L(req), req.body.bevinding || null)));
  app.post('/api/overheid/pda/incident', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaIncident(wie(req), L(req), req.body || {})));
  app.post('/api/overheid/pda/incident/sluit', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaIncidentSluit(wie(req), String(req.body.id || ''), req.body.oplossing)));
  app.post('/api/overheid/pda/incidenten', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaIncidenten(L(req))));
  app.post('/api/overheid/pda/taken', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaTaken(L(req))));
  app.post('/api/overheid/pda/taak/klaar', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaTaakKlaar(wie(req), String(req.body.id || ''))));
  app.post('/api/overheid/pda/taak/extra', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaTaakExtra(wie(req), L(req), req.body || {})));
  app.post('/api/overheid/pda/zittingen', supplierAuth, rijk, (req, res) => res.json(overheid.pdaZittingen()));
  app.post('/api/overheid/pda/klaarzet', supplierAuth, rijk, (req, res) => stuur(res, overheid.pdaKlaarzet(wie(req), String(req.body.ref || ''))));
  app.post('/api/overheid/pda/ai', supplierAuth, rijk, async (req, res) => {
    try { stuur(res, await overheid.pdaAI(L(req), String(req.body.rol || ''), String(req.body.vraag || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* ---- ondernemers: inschrijven in het handelsregister als onderneming ---- */
  app.post('/api/supplier/overheid/kvk/inschrijven', supplierAuth, (req, res) =>
    stuur(res, overheid.kvkInschrijven({ supplierCode: req.supplier.code, bedrijf: req.supplier.name }, req.body || {})));
  app.post('/api/supplier/overheid/kvk/mijn', supplierAuth, (req, res) => res.json(overheid.kvkMijn({ supplierCode: req.supplier.code })));
  /* ---- de Rijks-Bibliotheek: 10.000 werk-apps per overheidsafdeling,
     inbegrepen voor rijksambtenaren; installaties per ambtenaar ---- */
  const { rijksbieb } = kern;
  const ambtenaarSleutel = req => 'RIJK:' + ((req.actor && (req.actor.id || req.actor.name)) || 'balie');
  app.post('/api/overheid/bieb', supplierAuth, rijk, (req, res) => res.json(rijksbieb.overzicht()));
  app.post('/api/overheid/bieb/catalogus', supplierAuth, rijk, (req, res) => res.json(rijksbieb.catalogus(req.body || {})));
  app.post('/api/overheid/bieb/installeer', supplierAuth, rijk, (req, res) => {
    const r = rijksbieb.installeer(ambtenaarSleutel(req), req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/overheid/bieb/weg', supplierAuth, rijk, (req, res) => {
    const r = rijksbieb.verwijder(ambtenaarSleutel(req), req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/overheid/bieb/mijn', supplierAuth, rijk, (req, res) => res.json({ apps: rijksbieb.mijnApps(ambtenaarSleutel(req)) }));

  // in één tik inschrijven in het handelsregister (idempotent) · de onboarding-koppeling
  app.post('/api/supplier/overheid/kvk/zorg', supplierAuth, (req, res) => stuur(res, overheid.kvkZorg(req.supplier)));
  app.post('/api/supplier/overheid/bekendmakingen', supplierAuth, (req, res) => res.json(overheid.bekendmakingen()));
  // een onderneming vraagt zelf een provinciale subsidie aan en volgt hem
  app.post('/api/supplier/overheid/subsidie', supplierAuth, (req, res) =>
    stuur(res, overheid.subsidieAanvraag({ supplierCode: req.supplier.code, bedrijf: req.supplier.name }, req.body || {})));
  app.post('/api/supplier/overheid/subsidies', supplierAuth, (req, res) => res.json(overheid.mijnSubsidies({ supplierCode: req.supplier.code })));
};
