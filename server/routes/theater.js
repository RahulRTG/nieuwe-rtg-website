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
    theaterThuisAanwezig, theaterSignaal, theaterOndertitels, theaterZaakMaak, theaterZaakZaal,
    theaterKijkplichtZet, theaterKijkplichtGedaan, theaterKijkplichtMijn, theaterKijkplichtStand,
    theaterHuisstijl, sessiestroom } = kern;
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
  /* De ondertitels van een video. Zelfde deur als video/maak: een lid met een
     sessie, geen gast. Wie er werkelijk aan mag komen (de maker) beslist de
     kern -- dat is een eigendomsvraag en geen routevraag. */
  app.post('/api/theater/ondertitels', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterOndertitels(req.session.key, String((req.body || {}).id || ''), (req.body || {}).regels));
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

  /* Kijken: het video-element kan geen Authorization-header sturen. De sessie
     stond daarom als ?token= in het adres; nu ruilt het scherm hem eerst voor
     een KIJKTICKET (POST /api/stroom/ticket, stroom `theater-kijk`, id = de
     video) en staat alleen dat ticket in het adres. Een <video> vraagt
     hetzelfde adres meerdere keren op (laden, spoelen: Range-verzoeken), dus dit
     ticket is niet eenmalig maar BEGRENSD: vijf minuten, een geteld aantal
     openingen, en alleen voor DEZE video van DEZE sessie -- en bij elke opening
     wordt de sessie opnieuw getoetst. Een volledig token in ?token= krijgt 401.
     Met een Range-header komt precies het gevraagde stuk terug (206): soepel
     spoelen, byte voor byte het origineel. */
  /* Het ticket vraagt alleen een LEDENsessie; of deze video voor dit lid
     bestaat beslist de deur zelf bij het openen (404, zoals altijd) -- zo
     verraadt de ruil niet welke ids er zijn. */
  const kijkSessie = (raw) => {
    const sess = resolveSession(raw);
    return sess && sess.tier !== 'guest' ? sess : null;
  };
  sessiestroom.soort('theater-kijk', { geldig: raw => !!kijkSessie(raw), metBij: true,
    geldigMs: 5 * 60000, maxGebruik: 600 });
  app.get('/api/theater/kijk/:id', kijkRem, async (req, res) => {
    if (req.query.token !== undefined) return res.status(401).end();
    const id = String(req.params.id || '');
    const uit = await sessiestroom.open('theater-kijk', req.query.ticket, id);
    if (!uit.ok) return res.status(uit.status || 401).end();
    const sess = kijkSessie(uit.token);
    if (!sess) return res.status(401).end();
    const v = theaterStreamVan(id, sess.key);
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

  /* Media for Business, opgenomen kant: de interne bibliotheek van een
     organisatie. Wie er werkt kijkt; wie er niet werkt komt er niet in, ook
     niet met het id -- en de bytes-route vraagt het opnieuw. */
  app.post('/api/theater/zaak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterZaakZaal(req.session.key));
  });
  app.post('/api/theater/zaak/aanmeld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterZaakMaak(req.session.key, req.body || {}));
  });

  /* De huisstijl van de interne wereld: naam, payoff, kleur, thema en logo van
     de organisatie. Binnen HAAR eigen blok -- de rest van de app blijft van
     RTG, en een eigen domein bestaat hier niet (kern/theater/huisstijl.js). */
  app.post('/api/theater/huisstijl', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterHuisstijl(req.session.key, req.body || {}));
  });

  /* Wat uw werk u vraagt te bekijken. De medewerker tekent ZELF af; er wordt
     geen kijkgedrag gemeten, en beide kanten lezen dezelfde lijst. */
  app.post('/api/theater/kijkplicht/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterKijkplichtMijn(req.session.key));
  });
  app.post('/api/theater/kijkplicht/gedaan', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterKijkplichtGedaan(req.session.key, req.body || {}));
  });
  app.post('/api/theater/kijkplicht/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterKijkplichtZet(req.session.key, req.body || {}));
  });
  app.post('/api/theater/kijkplicht/stand', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, theaterKijkplichtStand(req.session.key, String((req.body || {}).zaakCode || '')));
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
