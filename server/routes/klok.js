/* RTG Klok: wekkers en timers op de server (het Thuiswacht-principe),
   dus ook door Rahul te zetten. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, klok, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account voor wekkers en timers.' });
      return true;
    }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/klok/mijn', auth, (req, res) => stuur(res, klok.klokLijst(req.session.key)));
  app.post('/api/klok/wekker', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, klok.klokWekker(req.session.key, req.body || {}));
  });
  app.post('/api/klok/timer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, klok.klokTimer(req.session.key, req.body || {}));
  });
};
