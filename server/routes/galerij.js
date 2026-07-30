/* RTG Galerij: de tijdlijn leest De Salon en RTG Bestanden; albums en
   favorieten zijn een eigen, lichte laag van verwijzingen. Altijd-aan. */
module.exports = (kern) => {
  const { app, galerij, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account voor een eigen galerij.' });
      return true;
    }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/galerij/mijn', auth, (req, res) => stuur(res, galerij.galerijMijn(req.session.key)));
  app.post('/api/galerij/album', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, galerij.galerijAlbum(req.session.key, req.body || {}));
  });
  app.post('/api/galerij/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, galerij.galerijZet(req.session.key, req.body || {}));
  });
  app.post('/api/galerij/favoriet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, galerij.galerijFavoriet(req.session.key, req.body || {}));
  });
};
