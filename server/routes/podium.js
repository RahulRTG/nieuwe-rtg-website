/* Domein "podium": RTG Podium, het eigen live-kanaal. Ledenkant (kanalen zien,
   kijken, chatten, cadeautjes en abonnementen via RTG Pay) achter de gewone
   leden-inlog; de goedkeuring van nieuwe kanalen en de meldingen achter de
   kantoor-inlog, want een mens beslist wie mag uitzenden. */
module.exports = (kern) => {
  const { app, auth, officeAuth, podiumKanalen, podiumKanaalMaak, podiumKanaalZet, podiumMijn,
    podiumLiveZet, podiumKijk, podiumWeg, podiumSignaal, podiumChatStuur, podiumCadeau,
    podiumAbonneer, podiumBlokkeer, podiumMeld, podiumOfficeLijst, podiumOfficeBeslis } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error, mag: r.mag }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Het Podium is voor leden.' }); return true; }
    return false;
  };

  // de zaal in: kanalen (live eerst), de cadeaucatalogus en het eigen kanaal
  app.post('/api/podium/kanalen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumKanalen(req.session.key));
  });
  app.post('/api/podium/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumMijn(req.session.key));
  });
  // een kanaal aanmelden; open pas na goedkeuring door RTG-kantoor
  app.post('/api/podium/kanaal/aanmeld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumKanaalMaak(req.session.key, req.body || {}));
  });
  app.post('/api/podium/kanaal/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumKanaalZet(req.session.key, req.body || {}));
  });
  // live aan/uit (alleen een goedgekeurd kanaal)
  app.post('/api/podium/live', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumLiveZet(req.session.key, req.body.aan === true, req.body));
  });
  // meekijken, weggaan en het WebRTC-doorgeefluik
  app.post('/api/podium/kijk', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumKijk(req.session.key, String(req.body.id || '')));
  });
  app.post('/api/podium/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumWeg(req.session.key, String(req.body.id || '')));
  });
  app.post('/api/podium/signaal', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumSignaal(req.session.key, String(req.body.id || ''), req.body.doelKey, String(req.body.kind || ''), req.body.payload));
  });
  // de kanaalchat, cadeautjes en het maandabonnement (RTG Pay, idempotent)
  app.post('/api/podium/chat', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumChatStuur(req.session.key, String(req.body.id || ''), req.body.tekst));
  });
  app.post('/api/podium/cadeau', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await podiumCadeau(req.session.key, String(req.body.id || ''), String(req.body.cadeau || ''), req.body.idem));
  });
  app.post('/api/podium/abonneer', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await podiumAbonneer(req.session.key, String(req.body.id || ''), req.body.idem));
  });
  // veiligheid in de zaal: de maker blokkeert, iedereen kan melden
  app.post('/api/podium/blokkeer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumBlokkeer(req.session.key, String(req.body.id || ''), req.body.key, req.body.aan !== false));
  });
  app.post('/api/podium/meld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, podiumMeld(req.session.key, String(req.body.id || ''), req.body.reden));
  });

  // de kantoorkant: wachtende kanalen goedkeuren of weigeren, meldingen zien
  app.post('/api/office/podium', officeAuth, (req, res) => {
    res.json(podiumOfficeLijst());
  });
  app.post('/api/office/podium/beslis', officeAuth, (req, res) => {
    stuur(res, podiumOfficeBeslis(String(req.body.id || ''), String(req.body.besluit || '')));
  });
};
