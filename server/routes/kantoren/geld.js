/* Kantoren, deel "geld": de geld-regie van RTG (pasprijzen, partnervergoeding,
   betaaldienst-tarief, ledenvoordeel) en de eigen-AI-dataset. Alles achter de
   boardroom-poort, behalve de publieke pasprijzen -- wat de boardroom zet, is
   meteen overal het geldende bedrag. Afgesplitst uit ./regie zodat elk deel
   onder de 10 KB blijft; de bedrading komt via dezelfde context binnen. */
module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, stuur, afdelingen, kern,
    geldOverzicht, geldPasprijzen, geldPasprijsZet, geldCommissieZet, geldKortingZet } = ctx;

  /* De geld-regie: RTG bepaalt de pasprijzen, de partnervergoeding (per genre
     of per zaak) en het ledenvoordeel per genre. De pasprijzen zijn publiek:
     wat hier gezet wordt is meteen overal het geldende bedrag. */
  app.post('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.get('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.post('/api/office/geld', boardroomAuth, (req, res) => veilig(res, () => geldOverzicht()));
  app.post('/api/office/geld/pasprijs', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldPasprijsZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Pasprijs ' + r.pas + ' gezet op € ' + (r.maandCenten / 100).toFixed(2) + ' per maand (ex btw)');
    return r;
  }));
  app.post('/api/office/geld/commissie', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldCommissieZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Partnervergoeding ' + (r.code || r.genre) + ' gezet op ' + (r.rate * 100).toFixed(1) + '%');
    return r;
  }));
  // de betaaldienst: het tarief dat per kassabetaling DIRECT met de zaak wordt verrekend
  app.post('/api/office/geld/betaaldienst', boardroomAuth, (req, res) => veilig(res, () =>
    (req.body && (req.body.vastCenten != null || req.body.pct != null))
      ? kern.geldBetaaldienstZet(req.body) : { status: 200, ok: true, ...kern.geldBetaaldienst() }));
  app.post('/api/office/geld/korting', boardroomAuth, (req, res) => veilig(res, () => {
    const r = geldKortingZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Ledenvoordeel ' + r.genre + ' gezet op ' + r.pct + '%');
    return r;
  }));

  /* De eigen-AI-dataset: het bord (hoeveel records per bron) en de knop die
     alles als JSONL-bestand bewaart. Op codenamen; de kluis blijft dicht.
     Elke export komt in het auditlog. */
  app.post('/api/office/aidata', officeAuth, (req, res) => veilig(res, () => kern.aidataOverzicht()));
  app.post('/api/office/aidata/export', boardroomAuth, (req, res) => {
    try {
      const r = kern.aidataExport();
      afdelingen.audit(req.body.naam || 'boardroom', 'AI-dataset geexporteerd: ' + r.aantal + ' records (JSONL)');
      res.setHeader('Content-Type', 'application/jsonl; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="rtg-ai-dataset-' + new Date().toISOString().slice(0, 10) + '.jsonl"');
      res.send(r.jsonl);
    } catch (e) { console.error('[aidata]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
