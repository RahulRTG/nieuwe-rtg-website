/* Domein "auth" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog, automatisering } = kern;
  /* Demo-inlog (snelle pas-login zonder wachtwoord, en het demo-account): UIT,
     tenzij RTG_DEMO=1 uitdrukkelijk aanstaat. Echte leden loggen in via
     /api/auth/login.

     TWEE VLAGGEN MET DEZELFDE NAAM, EN DAT WAS DE VAL. In server/server.js
     stond dezelfde `DEMO` en die is hier gerepareerd; deze tweede bleef op
     `!PRODUCTION` staan. Een toets vond het meteen: met de demo-stand uit gaf
     POST /api/login {"tier":"business"} nog steeds een volledige sessie op naam
     van de eigenaar. Twee bronnen voor dezelfde waarheid betekent dat je er een
     kunt repareren en denken dat je klaar bent. */
  const DEMO = process.env.RTG_DEMO === '1';

  /* Elke pas heeft zijn eigen app (app.html?pas=...). De inloggegevens werken
     echt alleen in de app van de eigen pas: een Business-account komt de
     Lifestyle-app niet in, en andersom. De gratis laag (gast) heeft geen eigen
     app en speelt mee in de RTG-app, met minder functies. Er is geen brede
     leden-app meer; zonder pasApp (directe API-koppelingen en tests) blijft
     elke pas werken. */
  /* DE EIGENAAR LOOPT LANGS DE PAS-CONTROLE.

     Die controle bestaat om leden in de app van hun eigen pas te houden: een
     Business-account komt de Lifestyle-app niet in, en andersom. Voor de
     eigenaar slaat dat nergens op -- hij bouwt ze alle drie, moet ze alle drie
     kunnen laten zien, en zijn eigen account draagt nu eenmaal maar een pas.
     Zonder deze uitzondering wees zijn eigen huis hem de deur.

     Het is geen gat: eigenaar zijn hangt aan het e-mailadres uit de
     identiteitskluis (server/eigenaar.js), niet aan een veld in het verzoek.
     Wie geen eigenaar is, merkt van deze regel niets. */
  const eigenaar = require('../eigenaar');
  const isBaas = (user) => { try { return eigenaar.isEigenaar(accounts, user); } catch (e) { return false; } };

  function pasAppOk(pasApp, tier) {
    if (!['rtg', 'lifestyle', 'business'].includes(pasApp)) return true; // brede app
    if (pasApp === 'rtg') return tier === 'rtg' || tier === 'guest';
    return tier === pasApp;
  }
  const PAS_FOUT = 'Deze inloggegevens horen bij een andere pas. Open de app van uw eigen pas via rtg.example/apps.';
  // e-maillinks (bevestigen/herstellen) landen in de pas-app van het account
  const pasAppVan = (tier) => tier === 'lifestyle' || tier === 'business' ? tier : 'rtg';
  /* DE HERSTEL-LINK IN HET ANTWOORD: UIT, TENZIJ IEMAND HEM BEWUST AANZET.

     Zonder SMTP geeft deze route de herstel-link en de telefooncode terug in het
     antwoord, zodat de stroom lokaal en in toetsen te doorlopen is. Dat hing aan
     `!PRODUCTION && !mail.configured` -- twee dingen die WAAR zijn zodra iemand
     iets vergeet. Op de echte server was NODE_ENV niet gezet en was er geen post
     ingesteld, en die server staat op het open internet: een POST met een
     willekeurig adres leverde de link EN de code op. Elk account was daarmee over
     te nemen, de eigenaar incluis. Nagemeten met een curl van buiten.

     De reparatie erna was OOK fout, en dat is het leerzame deel: ik hing hem aan
     "het verzoek moet van deze machine komen". Maar de gateway (server/trio.js)
     stuurt alles lokaal door, dus de server ziet ELK verzoek als lokaal. Van
     buiten gemeten bleef het gat wagenwijd open. Een controle die je niet van
     buitenaf naprikt, is een aanname.

     Nu staat het om: alleen met RTG_DEV_LINKS=1 komen die velden mee. Uit is de
     stand die je krijgt als je niets doet, en dat is de enige stand die veilig
     mag zijn. De toetshelper zet hem, dus toetsen merken niets. Een echte server
     zet hem niet, en dan is er niets te vergeten. */
  const DEV_VELDEN = () => process.env.RTG_DEV_LINKS === '1';

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
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
  loginFails.delete(bucket);
  /* Uit dienst gemeld door de organisatie (SCIM) = ook met het juiste wachtwoord
     niet meer naar binnen. verifyToken weigert de sessie toch al, dus zonder
     deze regel zou iemand een token krijgen dat meteen daarna nergens voor
     deugt: verwarrend, en het verbergt de echte reden. */
  if (!accounts.isActief(user)) return res.status(403).json({ error: 'Dit account is door uw organisatie op non-actief gezet. Neem contact op met uw beheerder.' });
  // juiste gegevens, maar de verkeerde pas-app: netjes doorverwijzen. De
  // eigenaar mag in alle drie de apps; zie de uitleg bij pasAppOk hierboven.
  if (!isBaas(user) && !pasAppOk(String(req.body.pasApp || ''), user.tier)) return res.status(403).json({ error: PAS_FOUT });
  const token = accounts.issueToken(user.id);
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

  /* De registratie-, herstel- en verificatieroutes draaien als submodules
     op een gedeelde context, een keer opgebouwd bij het opstarten. */
  const actx = { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN, antivirus: kern.antivirus,
    webauthnRegOpties: kern.webauthnRegOpties, webauthnRegMaak: kern.webauthnRegMaak,
    webauthnLoginOpties: kern.webauthnLoginOpties, webauthnLoginMaak: kern.webauthnLoginMaak,
    webauthnLijst: kern.webauthnLijst, webauthnWeg: kern.webauthnWeg, automatisering,
    /* De kern zelf reist mee voor de wervingslink. Die helpers (zoekInvite,
       verbindLid) worden PAS aan de kern gehangen als routes/werving.js is
       gemount, en dat gebeurt na deze module -- dus uitpakken bij het opstarten
       zou een undefined opleveren. Via het kern-object leest de registratie ze
       op het moment dat er iemand registreert, en dan staan ze er. */
    kern };
  require('./auth/account')(actx);
  require('./auth/herstel')(actx);
  /* De herstelstroom komt uit die submodule (startHerstel) en de LEDENBALIE
     roept hem aan: een lid dat belt dat hij niet meer inlogt, krijgt dezelfde
     mail als wanneer hij zelf op "wachtwoord vergeten" drukt. Hier op de kern
     zetten en niet in de submodule, want actx is van dit bestand -- de balie
     leest kern.startHerstel. Nabouwen was de andere optie en die is fout: dan
     is er een tweede plek die een hersteltoken maakt. */
  kern.startHerstel = actx.startHerstel;
  require('./auth/verificatie')(actx);
  require('./auth/webauthn')(actx);
};
