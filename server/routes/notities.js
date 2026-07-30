/* RTG Notities & Taken: het bord van het lid. Delen op codenaam is samen
   werken; de gedeelde kant kan afvinken en aanvullen, vastpinnen en
   archiveren blijft van de eigenaar. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, notities, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account om notities te bewaren.' });
      return true;
    }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/notities/mijn', auth, (req, res) => stuur(res, notities.notitiesLijst(req.session.key)));
  app.post('/api/notities/bewaar', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, notities.notitiesBewaar(req.session.key, req.body || {}));
  });
  app.post('/api/notities/vink', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, notities.notitiesVink(req.session.key, String(req.body.id || ''), req.body.index, req.body.af !== false));
  });
  app.post('/api/notities/deel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await notities.notitiesDeel(req.session.key, String(req.body.id || ''),
      String(req.body.codenaam || ''), req.body.aan !== false));
  });
  app.post('/api/notities/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, notities.notitiesWeg(req.session.key, String(req.body.id || '')));
  });
};
