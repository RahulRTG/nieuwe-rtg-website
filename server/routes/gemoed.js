/* Routes "gemoed": de dagcheck-in (kern/gemoed.js). Alles hier staat op de
   sessiesleutel en verlaat het account niet: er is geen deelroute, geen
   partnerkant en geen kantoorkant. Dat is geen omissie maar het ontwerp. */
module.exports = (kern) => {
  const { app, auth, gemoedVan, gemoedZet, gemoedWeg } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/gemoed', auth, (req, res) => stuur(res, gemoedVan(req.session.key)));
  app.post('/api/gemoed/zet', auth, (req, res) => stuur(res, gemoedZet(req.session.key, req.body || {})));
  app.post('/api/gemoed/weg', auth, (req, res) => stuur(res, gemoedWeg(req.session.key, req.body || {})));
};
