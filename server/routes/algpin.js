/* Routes "algpin": de algemene pin van het lid. Een pincode, overal dezelfde:
   hij beschermt de privacygevoelige apps op het RTG-OS en is het bewijs
   waarmee de werk-apps openen (het ene account levert de bevoegdheid, de pin
   het bewijs). Alles achter de leden-inlog van een echt account; het slot
   tegen raden zit in kern/algpin.js. */
module.exports = (kern) => {
  const { app, auth, pinInfo, pinZet, pinCheck } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const echtAccount = (req, res) => {
    if (req.session.tier === 'guest' || !req.session.account) {
      res.status(403).json({ error: 'De algemene pin hoort bij een echt RTG-account.' });
      return false;
    }
    return true;
  };

  app.post('/api/pin/status', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    res.json(pinInfo(req.session.key));
  });
  app.post('/api/pin/zet', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, pinZet(req.session.key, req.body || {}));
  });
  app.post('/api/pin/check', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, pinCheck(req.session.key, (req.body || {}).pin));
  });
};
