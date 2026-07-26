/* Domein "clips": RTG Clips, korte verticale video's die alleen op het
   toestel van de maker staan (OPFS); de server relayeert enkel metadata en
   signalen. De ledenkant achter de leden-inlog; melden gaat naar kantoor. */
module.exports = (kern) => {
  const { app, auth, officeAuth, clipsMaak, clipsWeg, clipsAanwezig, clipsSignaal,
    clipsFeed, clipsVolg, clipsReactie, clipsReacties, clipsMeld,
    clipsKnip, clipsOndertitels, clipsGeluid,
    clipsOfficeLijst, clipsOfficeVerwijder } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Clips is voor leden.' }); return true; }
    return false;
  };

  app.post('/api/clips/feed', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsFeed(req.session.key, { alleenOndertiteld: !!(req.body && req.body.alleenOndertiteld) }));
  });
  app.post('/api/clips/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsMaak(req.session.key, req.body || {}));
  });
  app.post('/api/clips/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsWeg(req.session.key, req.body.id));
  });
  app.post('/api/clips/aanwezig', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsAanwezig(req.session.key, req.body.ids));
  });
  app.post('/api/clips/signaal', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsSignaal(req.session.key, req.body.id, String(req.body.kind || ''), req.body.doelKey, req.body.payload));
  });
  app.post('/api/clips/volg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsVolg(req.session.key, req.body.id, req.body.aan !== false));
  });
  app.post('/api/clips/reactie', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsReactie(req.session.key, req.body.id, req.body.tekst));
  });
  app.post('/api/clips/reacties', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsReacties(req.body.id));
  });
  app.post('/api/clips/meld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsMeld(req.session.key, req.body.id, req.body.reden));
  });

  /* ---- de studio: knippen, geluid en ondertitels ----
     Alleen op de eigen clip; de kern toetst dat nog eens op de sleutel uit de
     sessie, zodat een id uit de body niets kan forceren. Het beeld zelf raakt
     RTG nooit aan: een knip is een begin en een eind, geen nieuwe video. */
  app.post('/api/clips/knip', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsKnip(req.session.key, req.body.id, req.body));
  });
  app.post('/api/clips/ondertitels', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsOndertitels(req.session.key, req.body.id, req.body.regels));
  });
  app.post('/api/clips/geluid', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, clipsGeluid(req.session.key, req.body.id, req.body.soort));
  });

  // kantoor: meldingen zien en een kaart weghalen (het beeld stond nooit bij RTG)
  app.post('/api/office/clips', officeAuth, (req, res) => stuur(res, clipsOfficeLijst()));
  app.post('/api/office/clips/verwijder', officeAuth, (req, res) => stuur(res, clipsOfficeVerwijder(req.body.id)));
};
