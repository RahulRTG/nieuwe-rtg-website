/* Domein "rtfschool": de School-Bibliotheek (10.000 apps per leeftijdsgroep)
   en Samen voor de gezinsapps. Achter de gezinscode + het profieltoken; de
   leeftijdsgroep van het profiel is de poort. Gasten kijken mee in de
   bibliotheek maar installeren niet, en doen niet mee met Samen. */
module.exports = (kern) => {
  const { app, rtf, schoolbieb, samenRtf } = kern;

  function profiel(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    sess.groep = (sess.p && sess.p.groep) || (sess.kind ? 'kind' : 'volw');
    return sess;
  }
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  /* ---- de School-Bibliotheek ---- */
  app.post('/api/rtf/school', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(schoolbieb.overzicht(s.groep));
  });
  app.post('/api/rtf/school/catalogus', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(schoolbieb.catalogus(s.groep, req.body || {}));
  });
  app.post('/api/rtf/school/installeer', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, schoolbieb.installeer(s.handle, s.groep, req.body.id));
  });
  app.post('/api/rtf/school/weg', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, schoolbieb.verwijder(s.handle, req.body.id));
  });
  app.post('/api/rtf/school/mijn', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json({ apps: schoolbieb.mijnApps(s.handle) });
  });

  /* ---- Samen door de gezinsapps ---- */
  const samenSess = (req, res) => {
    const s = profiel(req, res); if (!s) return null;
    if (s.gast) { res.status(403).json({ error: 'Samen is voor het gezin en vrienden; als gast kijk je gewoon mee over de schouder.' }); return null; }
    return s;
  };
  app.post('/api/rtf/samen/maak', (req, res) => { const s = samenSess(req, res); if (!s) return; stuur(res, samenRtf.maak(s)); });
  app.post('/api/rtf/samen/mee', (req, res) => { const s = samenSess(req, res); if (!s) return; stuur(res, samenRtf.doeMee(s, req.body.kamercode)); });
  app.post('/api/rtf/samen/zet', (req, res) => { const s = samenSess(req, res); if (!s) return; stuur(res, samenRtf.zet(s, req.body.kamercode, req.body.pad, req.body.titel)); });
  app.post('/api/rtf/samen/chat', (req, res) => { const s = samenSess(req, res); if (!s) return; stuur(res, samenRtf.chat(s, req.body.kamercode, req.body.tekst)); });
  app.post('/api/rtf/samen/weg', (req, res) => { const s = samenSess(req, res); if (!s) return; stuur(res, samenRtf.weg(s, req.body.kamercode)); });
  app.post('/api/rtf/samen/staat', (req, res) => { const s = samenSess(req, res); if (!s) return; stuur(res, samenRtf.staat(s, req.body.kamercode)); });
};
