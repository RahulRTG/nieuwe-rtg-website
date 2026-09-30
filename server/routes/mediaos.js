/* Domein "mediaos": DE MEDIA OS -- één mediawereld over Klankwerk, Theater,
   Clips en Podium heen. Alles achter de gewone leden-inlog; een gast komt er
   niet in, net als bij de vier apps eronder.

   Er staat hier bewust GEEN kantoorkant. Melden, goedkeuren en verwijderen
   blijven waar ze horen: bij het domein dat het stuk bezit. Een tweede deur
   naar dezelfde handeling is een tweede plek die kan afwijken (LAT.md regel 4),
   en bij moderatie is dat de gevaarlijkste soort. */
module.exports = (kern) => {
  const { app, auth, mediaWereld, mediaStuk, mediaMaker, mediaVolg, mediaMeldZet,
    mediaBieb, mediaBewaar, mediaSmaakVan, mediaSmaakStuur, mediaBord,
    mediaLijsten, mediaLijst, mediaLijstMaak, mediaLijstZet, mediaLijstStuk, mediaLijstDeel,
    mediaSamenStart, mediaSamenNodig, mediaSamenIn, mediaSamenUit, mediaSamenZet, mediaSamenMijn,
    aanwezigVolg, aanwezigMijn, aanwezigMet, aanwezigVolgtHij, aanwezigBeeld } = kern;
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

  /* Afspeellijsten over de vier vormen heen. Een lijst bewaart alleen id's en
     wordt opgelost met de sessie van de LEZER -- er is dus geen weg om via een
     lijst iets binnen te halen wat de wereld u weigert. Veranderen doet alleen
     de eigenaar; delen (hieronder) is LEZEN. */
  app.post('/api/mediaos/lijsten', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaLijsten(sess(req)));
  });
  app.post('/api/mediaos/lijst', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaLijst(sess(req), String((req.body || {}).id || '')));
  });
  app.post('/api/mediaos/lijst/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaLijstMaak(sess(req), req.body || {}));
  });
  app.post('/api/mediaos/lijst/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaLijstZet(sess(req), req.body || {}));
  });
  app.post('/api/mediaos/lijst/stuk', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaLijstStuk(sess(req), req.body || {}));
  });

  /* Een lijst delen: met iemand met wie u verbonden bent, en om te LEZEN. De
     ander lost de stukken op met zijn eigen sessie, dus een gedeelde lijst is
     geen doorgeefluik langs een dichte deur. ASYNC: de gids die een codenaam
     aan een sleutel koppelt is async. */
  app.post('/api/mediaos/lijst/deel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await mediaLijstDeel(sess(req), req.body || {}));
  });

  /* De luisterkamer: samen luisteren of kijken. De kamer deelt de AANWIJZER
     (welk stuk, welke seconde, spelend of stil) en niet het geluid -- iedereen
     speelt af met zijn eigen middelen, en wie het stuk niet mag openen krijgt
     de reden in plaats van een zwart scherm. */
  app.post('/api/mediaos/samen/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaSamenMijn(sess(req)));
  });
  app.post('/api/mediaos/samen/start', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaSamenStart(sess(req), req.body || {}));
  });
  app.post('/api/mediaos/samen/nodig', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await mediaSamenNodig(sess(req), req.body || {}));
  });
  app.post('/api/mediaos/samen/in', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaSamenIn(sess(req), String((req.body || {}).id || '')));
  });
  app.post('/api/mediaos/samen/uit', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaSamenUit(sess(req), String((req.body || {}).id || '')));
  });
  app.post('/api/mediaos/samen/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, mediaSamenZet(sess(req), req.body || {}));
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

  /* ---- DE PUBLIEKE AANWEZIGHEID: één volgrelatie, gedragen door een mens of
     een organisatie (kern/mediaos/aanwezigheid.js).

     VOLGEN IS ALTIJD EXPLICIET. Er is met opzet geen route die iemand volgt als
     gevolg van iets anders -- een kaartje kopen, lid worden, ergens werken of
     merchandise kopen zetten hier niets. Deze POST is de enige weg, en hij komt
     van het lid zelf. */
  app.post('/api/mediaos/aanwezig/volg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!aanwezigVolg) return res.status(503).json({ error: 'Deze laag draait hier niet.' });
    const b = req.body || {};
    stuur(res, aanwezigVolg(sess(req).key, b.id, b.aan !== false));
  });

  /* Wat ik volg, en WAT IK DAARVOOR KRIJG. Dat tweede staat er omdat een
     aanwezigheid meerdere soorten kan uitzenden: wie op volgen drukt zonder te
     zien wat er binnenkomt, activeert ongemerkt vijf kanalen. */
  app.post('/api/mediaos/aanwezig/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!aanwezigMijn) return res.status(503).json({ error: 'Deze laag draait hier niet.' });
    res.json({ ok: true, aanwezigheden: aanwezigMijn(sess(req).key) });
  });

  // één aanwezigheid opzoeken, met of ik hem al volg
  app.post('/api/mediaos/aanwezig', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!aanwezigMet) return res.status(503).json({ error: 'Deze laag draait hier niet.' });
    const a = aanwezigMet((req.body || {}).id);
    if (!a) return res.status(404).json({ error: 'Deze aanwezigheid bestaat niet.' });
    res.json({ ok: true, aanwezigheid: aanwezigBeeld(a), volgIk: aanwezigVolgtHij(sess(req).key, a.id) });
  });

  /* DISCOVERY -- een lid kan een aanwezigheid VINDEN (schakel 2 van de
     momentproef, die hierop openstond).

     ACHTER `auth`, EN DAT IS DE GRENS EN GEEN DETAIL. routes/festival/gast.js
     schrijft het uit: "er is in dit huis geen publieke kant, en een line-up is
     het eerste dat er een van zou maken". Deze route maakt die publieke kant
     dus niet -- zij opent alleen voor LEDEN wat er al publiek is. Zet hier nooit
     een anonieme variant naast zonder dat besluit opnieuw te nemen. */
  app.post('/api/mediaos/aanwezig/zoek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!mediaBord.aanwezigZoek) return res.status(503).json({ error: 'Deze laag draait hier niet.' });
    const b = req.body || {};
    res.json(Object.assign({ ok: true }, mediaBord.aanwezigZoek(sess(req).key, b.q, b.soort)));
  });

  /* DE FAN INBOX -- van de wek terug naar het moment (schakel 5).

     EEN MELDING BLIJFT EEN WEK EN GEEN LINK. Er is met opzet niets aan
     `notify()` veranderd: geen bestemming, geen adres in het bericht. In plaats
     daarvan kan het lid ZELF de tijdlijn openen van wat hij volgt. Dat is de
     scheiding uit STAGE.md par. 3 met beide helften erin -- de wek zegt DAT er
     iets is, dit scherm zegt WAT. */
  app.post('/api/mediaos/momenten', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (!mediaBord.momentenVoor) return res.status(503).json({ error: 'Deze laag draait hier niet.' });
    res.json(Object.assign({ ok: true }, mediaBord.momentenVoor(sess(req).key, (req.body || {}).grens)));
  });
};
