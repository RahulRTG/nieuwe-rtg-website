/* Domein "theater": RTG Theater, de videobibliotheek op bioscoopniveau.
   Ledenkant achter de gewone inlog; de bytes gaan rauw over de lijn (upload)
   en rauw terug (range-streaming), zodat er nergens kwaliteit verloren gaat.
   De kanaal-goedkeuring en meldingen liggen bij kantoor: een mens beslist. */
const fs = require('fs');

module.exports = (kern) => {
  const { app, express, auth, officeAuth, resolveSession,
    theaterKanaalMaak, theaterOfficeLijst, theaterOfficeBeslis, theaterVideoMaak,
    theaterVideoUpload, theaterVerwijder, theaterStreamVan, theaterZaal,
    theaterAbonneer, theaterReactie, theaterReacties, theaterMeld,
    theaterThuisAanwezig, theaterSignaal } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Het Theater is voor leden.' }); return true; }
    return false;
  };
  /* Altijd-aan rem op de twee routes die de schijf raken (los van de brede
     productie-IP-rem): kijken ruim (spoelen vuurt tientallen range-verzoeken
     per minuut, dat moet gewoon kunnen), uploaden strak. */
  const rem = require('../rem');
  const kijkRem = rem({ windowMs: 60000, limit: 240,
    handler: (req, res) => res.status(429).end() });
  const uploadRem = rem({ windowMs: 60000, limit: 12,
    handler: (req, res) => res.status(429).json({ error: 'Even rustig aan met uploaden; probeer het over een minuut opnieuw.' }) });

  // de zaal: chronologisch, abonnementen eerst; geen algoritme, geen autoplay
  app.post('/api/theater/zaal', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterZaal(req.session.key));
  });
  app.post('/api/theater/kanaal/aanmeld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterKanaalMaak(req.session.key, req.body || {}));
  });
  app.post('/api/theater/video/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterVideoMaak(req.session.key, req.body || {}));
  });
  // de bytes: rauw binnen, exact zo bewaard (geen hercompressie, tot 4K)
  app.post('/api/theater/upload/:id', uploadRem, auth, express.raw({ type: () => true, limit: '420mb' }), (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterVideoUpload(req.session.key, String(req.params.id || ''), req.body));
  });
  app.post('/api/theater/verwijder', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterVerwijder(req.session.key, String(req.body.id || ''), false));
  });
  app.post('/api/theater/abonneer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterAbonneer(req.session.key, String(req.body.kanaalId || ''), req.body.aan !== false));
  });
  app.post('/api/theater/reactie', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterReactie(req.session.key, String(req.body.id || ''), req.body.tekst));
  });
  app.post('/api/theater/reacties', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterReacties(req.body.id));
  });
  app.post('/api/theater/meld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterMeld(req.session.key, String(req.body.id || ''), req.body.reden));
  });

  /* Het Thuisarchief: de maker meldt zich aanwezig voor zijn eigen werk
     (kort houdbaar), en het kijken loopt via een puur signaal-doorgeefluik:
     de videobytes reizen rechtstreeks van maker naar kijker (WebRTC) en
     passeren deze server nooit. */
  app.post('/api/theater/thuis/aanwezig', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterThuisAanwezig(req.session.key, req.body.ids));
  });
  app.post('/api/theater/signaal', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterSignaal(req.session.key, String(req.body.id || ''), String(req.body.kind || ''), req.body.doelKey, req.body.payload));
  });

  /* Kijken: het video-element kan geen Authorization-header sturen, dus de
     sessie komt als ?token= mee (zelfde patroon als /api/stream). Met een
     Range-header komt precies het gevraagde stuk terug (206): soepel spoelen,
     byte voor byte het origineel. */
  app.get('/api/theater/kijk/:id', kijkRem, (req, res) => {
    const sess = resolveSession(req.query.token);
    if (!sess || sess.tier === 'guest') return res.status(401).end();
    const v = theaterStreamVan(String(req.params.id || ''));
    if (!v) return res.status(404).end();
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, v.bytes - Number(range[2]));
      const eind = range[1] && range[2] ? Math.min(Number(range[2]), v.bytes - 1) : v.bytes - 1;
      if (!(start >= 0 && start <= eind)) return res.status(416).setHeader('Content-Range', 'bytes */' + v.bytes).end();
      res.writeHead(206, { 'Content-Type': v.type, 'Accept-Ranges': 'bytes',
        'Content-Length': eind - start + 1, 'Content-Range': 'bytes ' + start + '-' + eind + '/' + v.bytes });
      return fs.createReadStream(v.pad, { start, end: eind }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': v.type, 'Accept-Ranges': 'bytes', 'Content-Length': v.bytes });
    fs.createReadStream(v.pad).pipe(res);
  });

  // de kantoorkant: kanalen goedkeuren, meldingen zien, verwijderen
  app.post('/api/office/theater', officeAuth, (req, res) => {
    res.json(theaterOfficeLijst());
  });
  app.post('/api/office/theater/beslis', officeAuth, (req, res) => {
    stuur(res, theaterOfficeBeslis(String(req.body.id || ''), String(req.body.besluit || '')));
  });
  app.post('/api/office/theater/verwijder', officeAuth, (req, res) => {
    stuur(res, theaterVerwijder(null, String(req.body.id || ''), true));
  });
};
