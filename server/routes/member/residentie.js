/* Member-submodule "residentie": De Residence, het virtuele grandhotel.
   Binnenlopen in een zaal of suite, stappen, praten, een emote, de eigen
   suite inrichten en de gids. Alles op codenaam; live seintjes lopen over
   het bestaande /api/stream-kanaal (event 'residentie').
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, PERSONAS } = kern;
  const res9 = () => kern.residentie;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const naamVan = req => req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const lid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'De Residence is er voor leden.' }); return false; }
    return true;
  };

  app.post('/api/residentie/gids', auth, (req, res) => stuur(res, res9().gids()));
  app.post('/api/residentie/betreed', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().betreed(req.session.key, naamVan(req), (req.body || {}).kamer));
  });
  app.post('/api/residentie/stap', auth, (req, res) => stuur(res, res9().stap(req.session.key, req.body || {})));
  app.post('/api/residentie/zeg', auth, (req, res) => stuur(res, res9().zeg(req.session.key, req.body || {})));
  app.post('/api/residentie/emote', auth, (req, res) => stuur(res, res9().emote(req.session.key, req.body || {})));
  app.post('/api/residentie/weg', auth, (req, res) => stuur(res, res9().weg(req.session.key)));
  app.post('/api/residentie/pols', auth, (req, res) => stuur(res, res9().pols(req.session.key)));

  /* samen spelen: uitdagen, antwoorden, een beurt doen, stoppen; plus de
     vragen van het huis aan tafel en de huistelefoon in de suite */
  app.post('/api/residentie/spel/daag', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().daag(req.session.key, req.body || {}));
  });
  app.post('/api/residentie/spel/antwoord', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().antwoord(req.session.key, req.body || {}));
  });
  app.post('/api/residentie/spel/zet', auth, (req, res) => stuur(res, res9().spelZet(req.session.key, req.body || {})));
  app.post('/api/residentie/spel/stop', auth, (req, res) => stuur(res, res9().spelStop(req.session.key)));
  app.post('/api/residentie/vraag', auth, (req, res) => stuur(res, res9().vraag(req.session.key)));
  app.post('/api/residentie/huis', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().huis(req.session.key));
  });
  app.post('/api/residentie/bel', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().bel(req.session.key, req.body || {}, naamVan(req)));
  });

  app.post('/api/residentie/suite', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().mijnSuite(req.session.key, naamVan(req)));
  });
  app.post('/api/residentie/suite/zet', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().suiteZet(req.session.key, naamVan(req), req.body || {}));
  });
  app.post('/api/residentie/meubel/zet', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().meubelZet(req.session.key, naamVan(req), req.body || {}));
  });
  app.post('/api/residentie/meubel/weg', auth, (req, res) => {
    if (!lid(req, res)) return;
    stuur(res, res9().meubelWeg(req.session.key, naamVan(req), req.body || {}));
  });
};
