/* RTG Bestanden: de kluis van het lid. Uploaden binnen het quotum, mappen,
   delen op codenaam (de ander haalt op en zet nieuwe versies), versies en
   de prullenbak als zichtbare la. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, bestanden, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account om bestanden te bewaren.' });
      return true;
    }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/bestanden/mijn', auth, (req, res) => stuur(res, bestanden.bestandenLijst(req.session.key)));
  app.post('/api/bestanden/map', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, b.id ? bestanden.bestandenMapWijzig(req.session.key, String(b.id), b)
      : bestanden.bestandenMapNieuw(req.session.key, b.naam, b.ouder));
  });
  app.post('/api/bestanden/upload', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, b.id ? bestanden.bestandenVersieNieuw(req.session.key, String(b.id), b.dataUrl)
      : bestanden.bestandenUpload(req.session.key, b));
  });
  // grote bestanden: in stukken (de globale JSON-grens is 8 MB)
  app.post('/api/bestanden/upstart', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenUpStart(req.session.key, req.body || {}));
  });
  app.post('/api/bestanden/updeel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenUpDeel(req.session.key, (req.body || {}).uploadId, (req.body || {}).stuk));
  });
  app.post('/api/bestanden/upklaar', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenUpKlaar(req.session.key, (req.body || {}).uploadId));
  });
  app.post('/api/bestanden/wijzig', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenWijzig(req.session.key, String((req.body || {}).id || ''), req.body || {}));
  });
  app.post('/api/bestanden/deel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await bestanden.bestandenDeel(req.session.key, String((req.body || {}).id || ''),
      String((req.body || {}).codenaam || ''), (req.body || {}).aan !== false));
  });
  app.post('/api/bestanden/haal', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, bestanden.bestandenHaal(req.session.key, String(b.id || ''), b.versie == null ? null : b.versie));
  });
  app.post('/api/bestanden/versies', auth, (req, res) =>
    stuur(res, bestanden.bestandenVersies(req.session.key, String((req.body || {}).id || ''))));
  app.post('/api/bestanden/versieterug', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenVersieTerug(req.session.key, String((req.body || {}).id || ''), (req.body || {}).n));
  });
  app.post('/api/bestanden/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenWeg(req.session.key, String((req.body || {}).id || '')));
  });
  app.post('/api/bestanden/herstel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenHerstel(req.session.key, String((req.body || {}).id || '')));
  });
  app.post('/api/bestanden/leeg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, bestanden.bestandenLeegPrullenbak(req.session.key));
  });
};
