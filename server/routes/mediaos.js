/* Domein "mediaos": DE MEDIA OS -- één mediawereld over Klankwerk, Theater,
   Clips en Podium heen. Alles achter de gewone leden-inlog; een gast komt er
   niet in, net als bij de vier apps eronder.

   Er staat hier bewust GEEN kantoorkant. Melden, goedkeuren en verwijderen
   blijven waar ze horen: bij het domein dat het stuk bezit. Een tweede deur
   naar dezelfde handeling is een tweede plek die kan afwijken (LAT.md regel 4),
   en bij moderatie is dat de gevaarlijkste soort. */
module.exports = (kern) => {
  const { app, auth, mediaWereld, mediaStuk, mediaMaker, mediaVolg, mediaMeldZet,
    mediaBieb, mediaBewaar, mediaSmaakVan, mediaSmaakStuur, mediaBord } = kern;
  if (!mediaWereld) return;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'De Media OS is voor leden.' }); return true; }
    return false;
  };
  const sess = (req) => req.session;

  // de wereld in één van de drie standen (muziek, kijk, flow) of alles
  app.post('/api/mediaos/wereld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaWereld(sess(req), { modus: String((req.body || {}).modus || 'alles') }));
  });
  /* Drie routes zijn ASYNC, en dat is geen stijl: de gids die een codenaam aan
     een sleutel koppelt is async (met Postgres een geindexeerde opzoeking).
     Wie hier de await vergeet, stuurt een Promise als antwoord de lijn op. */
  // één stuk, met alles wat er echt aan vastzit
  app.post('/api/mediaos/stuk', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await mediaStuk(sess(req), String((req.body || {}).id || '')));
  });
  // één maker: al zijn werk, over de vier vormen heen
  app.post('/api/mediaos/maker', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await mediaMaker(sess(req), String((req.body || {}).codenaam || '')));
  });
  /* Volgen: één knop die in Clips en het Theater tegelijk schrijft. Een
     livekanaal van het Podium kost geld en wordt hier NIET aangeraakt; dat
     blijft een aparte, bewuste stap in het Podium zelf. */
  app.post('/api/mediaos/volg', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await mediaVolg(sess(req), req.body || {}));
  });
  app.post('/api/mediaos/meldingen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaMeldZet(sess(req), req.body || {}));
  });

  // de bibliotheek: het enige wat de Media OS zelf bewaart, naast de smaak
  app.post('/api/mediaos/bieb', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaBieb(sess(req)));
  });
  app.post('/api/mediaos/bewaar', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaBewaar(sess(req), req.body || {}));
  });

  /* De regelaars van het eigen profiel: meer, minder, nooit, verras me, wissen.
     Dit is het hele "algoritme" -- wat u zelf zegt, en niets anders. */
  app.post('/api/mediaos/smaak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaSmaakVan(sess(req)));
  });
  app.post('/api/mediaos/stuur', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaSmaakStuur(sess(req), req.body || {}));
  });

  // het makersbord: één trechter over alle vormen, met erbij wat er NIET geteld wordt
  app.post('/api/mediaos/bord', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaBord(sess(req)));
  });
};
