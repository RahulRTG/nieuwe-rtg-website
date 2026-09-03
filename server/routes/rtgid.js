/* Domein "rtgid": RTG iD, de DigiD-vervanger. De dienst-kant (start,
   status, wie) is de publieke kant van de balie; de app-kant (code
   opzoeken, bevestigen, weigeren, inzage, intrekken, machtigen) zit
   achter de leden-inlog. Gasten hebben geen iD.

   BEVESTIGEN GAAT IN TWEE SLAGEN, en dat is geen omweg maar de hele winst.
   Eerst /stapop/opties: de server geeft een ceremonie uit die aan DEZE koppel
   hangt. Dan /bevestig met de assertie erbij. De eis zelf staat in
   kern/rtgid.js -- deze route levert alleen de origin en de hostnaam, want die
   komen uit het verzoek en mogen nooit uit de body komen: dan zou een
   aanvrager zijn eigen WebAuthn-grens mogen kiezen. */
module.exports = (kern) => {
  const { app, auth, rtgid, appUrl, webauthnStapOpOpties } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; r.error ? res.status(status || 400).json({ error: r.error }) : res.status(200).json(rest); };
  /* WIE HIER BINNEN MAG: iedereen met een EIGEN account, en niet iedereen met
     een betaalde pas.

     Hier stond `tier === 'guest'`, en dat sloot de gratis accounts buiten -- de
     mensen die een echt account hebben, een paspoort kunnen laten keuren en een
     passkey kunnen dragen, maar geen pas hebben gekocht. Precies de groep die
     CONCERN.md bij naam noemt: "een werknemer koopt nooit een pas om te mogen
     werken... met de gratis RTG Pass of een gratis werkidentiteit". Wie zich
     moest identificeren om te MOGEN werken, kreeg te horen dat RTG iD voor
     leden is.

     De echte grens is niet de pas maar het DOSSIER: een anonieme demo-gast
     (sleutel `guest-xxxx`, geen account) heeft niets om mee te bewijzen, en
     kern/rtgid-bevestigen.js weigert die al op eigen kracht. Deze poort zegt nu
     hetzelfde als die laag, in plaats van iets strengers. */
  const eigenAccount = (req, res, next) => {
    if (!req.session.account) return res.status(403).json({
      error: 'RTG iD hoort bij een eigen RTG-account. Een gratis account is genoeg; een demo-gast heeft er geen.' });
    next();
  };
  // In productie komt de WebAuthn-grens uit APP_URL, nooit uit een door de
  // aanvrager te kiezen Origin- of Host-kop; zelfde afspraak als routes/auth/webauthn.js.
  const oorsprong = req => { try { return new URL(appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };

  // de dienst-kant
  app.post('/api/rtgid/start', (req, res) => stuur(res, rtgid.start(req.body || {})));
  app.post('/api/rtgid/status', (req, res) => stuur(res, rtgid.statusVan(req.body.koppelId)));
  app.post('/api/rtgid/wie', (req, res) => stuur(res, rtgid.wie(req.body.idToken)));

  // de app-kant (het lid zelf)
  const lid = [auth, eigenAccount];
  app.post('/api/rtgid/koppel', ...lid, (req, res) => stuur(res, rtgid.koppelZoek(req.session.key, req.body.code)));
  /* De ceremonie voor DEZE koppel. Het account komt uit de sessie en niet uit
     de body: wie een ceremonie aanvraagt, krijgt er een voor zichzelf. */
  app.post('/api/rtgid/stapop/opties', ...lid, async (req, res) => {
    const u = req.session.account;
    if (!u) return res.status(403).json({ error: 'Bevestigen met RTG iD vraagt een passkey, en die hoort bij een eigen RTG-account.' });
    const r = await webauthnStapOpOpties(u, gastheer(req), String(req.body.koppelId || ''));
    /* "U heeft er nog geen" is geen gewone fout: daar hoort een knop bij in
       plaats van een melding. De gedeelde `stuur` laat bij een fout alleen de
       tekst door, dus dat onderscheid wordt hier met de hand doorgegeven. */
    if (r.geenPasskey) return res.status(409).json({ error: r.error, geenPasskey: true });
    stuur(res, r);
  });
  app.post('/api/rtgid/bevestig', ...lid, async (req, res) => stuur(res, await rtgid.bevestig(
    req.session.key, req.body.koppelId, req.body.machtigingId,
    { ceremonie: req.body.ceremonie, antwoord: req.body.antwoord, origin: oorsprong(req), hostnaam: gastheer(req) })));
  app.post('/api/rtgid/weiger', ...lid, (req, res) => stuur(res, rtgid.weiger(req.session.key, req.body.koppelId)));
  app.post('/api/rtgid/inzage', ...lid, (req, res) => stuur(res, rtgid.inzage(req.session.key)));
  app.post('/api/rtgid/intrek', ...lid, (req, res) => stuur(res, rtgid.intrek(req.session.key, req.body.dienst)));
  app.post('/api/rtgid/machtig', ...lid, async (req, res) => stuur(res, await rtgid.machtig(req.session.key, req.body || {})));
  app.post('/api/rtgid/machtig/intrek', ...lid, (req, res) => stuur(res, rtgid.machtigIntrek(req.session.key, req.body.id)));

  /* DE BEWIJSMAP: wat kan ik aantonen, en wat verloopt er.

     De sleutel komt uit de SESSIE en staat niet in het lijf. Dat is geen
     gewoonte maar de grens zelf: deze route geeft per eis ook de REDEN terug
     ("dit is verlopen", "een medewerker heeft het nog niet gezien"), en dat is
     precies de informatie die nuttig is over uzelf en te veel over een ander.
     Zou de sleutel uit het lijf komen, dan was dit een profieluitdraai met een
     invulveld ervoor.

     Er is met opzet geen route die een LIJST bewijzen naar een dienst stuurt.
     Een dienst vraagt per eis om een vinkje via de gewone iD-koppeling
     (`bewijs:vog`); zie kern/rtgid-bewijs.js voor waarom die knip zo scherp is. */
  app.post('/api/rtgid/bewijzen', ...lid, (req, res) => stuur(res, rtgid.mijnBewijzen(req.session.key)));
};
