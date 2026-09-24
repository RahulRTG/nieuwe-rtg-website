/* Magnaat Van Nul (V1 From Zero): een leven per lid, achter de ledenpas.
   Twee deuren -- kijken en handelen -- en de sleutel komt uit de sessie. */
module.exports = (kern) => {
  const { app, auth, geenGast, magnaatWereld } = kern;
  const leven = magnaatWereld.leven;
  const alsLid = (req, res, werk) => {
    if (geenGast(req, res)) return;
    try {
      const r = werk(req.session.key, req.body || {});
      if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
      res.json(r);
    } catch (e) {
      console.error('[magnaat-leven]', e);
      res.status(500).json({ error: 'Van Nul kon deze stap niet verwerken.' });
    }
  };
  app.post('/api/member/magnaat/leven/staat', auth, (req, res) => alsLid(req, res, key => leven.staat(key)));
  app.post('/api/member/magnaat/leven/actie', auth, (req, res) => alsLid(req, res, (key, b) => leven.actie(key, b)));
};
