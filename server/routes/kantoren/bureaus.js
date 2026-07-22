/* Kantoren, deel "bureaus": de vier ontwerpbureaus en hun gedeelde werkbank.
   RTG Atelier (mode), RTG Ontwerpstudio (voer-/vaartuigen), RTG Hardwarelab
   (apparaten) en het RTG Architectenbureau (huizen) hebben dezelfde vorm --
   ontwerpen maken/bijwerken, AI-concepten, een technisch blad en de kritiek van
   de chef -- plus de Ideeenkamer als gezamenlijke werkbank. Afgesplitst uit
   kantoren/index.js; de helpers komen via de gedeelde context binnen. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, kern } = ctx;

  /* RTG Atelier: het ontwerpbureau. Ontwerpen maken en bijwerken, de
     AI-concepten, tech packs en de kritiek van de creatief directeur. */
  app.post('/api/office/atelier', officeAuth, (req, res) => veilig(res, () => kern.atelier.overzicht()));
  app.post('/api/office/atelier/maak', officeAuth, (req, res) => veilig(res, () => kern.atelier.ontwerpMaak(req.body || {})));
  app.post('/api/office/atelier/zet', officeAuth, (req, res) => veilig(res, () => kern.atelier.ontwerpZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/atelier/verwijder', officeAuth, (req, res) => veilig(res, () => kern.atelier.ontwerpVerwijder(String(req.body.id || ''))));
  app.post('/api/office/atelier/collectie', officeAuth, (req, res) => veilig(res, () => kern.atelier.collectieMaak(req.body || {})));
  app.post('/api/office/atelier/techpack', officeAuth, (req, res) => veilig(res, () => kern.atelier.aiTechpack(String(req.body.id || ''))));
  app.post('/api/office/atelier/concept', officeAuth, async (req, res) => {
    try { const r = await kern.atelier.aiConcept(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[atelier]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/atelier/kritiek', officeAuth, async (req, res) => {
    try { const r = await kern.atelier.aiKritiek(String(req.body.id || ''), req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[atelier]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* RTG Ontwerpstudio: het voertuig- en vaartuig-ontwerpbureau. Zelfde vorm
     als het atelier: concepten met AI, specsheet en de chef-ontwerper. */
  app.post('/api/office/studio', officeAuth, (req, res) => veilig(res, () => kern.studio.overzicht()));
  app.post('/api/office/studio/maak', officeAuth, (req, res) => veilig(res, () => kern.studio.ontwerpMaak(req.body || {})));
  app.post('/api/office/studio/zet', officeAuth, (req, res) => veilig(res, () => kern.studio.ontwerpZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/studio/verwijder', officeAuth, (req, res) => veilig(res, () => kern.studio.ontwerpVerwijder(String(req.body.id || ''))));
  app.post('/api/office/studio/collectie', officeAuth, (req, res) => veilig(res, () => kern.studio.collectieMaak(req.body || {})));
  app.post('/api/office/studio/lookbook', officeAuth, (req, res) => veilig(res, () => kern.studio.lookbook(req.body.naam)));
  app.post('/api/office/studio/specsheet', officeAuth, (req, res) => veilig(res, () => kern.studio.aiSpecsheet(String(req.body.id || ''))));
  app.post('/api/office/studio/concept', officeAuth, async (req, res) => {
    try { const r = await kern.studio.aiConcept(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[studio]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/studio/kritiek', officeAuth, async (req, res) => {
    try { const r = await kern.studio.aiKritiek(String(req.body.id || ''), req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[studio]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* RTG Hardwarelab: het eigen hardware-ontwerpbureau. Zelfde vorm als de
     studio: concepten met AI, een stuklijst en de chef-engineer, plus een
     productblad per serie. */
  app.post('/api/office/hardware', officeAuth, (req, res) => veilig(res, () => kern.hardware.overzicht()));
  app.post('/api/office/hardware/maak', officeAuth, (req, res) => veilig(res, () => kern.hardware.ontwerpMaak(req.body || {})));
  app.post('/api/office/hardware/zet', officeAuth, (req, res) => veilig(res, () => kern.hardware.ontwerpZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/hardware/verwijder', officeAuth, (req, res) => veilig(res, () => kern.hardware.ontwerpVerwijder(String(req.body.id || ''))));
  app.post('/api/office/hardware/serie', officeAuth, (req, res) => veilig(res, () => kern.hardware.collectieMaak(req.body || {})));
  app.post('/api/office/hardware/productblad', officeAuth, (req, res) => veilig(res, () => kern.hardware.productblad(req.body.naam)));
  app.post('/api/office/hardware/winkel', officeAuth, (req, res) => veilig(res, () => kern.hardware.naarWinkel(String(req.body.id || ''), req.body.prijs || req.body || {})));
  app.post('/api/office/hardware/winkel-uit', officeAuth, (req, res) => veilig(res, () => kern.hardware.uitWinkel(String(req.body.id || ''))));
  app.post('/api/office/hardware/stuklijst', officeAuth, (req, res) => veilig(res, () => kern.hardware.aiStuklijst(String(req.body.id || ''))));
  app.post('/api/office/hardware/concept', officeAuth, async (req, res) => {
    try { const r = await kern.hardware.aiConcept(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[hardware]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/hardware/kritiek', officeAuth, async (req, res) => {
    try { const r = await kern.hardware.aiKritiek(String(req.body.id || ''), req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[hardware]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* RTG Architectenbureau: het huizen-ontwerpbureau. Zelfde vorm als de studio:
     concepten met AI, een bouwstaat en de chef-architect, plus een portfolio
     per project. */
  app.post('/api/office/architect', officeAuth, (req, res) => veilig(res, () => kern.architect.overzicht()));
  app.post('/api/office/architect/maak', officeAuth, (req, res) => veilig(res, () => kern.architect.ontwerpMaak(req.body || {})));
  app.post('/api/office/architect/zet', officeAuth, (req, res) => veilig(res, () => kern.architect.ontwerpZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/architect/verwijder', officeAuth, (req, res) => veilig(res, () => kern.architect.ontwerpVerwijder(String(req.body.id || ''))));
  app.post('/api/office/architect/project', officeAuth, (req, res) => veilig(res, () => kern.architect.collectieMaak(req.body || {})));
  app.post('/api/office/architect/portfolio', officeAuth, (req, res) => veilig(res, () => kern.architect.portfolio(req.body.naam)));
  app.post('/api/office/architect/bouwstaat', officeAuth, (req, res) => veilig(res, () => kern.architect.aiBouwstaat(String(req.body.id || ''))));
  app.post('/api/office/architect/concept', officeAuth, async (req, res) => {
    try { const r = await kern.architect.aiConcept(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[architect]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/architect/kritiek', officeAuth, async (req, res) => {
    try { const r = await kern.architect.aiKritiek(String(req.body.id || ''), req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[architect]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

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

  // het persbureau (RTG Redactie) staat apart, in ./redactie.js
  require('./redactie')(ctx);
};
