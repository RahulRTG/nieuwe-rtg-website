/* RTG Meet: vergaderkamers op codenaam. De server bewaakt wie erin mag en
   geeft WebRTC-seinen door; beeld en geluid lopen peer-to-peer.
   Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, meet, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account om te vergaderen.' });
      return true;
    }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/meet/mijn', auth, (req, res) => stuur(res, meet.meetMijn(req.session.key)));
  app.post('/api/meet/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, meet.meetMaak(req.session.key, req.body || {}));
  });
  app.post('/api/meet/kom', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, meet.meetKom(req.session.key, String((req.body || {}).code || '')));
  });
  app.post('/api/meet/verlaat', auth, (req, res) =>
    stuur(res, meet.meetVerlaat(req.session.key, String((req.body || {}).id || ''))));
  app.post('/api/meet/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, meet.meetWeg(req.session.key, String((req.body || {}).id || '')));
  });
  app.post('/api/meet/sein', auth, (req, res) =>
    stuur(res, meet.meetSein(req.session.key, req.body || {})));
};
