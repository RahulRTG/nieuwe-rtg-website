/* Routes "account": een account voor alles (kern/eenaccount.js). Alles
   achter de leden-inlog van een ECHT account (geen anonieme gast): rollen
   bekijken, een werk-rol koppelen (met bewijs van de bestaande werk-inlog)
   en met het ene account een werk-sessie starten of een rol ontkoppelen. */
module.exports = (kern) => {
  const { app, auth, accRollen, accKoppel, accStart, accOntkoppel } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const echtAccount = (req, res) => {
    if (req.session.tier === 'guest' || !req.session.account) {
      res.status(403).json({ error: 'Maak eerst een (gratis) RTG-account; dat ene account is daarna uw sleutel tot alles.' });
      return false;
    }
    return true;
  };

  app.post('/api/account/rollen', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, accRollen(req.session.key));
  });
  app.post('/api/account/koppel', auth, async (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, await accKoppel(req.session.key, req.body || {}, req));
  });
  app.post('/api/account/start', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, accStart(req.session.key, req.body || {}, req));
  });
  app.post('/api/account/ontkoppel', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, accOntkoppel(req.session.key, req.body || {}));
  });
};
