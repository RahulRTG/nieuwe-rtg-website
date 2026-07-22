/* Domein "geloofbieb": de Geloof & Wijsheid-Bibliotheek van de RTFoundation.
   Achter de gezinscode + het profieltoken, met dezelfde leeftijdspoort als de
   app-bibliotheek: beschermde profielen zien en installeren nooit een thema
   boven hun groep. Gasten (oppas, opa/oma) mogen meekijken maar installeren
   niet. Alle tradities staan als gelijken naast elkaar; de bibliotheek kiest
   nooit partij. */
module.exports = (kern) => {
  const { app, rtf, geloofbieb } = kern;

  function profiel(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    const groep = (sess.p && sess.p.groep) || (sess.kind ? 'kind' : 'volw');
    return { handle: sess.handle, groep, gast: sess.gast };
  }
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/rtf/geloof', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(geloofbieb.overzicht(s.groep));
  });
  app.post('/api/rtf/geloof/catalogus', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(geloofbieb.catalogus(s.groep, req.body || {}));
  });
  app.post('/api/rtf/geloof/installeer', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; de kast vult het gezin zelf.' });
    stuur(res, geloofbieb.installeer(s.handle, s.groep, req.body.id));
  });
  app.post('/api/rtf/geloof/weg', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; de kast vult het gezin zelf.' });
    stuur(res, geloofbieb.verwijder(s.handle, req.body.id));
  });
  app.post('/api/rtf/geloof/mijn', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json({ boeken: geloofbieb.mijnApps(s.handle) });
  });

  // de bibliothecaris, neutraal: raadt echte boeken aan uit alle tradities
  // naast elkaar, kiest nooit partij en bekeert nooit
  app.post('/api/rtf/geloof/ai', async (req, res) => {
    const s = profiel(req, res); if (!s) return;
    try {
      const r = await kern.bibliothecaris.adviseer(String(req.body.vraag || ''), { wereld: 'geloof', groep: s.groep });
      const { status, ...rest } = r;
      res.status(status || 200).json(rest);
    } catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
