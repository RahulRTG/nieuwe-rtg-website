/* Routes "gewoonten": kleine dingen die u vaker wilt doen (kern/gewoonten.js).
   Van het lid, op de sessiesleutel, en nergens te delen. */
module.exports = (kern) => {
  const { app, auth, gewoontenVan, gewoonteMaak, gewoonteTik, gewoonteReeks, gewoonteStop } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/gewoonten', auth, (req, res) => stuur(res, gewoontenVan(req.session.key)));
  app.post('/api/gewoonten/maak', auth, (req, res) => stuur(res, gewoonteMaak(req.session.key, req.body || {})));
  app.post('/api/gewoonten/tik', auth, (req, res) => stuur(res, gewoonteTik(req.session.key, req.body || {})));
  app.post('/api/gewoonten/reeks', auth, (req, res) => stuur(res, gewoonteReeks(req.session.key, req.body || {})));
  app.post('/api/gewoonten/stop', auth, (req, res) => stuur(res, gewoonteStop(req.session.key, req.body || {})));
};
