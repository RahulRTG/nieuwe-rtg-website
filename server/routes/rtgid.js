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
  const geenGast = (req, res, next) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'RTG iD is voor leden.' });
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
  const lid = [auth, geenGast];
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
};
