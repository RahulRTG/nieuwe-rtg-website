/* Domein "rtgid": RTG iD, de DigiD-vervanger. De dienst-kant (start,
   status, wie) is de publieke kant van de balie; de app-kant (code
   opzoeken, bevestigen, weigeren, inzage, intrekken, machtigen) zit
   achter de leden-inlog. Gasten hebben geen iD. */
module.exports = (kern) => {
  const { app, auth, rtgid } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; r.error ? res.status(status || 400).json({ error: r.error }) : res.status(200).json(rest); };
  const geenGast = (req, res, next) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'RTG iD is voor leden.' });
    next();
  };

  // de dienst-kant
  app.post('/api/rtgid/start', (req, res) => stuur(res, rtgid.start(req.body || {})));
  app.post('/api/rtgid/status', (req, res) => stuur(res, rtgid.statusVan(req.body.koppelId)));
  app.post('/api/rtgid/wie', (req, res) => stuur(res, rtgid.wie(req.body.idToken)));

  // de app-kant (het lid zelf)
  const lid = [auth, geenGast];
  app.post('/api/rtgid/koppel', ...lid, (req, res) => stuur(res, rtgid.koppelZoek(req.session.key, req.body.code)));
  app.post('/api/rtgid/bevestig', ...lid, (req, res) => stuur(res, rtgid.bevestig(req.session.key, req.body.koppelId, req.body.machtigingId)));
  app.post('/api/rtgid/weiger', ...lid, (req, res) => stuur(res, rtgid.weiger(req.session.key, req.body.koppelId)));
  app.post('/api/rtgid/inzage', ...lid, (req, res) => stuur(res, rtgid.inzage(req.session.key)));
  app.post('/api/rtgid/intrek', ...lid, (req, res) => stuur(res, rtgid.intrek(req.session.key, req.body.dienst)));
  app.post('/api/rtgid/machtig', ...lid, async (req, res) => stuur(res, await rtgid.machtig(req.session.key, req.body || {})));
  app.post('/api/rtgid/machtig/intrek', ...lid, (req, res) => stuur(res, rtgid.machtigIntrek(req.session.key, req.body.id)));
};
