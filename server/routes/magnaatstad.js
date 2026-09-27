/* Magnaat Van Nul, SAMEN IN EEN OUDWIJK (kern/magnaat-leven/stad.js): zes deuren
   voor leden met hun pas. De sleutel komt uit de sessie; de code van de stad uit
   het lijf, en alleen bij het binnenkomen. Naast ./magnaatwereld.js omdat dat
   bestand op de 10 kB-grens staat; zelfde domein, zelfde poort. */
module.exports = (kern) => {
  const { app, auth, geenGast, magnaatWereld } = kern;
  const deur = (werk) => async (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const r = await werk(magnaatWereld.leven.stad, req.session.key, req.body || {});
      if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
      res.json(r);
    } catch (e) { console.error('[magnaat-stad]', e); res.status(500).json({ error: 'De stad kon deze stap niet verwerken.' }); }
  };
  app.post('/api/member/magnaat/stad/staat', auth, deur((s, key) => s.staat(key)));
  app.post('/api/member/magnaat/stad/maak', auth, deur((s, key, b) => s.maak(key, b)));
  app.post('/api/member/magnaat/stad/doe', auth, deur((s, key, b) => s.doe(key, b)));
  app.post('/api/member/magnaat/stad/start', auth, deur((s, key) => s.start(key)));
  app.post('/api/member/magnaat/stad/actie', auth, deur((s, key, b) => s.actie(key, b)));
  app.post('/api/member/magnaat/stad/verlaat', auth, deur((s, key) => s.verlaat(key)));
};
