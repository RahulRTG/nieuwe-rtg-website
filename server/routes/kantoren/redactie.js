/* Kantoren, deel "redactie": het RTG persbureau (kern/redactie.js). De
   schrijftafel met de statusketen (publiceren beslist een mens), de drukkerij
   met edities en drukproef, de nieuwstips-wand uit het hele platform en de
   AI-hoofdredacteur. Afgesplitst uit bureaus.js zodat elk deel klein blijft. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, kern } = ctx;

  app.post('/api/office/redactie', officeAuth, (req, res) => veilig(res, () => kern.redactie.overzicht()));
  app.post('/api/office/redactie/artikel/maak', officeAuth, (req, res) => veilig(res, () => kern.redactie.artikelMaak(req.body || {})));
  app.post('/api/office/redactie/artikel/zet', officeAuth, (req, res) => veilig(res, () => kern.redactie.artikelZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/redactie/artikel/status', officeAuth, (req, res) => veilig(res, () => kern.redactie.artikelStatus(String(req.body.id || ''), String(req.body.status || ''))));
  app.post('/api/office/redactie/artikel/verwijder', officeAuth, (req, res) => veilig(res, () => kern.redactie.artikelVerwijder(String(req.body.id || ''))));
  app.post('/api/office/redactie/editie/maak', officeAuth, (req, res) => veilig(res, () => kern.redactie.editieMaak(req.body || {})));
  app.post('/api/office/redactie/editie/status', officeAuth, (req, res) => veilig(res, () => kern.redactie.editieStatus(String(req.body.id || ''), String(req.body.status || ''))));
  app.post('/api/office/redactie/drukproef', officeAuth, (req, res) => veilig(res, () => kern.redactie.drukproef(String(req.body.id || ''))));
  app.post('/api/office/redactie/nieuwstips', officeAuth, (req, res) => veilig(res, () => kern.redactie.nieuwstips()));
  app.post('/api/office/redactie/ai/schrijf', officeAuth, async (req, res) => {
    try { const r = await kern.redactie.aiSchrijf(String(req.body.onderwerp || ''), String(req.body.rubriek || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[redactie]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/redactie/ai/redactie', officeAuth, async (req, res) => {
    try { const r = await kern.redactie.aiRedactie(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[redactie]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
