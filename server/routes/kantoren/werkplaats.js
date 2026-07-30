/* Kantoren, deel "werkplaats": de Ideeenkamer (de gedeelde werkbank van de vier
   ontwerpbureaus) en RTG Werkplaats, het app-bureau dat nieuwe apps bedenkt en
   bestaande apps, de winkel en de hardware doorlicht -- inclusief het
   rechtstreeks uitgeven van een opdracht als echt onderdeel in de winkel.
   Afgesplitst uit ./bureaus zodat elk deel onder de 10 KB blijft. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, kern } = ctx;

  /* De Ideeenkamer: de gedeelde werkbank van de vier ontwerpbureaus. Ideeen met
     bureau-tags, reacties, AI-uitwerking per bureau en spin-off naar een bureau. */
  app.post('/api/office/ideeen', officeAuth, (req, res) => veilig(res, () => kern.ideeen.overzicht()));
  app.post('/api/office/ideeen/maak', officeAuth, (req, res) => veilig(res, () => kern.ideeen.ideeMaak(req.body || {})));
  app.post('/api/office/ideeen/zet', officeAuth, (req, res) => veilig(res, () => kern.ideeen.ideeZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/ideeen/verwijder', officeAuth, (req, res) => veilig(res, () => kern.ideeen.ideeVerwijder(String(req.body.id || ''))));
  app.post('/api/office/ideeen/reactie', officeAuth, (req, res) => veilig(res, () => kern.ideeen.reactie(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/ideeen/spinoff', officeAuth, (req, res) => veilig(res, () => kern.ideeen.spinOff(String(req.body.id || ''), String(req.body.bureau || ''))));
  app.post('/api/office/ideeen/uitwerken', officeAuth, async (req, res) => {
    try { const r = await kern.ideeen.aiUitwerken(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[ideeen]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* RTG Werkplaats: het app-bureau. Nieuwe apps bedenken en bestaande apps, de
     Bibliotheek en de App Store met AI verbeteren (advies; een mens beslist). */
  app.post('/api/office/werkplaats', officeAuth, (req, res) => veilig(res, () => kern.werkplaats.overzicht()));
  app.post('/api/office/werkplaats/maak', officeAuth, (req, res) => veilig(res, () => kern.werkplaats.maak(req.body || {})));
  app.post('/api/office/werkplaats/zet', officeAuth, (req, res) => veilig(res, () => kern.werkplaats.zet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/werkplaats/verwijder', officeAuth, (req, res) => veilig(res, () => kern.werkplaats.verwijder(String(req.body.id || ''))));
  app.post('/api/office/werkplaats/uitwerken', officeAuth, async (req, res) => {
    try { const r = await kern.werkplaats.aiUitwerken(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[werkplaats]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/werkplaats/kritiek', officeAuth, async (req, res) => {
    try { const r = await kern.werkplaats.aiKritiek(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[werkplaats]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  // rechtstreeks uitgeven: de opdracht als echt onderdeel in de winkel zetten of intrekken
  app.post('/api/office/werkplaats/publiceer', officeAuth, (req, res) => veilig(res, () => kern.werkplaats.publiceer(String(req.body.id || ''))));
  app.post('/api/office/werkplaats/introk', officeAuth, (req, res) => veilig(res, () => kern.werkplaats.introk(String(req.body.id || ''))));
};
