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

  /* Eenmalig, niet per verzoek: de emmernaam van een doel wordt gehasht zodat
     een e-mailadres nooit in het geheugen van de rem of in een
     beveiligingsmelding belandt. Zelfde vorm als routes/auth/webauthn.js. */
  const vingerafdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex').slice(0, 24);

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
  const sleutel = String(login || '').toLowerCase().trim();
  /* DRIE REMMEN, WANT EEN EMMER OP IP+ACCOUNT REMT MAAR EEN SOORT AANVAL.

     Hier stond alleen de eerste. Die stopt tien gokken van EEN adres op EEN
     account, en dat is precies wat een aanvaller met meer dan een adres
     omzeilt: veertig adressen op hetzelfde account zijn veertig verse emmers.
     Gemeten op de stand van hiervoor: veertig gokken, nul remmen, en het echte
     wachtwoord werkte daarna nog gewoon.

     De passkey-kant (routes/auth/webauthn.js) deed dit al goed met een bron- en
     een doelemmer; de wachtwoordkant liep achter. Nu dezelfde vorm, inclusief
     het hashen van het doel: zo belandt een e-mailadres nooit in het geheugen
     van de rem of in een beveiligingsmelding -- dat is dezelfde regel als de
     codenamen elders in dit huis.

     De grenzen lopen uiteen naar de schade die een onterecht slot aanricht.
     IP+account raakt alleen de aanvaller (10). De bron alleen kan een kantoor
     achter een NAT-adres treffen, dus die staat ruim (50).

     EN HET DOEL KRIJGT GEEN SLOT MAAR EEN VERTRAGING. Een slot op het account
     zou een vreemde de macht geven om een lid uit zijn eigen account te houden:
     vijfentwintig gokken verbranden en de eigenaar staat buiten. Gemeten toen
     die emmer nog een slot was: na de aanval gaf het JUISTE wachtwoord een 429.
     Dat is de aanval helpen in plaats van hem stoppen.

     Dus kost elke MISLUKTE poging op een aangevallen account twee seconden, en
     verandert er voor de eigenaar niets: wie het wachtwoord weet, komt zonder
     vertraging binnen. Voor de aanvaller zakt het tempo naar een gok per twee
     seconden per account, boven op de tien per adres en de vijftig per bron. */
  const bucket = 'auth:' + req.ip + ':' + sleutel.slice(0, 60);
  const bronBucket = 'auth:bron:' + req.ip;
  const doelBucket = 'auth:doel:' + vingerafdruk('account:' + sleutel);
  if (tooManyTries(res, bucket) || tooManyTries(res, bronBucket)) return;
  const user = accounts.findByLogin(login);
  if (!user || !await accounts.verifyPassword(req.body.password, user.password_hash)) {
    noteFailedTry(bucket);
    noteFailedTry(bronBucket, 50);
    noteFailedTry(doelBucket, 25);
    const doel = loginFails.get(doelBucket);
    if (doel && doel.until > Date.now()) await new Promise(r => setTimeout(r, 2000));
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
  loginFails.delete(bucket); loginFails.delete(bronBucket); loginFails.delete(doelBucket);
  /* Uit dienst gemeld door de organisatie (SCIM) = ook met het juiste wachtwoord
     niet meer naar binnen. verifyToken weigert de sessie toch al, dus zonder
     deze regel zou iemand een token krijgen dat meteen daarna nergens voor
     deugt: verwarrend, en het verbergt de echte reden. */
  if (!accounts.isActief(user)) return res.status(403).json({ error: 'Dit account is door uw organisatie op non-actief gezet. Neem contact op met uw beheerder.' });
  // juiste gegevens, maar de verkeerde pas-app: netjes doorverwijzen. De
  // eigenaar mag in alle drie de apps; zie de uitleg bij pasAppOk hierboven.
  if (!isBaas(user) && !pasAppOk(String(req.body.pasApp || ''), user.tier)) return res.status(403).json({ error: PAS_FOUT });
  const token = accounts.issueToken(user.id);
  /* Laag 2: hoe hard en hoe vers is deze sessie ontstaan. Zes deuren geven een
     sessie uit en ze horen het alle zes hetzelfde te noteren, dus staat de
     regel in de fabric zelf (kern/vertrouwen/). Er staat GEEN try omheen: hier
     zat er ooit een, de domeingrens hield de aanroep tegen, de catch slikte dat
     op, en de inlog bleef vrolijk slagen terwijl laag 2 volledig stilstond.
     test/vertrouweninlog.test.js kijkt in de opslag of er echt iets staat. */
  kern.vertrouwen.noteerInlog(req, token, user.id, 'wachtwoord');
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
