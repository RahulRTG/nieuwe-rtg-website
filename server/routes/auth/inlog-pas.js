/* Auth (deelmodule): DE PAS-SESSIE -- inloggen op een pas en uitloggen.

   Uit ./inlog.js geknipt op de 10 kB-grens, en op een echte naad: dit gaat over
   een sessie ZONDER account, terwijl ./inlog.js over een echt account gaat --
   met de snelheidsrem, de drie emmers, het inlogspoor en de hash-opwaardering.
   Die kant groeide deze ronde; deze niet.

   De volgorde blijft: ./inlog.js roept dit aan op de plek waar de routes
   stonden, dus /api/login en /api/logout registreren nog steeds voor
   /api/auth/login. In dit huis is de volgorde van registreren ook de volgorde
   van afhandelen. */
'use strict';

module.exports = (ctx) => {
  const { PERSONAS, accounts, app, auth, checkCred, crypto, forgetSession, hasCred, loginFails,
    noteFailedTry, rememberSession, sessions, stateFor, tooManyTries, logInlog, DEMO, pasAppOk , PAS_FOUT } = ctx;

app.post('/api/login', (req, res) => {
  let tier = String(req.body.tier || '');
  if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Log in met je account.' });
    const bucket = 'demo:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket, req.ip);
      logInlog('lid', false, req.body.username, req);
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    loginFails.delete(bucket);
    logInlog('lid', true, req.body.username, req);
    tier = 'business'; // het demo-account is een volledig lidmaatschap
  } else if (tier !== 'guest' && !DEMO) {
    // een pas-tier zonder wachtwoord is alleen voor de demo; gast blijft publiek
    return res.status(403).json({ error: 'Log in met je account.' });
  }
  if (!PERSONAS[tier]) return res.status(400).json({ error: 'Onbekende pas.' });
  if (!pasAppOk(String(req.body.pasApp || ''), tier)) return res.status(403).json({ error: PAS_FOUT });
  const token = crypto.randomBytes(24).toString('hex');
  const sess = { tier, key: tier === 'guest' ? 'guest-' + token.slice(0, 8) : tier };
  rememberSession(token, sess);
  res.json({ token, state: stateFor(sess, req.body.lang) });
});

/* UITLOGGEN MOET OOK ECHT UITLOGGEN.

   Hier stond alleen de lus over `sessions`. Die dekt de demo-sessies, maar een
   ECHT ledenaccount komt via accounts.verifyToken binnen (zie resolveSession in
   server.js) en staat helemaal niet in die map. Voor elk gewoon lid deed
   uitloggen dus niets: het antwoord was { ok: true } en het token bleef daarna
   gewoon werken. Op een geleende of gedeelde computer is dat precies het moment
   waarop iemand denkt veilig te zijn. Gevonden in aanvalsronde 2, punt 14. */
app.post('/api/logout', auth, (req, res) => {
  for (const [token, sess] of sessions) if (sess === req.session) forgetSession(token);
  // en de staatloze kant: het aangeboden token op de intreklijst
  const kop = req.get('authorization') || '';
  const tok = kop.startsWith('Bearer ') ? kop.slice(7) : null;
  if (tok && accounts && typeof accounts.trekIn === 'function') accounts.trekIn(tok);
  res.json({ ok: true });
});


/* "WIE BEN IK", hierheen verhuisd uit ./inlog.js toen dat over de leesgrens ging.
   Hij hoort hier: dit bestand gaat over de levensloop van een sessie -- er een
   openen, er een sluiten, en vragen welke je hebt. Dat is dezelfde vraag in drie
   vormen. */
app.post('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.session.account ? accounts.publicUser(req.session.account) : stateFor(req.session, req.body.lang).user });
});
};
