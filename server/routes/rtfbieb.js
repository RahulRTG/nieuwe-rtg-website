/* Domein "rtfbieb": de App-Bibliotheek van de RTFoundation. Achter de
   gezinscode + het profieltoken, met de leeftijdspoort van het profiel:
   beschermde profielen zien en installeren nooit iets boven hun groep.
   Gasten (oppas, opa/oma) mogen meekijken maar installeren niet. */
module.exports = (kern) => {
  const { app, rtf, rtfbieb } = kern;

  function profiel(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    const groep = (sess.p && sess.p.groep) || (sess.kind ? 'kind' : 'volw');
    return { handle: sess.handle, groep, gast: sess.gast };
  }
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/rtf/bieb', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(rtfbieb.overzicht(s.groep));
  });
  app.post('/api/rtf/bieb/catalogus', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(rtfbieb.catalogus(s.groep, req.body || {}));
  });
  app.post('/api/rtf/bieb/installeer', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, rtfbieb.installeer(s.handle, s.groep, req.body.id));
  });
  app.post('/api/rtf/bieb/weg', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, rtfbieb.verwijder(s.handle, req.body.id));
  });
  app.post('/api/rtf/bieb/mijn', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json({ apps: rtfbieb.mijnApps(s.handle) });
  });
};
