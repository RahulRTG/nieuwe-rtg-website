/* Routes "gemeente": de behandelkant van RTG Gemeente.
   - Gemeente-medewerkers (partner-app + PDA, ingelogd als de gemeente-partner):
     de regie, meldingen toewijzen en afhandelen, afspraken, vergunningen
     beoordelen, bekendmakingen plaatsen en AI-triage.
   - RTG-partners (elke ingelogde onderneming): terras-, evenement- en
     horecavergunningen aanvragen en de eigen aanvragen volgen.
   Alles achter supplierAuth; de behandel-routes eisen bovendien dat de
   ingelogde partner de gemeente zelf is. */
module.exports = (kern) => {
  const { app, supplierAuth, gemeente } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  // poortwachter: alleen de gemeente-partner mag behandelen
  function gem(req, res, next) {
    if (!gemeente.magBehandelen(req.supplier)) return res.status(403).json({ error: 'Alleen voor de gemeente.' });
    next();
  }
  const wie = req => (req.actor && req.actor.name) || 'gemeente';

  /* ---- gemeente-medewerkers ---- */
  app.post('/api/gemeente/regie', supplierAuth, gem, (req, res) => res.json(gemeente.regie()));
  app.post('/api/gemeente/meldingen', supplierAuth, gem, (req, res) => res.json(gemeente.meldingenLijst(req.body || {})));
  app.post('/api/gemeente/melding/zet', supplierAuth, gem, (req, res) => stuur(res, gemeente.meldingZet(wie(req), String(req.body.ref || ''), req.body.patch || req.body || {})));
  app.post('/api/gemeente/afspraken', supplierAuth, gem, (req, res) => res.json(gemeente.afsprakenLijst(req.body.datum)));
  app.post('/api/gemeente/vergunningen', supplierAuth, gem, (req, res) => res.json(gemeente.vergunningenLijst(req.body || {})));
  app.post('/api/gemeente/vergunning/beslis', supplierAuth, gem, (req, res) => stuur(res, gemeente.vergunningBeslis(wie(req), String(req.body.ref || ''), req.body || {})));
  app.post('/api/gemeente/bekendmaking', supplierAuth, gem, (req, res) => stuur(res, gemeente.bekendmakingMaak(wie(req), req.body || {})));
  app.post('/api/gemeente/triage', supplierAuth, gem, async (req, res) => {
    try { res.json(await gemeente.triage(String(req.body.tekst || ''))); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis.' }); }
  });

  /* ---- RTG-partners: een vergunning aanvragen als onderneming ---- */
  app.post('/api/supplier/gemeente/vergunning', supplierAuth, (req, res) =>
    stuur(res, gemeente.vergunningAanvraag({ supplierCode: req.supplier.code, bedrijf: req.supplier.name }, req.body || {})));
  app.post('/api/supplier/gemeente/vergunningen', supplierAuth, (req, res) =>
    res.json({ vergunningen: gemeente.vergunningenVanPartner(req.supplier.code) }));
  // de bekendmakingen die elke onderneming kan inzien
  app.post('/api/supplier/gemeente/bekendmakingen', supplierAuth, (req, res) => res.json(gemeente.bekendmakingen()));
};
