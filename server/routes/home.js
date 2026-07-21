/* Domein "home": de RTG Home Kit. Alle elektronica van het lid op een plek,
   plus scenes met AI-hulp. Alles op de eigen sessiesleutel; de AI stelt
   voor, het lid beslist, en sloten gaan nooit via een scene of de AI. */
module.exports = (kern) => {
  const { app, auth, homekit } = kern;
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
};
