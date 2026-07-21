/* Domein "rtfschool": de School-Bibliotheek (10.000 apps per leeftijdsgroep)
   en Samen voor de gezinsapps. Achter de gezinscode + het profieltoken; de
   leeftijdsgroep van het profiel is de poort. Gasten kijken mee in de
   bibliotheek maar installeren niet, en doen niet mee met Samen. */
module.exports = (kern) => {
  const { app, rtf, schoolbieb, samenRtf, beroepenbieb } = kern;

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

  /* ---- de Beroepen-Bibliotheek: twee werelden van een miljoen leer-apps
     (technisch/agrarisch en het bedrijfsleven), altijd gratis. Iedereen in
     het gezin mag kijken; installeren doet het gezin zelf (geen gasten). ---- */
  app.post('/api/rtf/beroepen', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(beroepenbieb.overzicht());
  });
  app.post('/api/rtf/beroepen/catalogus', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    const r = beroepenbieb.catalogus(String(req.body.wereld || ''), req.body || {});
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/rtf/beroepen/installeer', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, beroepenbieb.installeer(s.handle, req.body.id));
  });
  app.post('/api/rtf/beroepen/weg', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, beroepenbieb.verwijder(s.handle, req.body.id));
  });
  app.post('/api/rtf/beroepen/mijn', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json({ apps: beroepenbieb.mijnApps(s.handle) });
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

  /* ---- Rahul voor het gezin: de kindveilige vraagbaak op elke RTF-pagina.
     Antwoordt op het niveau van de leeftijdsgroep, belooft nooit toegang of
     aankopen, en verwijst bij zware onderwerpen naar een vertrouwde grote.
     Zonder API-sleutel een warm demo-antwoord; met sleutel echte AI. ---- */
  const rahulTellers = new Map(); // handle -> [timestamps], simpele uurgrens
  app.post('/api/rtf/rahul', async (req, res) => {
    const s = profiel(req, res); if (!s) return;
    const q = String(req.body.q || '').trim().slice(0, 400);
    if (!q) return res.status(400).json({ error: 'Stel eerst een vraag.' });
    const nu = Date.now();
    const rij = (rahulTellers.get(s.handle) || []).filter(t => nu - t < 3600000);
    if (rij.length >= 30) return res.status(429).json({ error: 'Even pauze; over een uurtje kan Rahul weer verder met je.' });
    rij.push(nu); rahulTellers.set(s.handle, rij);
    if (rahulTellers.size > 5000) rahulTellers.delete(rahulTellers.keys().next().value);
    const { anthropic } = kern;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 350,
          system: 'Je bent Rahul, de vriendelijke hulp in de RTFoundation-gezinsapp. Antwoord kort, warm en kindveilig. ' +
            'Regels: beloof nooit toegang, aankopen of afspraken; alles in de app is gratis. Bij zware onderwerpen (verdriet, pesten, onveilig thuis) ' +
            'wijs je liefdevol naar een vertrouwde volwassene en naar de Steun- of Veilig-pagina in de app. Geen medisch of juridisch advies. ' +
            (rtf.leeftijdInstr ? rtf.leeftijdInstr(s.groep || 'kind') : ''),
          messages: [{ role: 'user', content: q }] });
        const uit = (r.content || []).map(b => b.text || '').join('').trim();
        if (uit) return res.json({ antwoord: uit });
      } catch (e) { /* val terug op het demo-antwoord */ }
    }
    // demoterugval: warm, eerlijk over wat Rahul hier wel en niet kan
    const laag = q.toLowerCase();
    let antwoord;
    if (/verdriet|bang|pest|alleen|onveilig|thuis/.test(laag)) {
      antwoord = 'Wat goed dat je dit vraagt. Dit is iets om samen met een grote te bekijken die je vertrouwt. In de app staan ook de pagina\'s Steun voor jou en Veilig thuis; daar vind je wie je altijd mag bellen.';
    } else if (/leren|leer|school|toets|huiswerk|woordjes|rekenen|lezen|studie/.test(laag)) {
      antwoord = 'Goede vraag! Kijk eens bij Leren of de School-Bibliotheek in de app: daar kun je oefenen op jouw niveau. En onthoud: elke dag een kwartiertje werkt beter dan één keer heel lang.';
    } else {
      antwoord = 'Leuk dat je het vraagt! Kijk eens bij de tegels op het startscherm; grote kans dat er een app is die je hierbij helpt. Kom je er niet uit, vraag dan een grote even mee te kijken.';
    }
    res.json({ antwoord, demo: true });
  });
};
