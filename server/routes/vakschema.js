/* EEN SCHEMA VAN EEN BEVOEGDE VAKMAN (kern/vakschema.js), ledenkant.

   Wat het LID met een voorstel doet staat hier; de vakman stuurt het langs
   routes/supplier/vakschema.js. Die twee staan met opzet uit elkaar, want het
   zijn twee partijen met twee deuren -- en de hele reden dat deze laag bestaat,
   is dat de ene mag wat de andere niet mag (RUGDEKKING.md par. 4.4).

   Er is hier geen route waarmee het lid de VAKMAN iets terugstuurt. Een
   weigering blijft bij het lid: waarom u iets niet wilt, is niet aan de
   afzender. */
module.exports = (kern) => {
  const { app, vakschema, auth } = kern;
  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error })
    : res.json(r);
  const lid = (req, res) => {
    if (!req.session.key) { res.status(403).json({ error: 'Dit is voor leden met een eigen account.' }); return null; }
    return req.session.key;
  };

  app.post('/api/training/voorstellen', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    stuur(res, vakschema.mijn(k));
  });

  app.post('/api/training/voorstel/aanvaard', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    stuur(res, vakschema.aanvaard(k, String((req.body || {}).id || '')));
  });

  app.post('/api/training/voorstel/weiger', auth, (req, res) => {
    const k = lid(req, res); if (!k) return;
    const b = req.body || {};
    stuur(res, vakschema.weiger(k, String(b.id || ''), b.reden));
  });
};
