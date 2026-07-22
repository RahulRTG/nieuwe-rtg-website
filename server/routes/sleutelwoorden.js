/* Routes "sleutelwoorden": het lid stelt (achter de eigen inlog) zijn vier
   sleutelwoorden in, waarmee het daarna via een gesprek met Rahul kan
   inloggen. Instellen kan alleen als je al bent ingelogd; de kluislogica en
   het slot zitten in kern/sleutelwoorden.js. De inlog met de woorden zelf
   loopt via het aanmeldgesprek (voor de inlog, dus met een eigen IP-slot). */
module.exports = (kern) => {
  const { app, auth, swInfo, swZet, swWeg } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  // de sleutelwoorden horen bij een echt account; we sleutelen op het stabiele
  // gebruikers-id, niet op de sessiesleutel
  const echtId = (req, res) => {
    if (req.session.tier === 'guest' || !req.session.account) {
      res.status(403).json({ error: 'Sleutelwoorden horen bij een echt RTG-account.' });
      return null;
    }
    return req.session.account.id;
  };

  app.post('/api/sleutelwoorden/status', auth, (req, res) => {
    const id = echtId(req, res); if (id == null) return;
    res.json(swInfo(id));
  });
  app.post('/api/sleutelwoorden/zet', auth, (req, res) => {
    const id = echtId(req, res); if (id == null) return;
    stuur(res, swZet(id, (req.body || {}).woorden));
  });
  app.post('/api/sleutelwoorden/weg', auth, (req, res) => {
    const id = echtId(req, res); if (id == null) return;
    stuur(res, swWeg(id));
  });
};
