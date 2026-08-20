/* Auth (deelmodule): INLOGGEN EN UITLOGGEN. De vier routes waarmee een sessie
   ontstaat en weer verdwijnt -- de demo-inlog, uitloggen, de echte accountinlog
   en "wie ben ik".

   Geknipt uit routes/auth.js omdat dat bestand over de leesgrens ging. De
   volgorde blijft: dit wordt aangeroepen op de plek waar de routes stonden,
   VOOR de andere auth-submodules, want in dit huis is de volgorde van
   registreren ook de volgorde van afhandelen.

   De gedeelde stukken (DEMO, pasAppOk, PAS_FOUT, isBaas) komen mee uit
   routes/auth.js en staan daar met de uitleg waarom ze zijn zoals ze zijn. */
module.exports = (ctx) => {
  const { PERSONAS, accounts, app, auth, checkCred, crypto, forgetSession, hasCred, loginFails,
    noteFailedTry, rememberSession, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, isBaas, kern } = ctx;

app.post('/api/login', (req, res) => {
  let tier = String(req.body.tier || '');
  if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Log in met je account.' });
    const bucket = 'demo:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket);
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

app.post('/api/auth/login', async (req, res) => {
  const login = req.body.login || req.body.email || req.body.username;
  const bucket = 'auth:' + req.ip + ':' + String(login || '').toLowerCase().slice(0, 60);
  if (tooManyTries(res, bucket)) return;
  const user = accounts.findByLogin(login);
  if (!user || !await accounts.verifyPassword(req.body.password, user.password_hash)) {
    noteFailedTry(bucket);
    /* HET SPOOR OP DE HOOFDINGANG. logInlog belooft "elke inlogpoging (gelukt of
       mislukt, op elk kanaal)", maar deze route -- de ECHTE accountingang, waar
       een aanval op echte accounts binnenkomt -- liet 102 van de 106 geslaagde
       aanroepen ongelogd. Gemeten op de AUDIT-as, vastgehouden door
       test/inlogspoor.test.js. De mislukte tak is de belangrijkste: zonder deze
       regel is credential stuffing achteraf niet te zien. Ook een onbekend
       login-adres komt hier langs, en juist het aftasten van adressen die niet
       bestaan is het patroon dat het kantoor wil kunnen terugzien. Wat er in
       gaat is `login`, nooit het wachtwoord. */
    logInlog('account', false, login, req);
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
  loginFails.delete(bucket);
  /* Uit dienst gemeld door de organisatie (SCIM) = ook met het juiste wachtwoord
     niet meer naar binnen. verifyToken weigert de sessie toch al, dus zonder
     deze regel zou iemand een token krijgen dat meteen daarna nergens voor
     deugt: verwarrend, en het verbergt de echte reden. */
  if (!accounts.isActief(user)) {
    /* Het wachtwoord klopte, de deur bleef dicht. Dat is een mislukte poging en
       hoort op het bord: iemand probeert binnen te komen op een account dat uit
       dienst is gemeld, en dat is precies iets om terug te kunnen zien. */
    logInlog('account', false, login, req);
    return res.status(403).json({ error: 'Dit account is door uw organisatie op non-actief gezet. Neem contact op met uw beheerder.' });
  }
  // juiste gegevens, maar de verkeerde pas-app: netjes doorverwijzen. De
  // eigenaar mag in alle drie de apps; zie de uitleg bij pasAppOk hierboven.
  if (!isBaas(user) && !pasAppOk(String(req.body.pasApp || ''), user.tier)) {
    logInlog('account', false, login, req);
    return res.status(403).json({ error: PAS_FOUT });
  }
  const token = accounts.issueToken(user.id);
  /* Hier is de inlog een feit: er is een token. Loggen VOOR de werkplek-lus,
     zodat een geslaagde inlog ook een spoor nalaat als daar iets misgaat. */
  logInlog('account', true, login, req);
  const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
  /* Een account voor alles: heeft dit lid een werkplek, dan komt die hier meteen
     mee. Geen tweede inlog en geen pincode -- je bent al wie je bent. Het
     werkvenster van de werkgever bepaalt of de plek open is; een dichte plek komt
     zonder token mee, met de reden erbij, zodat de app hem wel kan tonen. */
  let werk = [];
  try { werk = kern.werkplekkenBijLogin ? kern.werkplekkenBijLogin(user.id, sess.key, req) : []; } catch (e) { werk = []; }
  res.json({ token, state: stateFor(sess, req.body.lang), ...(werk.length ? { werk } : {}) });
});

app.post('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.session.account ? accounts.publicUser(req.session.account) : stateFor(req.session, req.body.lang).user });
});
};
