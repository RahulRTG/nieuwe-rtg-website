/* Domein "home": de RTG Home Kit. Alle elektronica van het lid op een plek,
   plus scenes met AI-hulp. Alles op de eigen sessiesleutel; de AI stelt
   voor, het lid beslist, en sloten gaan nooit via een scene of de AI. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, homekit, homeMerken, woningOnderhoud } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/home', auth, (req, res) => res.json(homekit.overzicht(req.session.key)));
  app.post('/api/home/zet', auth, (req, res) => stuur(res, homekit.zet(req.session.key, req.body.id, req.body.stand)));
  app.post('/api/home/alles-uit', auth, (req, res) => stuur(res, homekit.allesUit(req.session.key)));
  app.post('/api/home/scene/ai', auth, async (req, res) => {
    try { stuur(res, await homekit.sceneVoorstel(req.session.key, req.body.wens)); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/home/scene/bewaar', auth, (req, res) => stuur(res, homekit.sceneBewaar(req.session.key, req.body || {})));
  app.post('/api/home/scene/start', auth, (req, res) => stuur(res, homekit.sceneStart(req.session.key, req.body.id)));
  app.post('/api/home/scene/weg', auth, (req, res) => stuur(res, homekit.sceneWeg(req.session.key, req.body.id)));

  /* Onderhoud blijft aan hetzelfde huis en dezelfde ledenpoort gekoppeld.
     Een lid kan melden en intrekken; een vakman wordt hier nooit verzonnen. */
  app.post('/api/home/onderhoud', auth, (req, res) => res.json(woningOnderhoud.lijst(req.session.key)));
  app.post('/api/home/onderhoud/meld', auth, (req, res) => stuur(res, woningOnderhoud.meld(req.session.key, req.body || {})));
  app.post('/api/home/onderhoud/annuleer', auth, (req, res) => stuur(res, woningOnderhoud.annuleer(req.session.key, req.body.id)));

  /* ---- "Werkt met RTG Home Kit": de open merkenlaag ---- */
  // de merken bekijken en verbinden (de woning staat altijd eerst klaar)
  app.post('/api/home/merken', auth, (req, res) => { homekit.overzicht(req.session.key); res.json(homeMerken.merken(req.session.key)); });
  app.post('/api/home/merk/verbind', auth, (req, res) => { homekit.overzicht(req.session.key); stuur(res, homeMerken.verbind(req.session.key, req.body.id)); });
  app.post('/api/home/merk/ontkoppel', auth, (req, res) => stuur(res, homeMerken.ontkoppel(req.session.key, req.body.id)));
  // elk partnermerk meldt zich aan via de open koppelstandaard
  app.post('/api/supplier/home/merk', supplierAuth, (req, res) => stuur(res, homeMerken.meldAan(req.supplier, req.body || {})));
};
