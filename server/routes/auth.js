/* Domein "auth" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries } = kern;
  // Demo-inlog (snelle pas-login zonder wachtwoord, en het demo-account) alleen
  // buiten productie of met RTG_DEMO=1. Echte leden loggen in via /api/auth/login.
  const DEMO = !PRODUCTION || process.env.RTG_DEMO === '1';

  /* Elke pas heeft zijn eigen app (app.html?pas=...). De inloggegevens werken
     echt alleen in de app van de eigen pas: een Business-account komt de
     Lifestyle-app niet in, en andersom. De gratis laag (gast) heeft geen eigen
     app en speelt mee in de RTG-app, met minder functies. Er is geen brede
     leden-app meer; zonder pasApp (directe API-koppelingen en tests) blijft
     elke pas werken. */
  function pasAppOk(pasApp, tier) {
    if (!['rtg', 'lifestyle', 'business'].includes(pasApp)) return true; // brede app
    if (pasApp === 'rtg') return tier === 'rtg' || tier === 'guest';
    return tier === pasApp;
  }
  const PAS_FOUT = 'Deze inloggegevens horen bij een andere pas. Open de app van uw eigen pas via rtg.example/apps.';
  // e-maillinks (bevestigen/herstellen) landen in de pas-app van het account
  const pasAppVan = (tier) => tier === 'lifestyle' || tier === 'business' ? tier : 'rtg';
  /* Zonder SMTP geven we buiten productie de link/code in het antwoord terug
     (dev-velden), zodat lokaal en in tests de hele flow werkt. In PRODUCTIE
     nooit: anders zou een aanvrager de herstel-link en telefooncode van een
     ander account zo in het antwoord krijgen. */
  const DEV_VELDEN = !PRODUCTION && !mail.configured;

app.post('/api/login', (req, res) => {
  let tier = String(req.body.tier || '');
  if (hasCred(req.body)) {
    if (!DEMO) return res.status(403).json({ error: 'Demo-inlog is uitgeschakeld. Log in met je account.' });
    const bucket = 'demo:' + req.ip;
    if (tooManyTries(res, bucket)) return;
    if (!checkCred(req.body.username, req.body.password)) {
      noteFailedTry(bucket);
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    loginFails.delete(bucket);
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

app.post('/api/logout', auth, (req, res) => {
  for (const [token, sess] of sessions) if (sess === req.session) forgetSession(token);
  res.json({ ok: true });
});

app.post('/api/auth/register', (req, res) => {
  // Registratie-zekering: staat hij uit, dan nemen we tijdelijk geen nieuwe
  // accounts aan (bijv. bij misbruik). De eigenaar zet hem weer aan op de
  // technische pagina.
  const zReg = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.registratie;
  if (zReg && zReg.aan === false) return res.status(503).json({ error: 'Registreren is tijdelijk uitgeschakeld.' });
  // schoon(): de echte naam wordt o.a. in de backoffice (KYC) getoond; geen opmaak.
  const name = schoon(req.body.name, 80);
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim().slice(0, 30);
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: 'Vul uw naam in.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  if (phone.replace(/\D/g, '').length < 8) return res.status(400).json({ error: 'Vul een geldig mobiel nummer in (voor uw WhatsApp-lijn).' });
  if (password.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minstens 6 tekens zijn.' });
  // de pas wordt met paspoort aangevraagd: geboortedatum is verplicht en
  // bepaalt de leeftijdsgroep (15-17 alleen met toestemming van ouder/voogd)
  const geboren = String(req.body.geboortedatum || '').slice(0, 10);
  const lftNieuw = leeftijdVan(geboren);
  if (lftNieuw == null) return res.status(400).json({ error: 'Vul uw geboortedatum in zoals in uw paspoort.' });
  if (lftNieuw < 15) return res.status(400).json({ error: 'Het RTG-lidmaatschap kan vanaf 15 jaar.' });
  if (lftNieuw > 120) return res.status(400).json({ error: 'Controleer uw geboortedatum.' });
  if (accounts.findByLogin(email)) return res.status(409).json({ error: 'Er bestaat al een account met dit e-mailadres.' });
  // in een pas-app registreer je alleen een account van die pas (gratis mag in de RTG-app)
  if (!pasAppOk(String(req.body.pasApp || ''), String(req.body.tier || 'rtg'))) return res.status(403).json({ error: PAS_FOUT });
  let user;
  try {
    user = accounts.createUser({ email, username: req.body.username || null, password, tier: req.body.tier, realName: name, phone });
  } catch (e) {
    return res.status(409).json({ error: 'Dit account bestaat al.' });
  }
  const mdNieuw = memberTemplate();
  mdNieuw.geboren = geboren;
  accounts.saveMemberState(user.id, mdNieuw);
  // bevestigingsmail met een echte, werkende link
  const vtok = accounts.issueActionToken(user.id, 'verify-email', 3 * 86400000);
  const verifyUrl = appUrl(req) + '/apps/app.html?pas=' + pasAppVan(user.tier) + '&verify=' + vtok;
  mail.send(email, 'Bevestig uw e-mailadres bij Rahul Travel Group',
    'Welkom bij RTG. Bevestig uw e-mailadres via deze link:\n' + verifyUrl);
  const token = accounts.issueToken(user.id);
  const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
  res.json({ token, state: stateFor(sess, req.body.lang), needsEmailVerify: true, ...(DEV_VELDEN ? { devVerifyUrl: verifyUrl } : {}) });
});

app.post('/api/auth/verify-email', (req, res) => {
  const u = accounts.verifyActionToken(req.body.token, 'verify-email');
  if (!u) return res.status(400).json({ error: 'Ongeldige of verlopen bevestigingslink.' });
  accounts.setEmailVerified(u.id);
  res.json({ ok: true });
});

app.post('/api/auth/resend', auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
  const u = req.session.account;
  const vtok = accounts.issueActionToken(u.id, 'verify-email', 3 * 86400000);
  const url = appUrl(req) + '/apps/app.html?pas=' + pasAppVan(u.tier) + '&verify=' + vtok;
  mail.send(accounts.emailOf(u), 'Bevestig uw e-mailadres', 'Bevestig uw e-mailadres via deze link:\n' + url);
  res.json({ ok: true, ...(DEV_VELDEN ? { devVerifyUrl: url } : {}) });
});

/* Wachtwoord vergeten: tweestapsverificatie via de website. Stap 1 is de
   herstel-link in de e-mail; stap 2 is een zescijferige code die naar de
   telefoon van het account gaat (WhatsApp/SMS; zonder provider naar de
   outbox). Pas met link EN code samen kan een nieuw wachtwoord worden gezet. */
function herstel2fa() {
  if (!db.data.herstel2fa) db.data.herstel2fa = {}; // userId -> { hash, tot, pogingen }
  return db.data.herstel2fa;
}
const codeHash = (c) => crypto.createHash('sha256').update(String(c)).digest('hex');

app.post('/api/auth/forgot', (req, res) => {
  const email = String(req.body.email || '').trim();
  const u = email ? accounts.findByLogin(email) : null;
  let devResetUrl, devCode;
  if (u) {
    const tok = accounts.createReset(u.id);
    const url = appUrl(req) + '/apps/app.html?pas=' + pasAppVan(u.tier) + '&reset=' + tok;
    // stap 2: de code naar de telefoon (tweede kanaal, los van de e-mail)
    const code = String(crypto.randomInt(100000, 1000000));
    herstel2fa()[u.id] = { hash: codeHash(code), tot: Date.now() + 3600000, pogingen: 0 };
    save();
    mail.send(accounts.emailOf(u) || email, 'Wachtwoord herstellen bij Rahul Travel Group',
      'U vroeg een nieuw wachtwoord aan. Stel het in via deze link (1 uur geldig):\n' + url +
      '\n\nUit veiligheid sturen we ook een code naar uw telefoon; die vult u op de website in.');
    const tel = accounts.phoneOf(u) || 'onbekend';
    mail.send('whatsapp:' + tel, 'Uw RTG-herstelcode',
      'Uw code om het wachtwoord te herstellen: ' + code + '\nGeldig: 1 uur. Vroeg u dit niet aan? Negeer dit bericht.');
    if (DEV_VELDEN) { devResetUrl = url; devCode = code; }
  }
  // Altijd hetzelfde antwoord: niet verklappen of een e-mailadres bestaat.
  res.json({ ok: true, tweestaps: true, ...(devResetUrl ? { devResetUrl, devCode } : {}) });
});

app.post('/api/auth/reset', (req, res) => {
  const u = accounts.findByReset(req.body.token);
  if (!u) return res.status(400).json({ error: 'Ongeldige of verlopen herstel-link.' });
  // tweede stap: de code van de telefoon moet kloppen
  const entry = herstel2fa()[u.id];
  if (!entry || entry.tot < Date.now())
    return res.status(400).json({ error: 'De code is verlopen. Vraag een nieuwe herstel-link aan.' });
  if (entry.hash !== codeHash(String(req.body.code || '').trim())) {
    entry.pogingen = (entry.pogingen || 0) + 1;
    if (entry.pogingen >= 5) {
      delete herstel2fa()[u.id];
      save();
      return res.status(403).json({ error: 'Te veel foute codes. Vraag een nieuwe herstel-link aan.' });
    }
    save();
    return res.status(403).json({ error: 'Onjuiste code. Kijk in het bericht op uw telefoon.' });
  }
  const pw = String(req.body.password || '');
  if (pw.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minstens 6 tekens zijn.' });
  delete herstel2fa()[u.id];
  save();
  accounts.setPassword(u.id, pw);
  res.json({ ok: true });
});

/* Wachtwoord wijzigen vanuit de eigen backoffice: altijd met het huidige
   wachtwoord als bevestiging. */
app.post('/api/auth/password', auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
  const u = req.session.account;
  if (!accounts.verifyPassword(String(req.body.huidig || ''), u.password_hash))
    return res.status(403).json({ error: 'Het huidige wachtwoord klopt niet.' });
  const nieuw = String(req.body.nieuw || '');
  if (nieuw.length < 6) return res.status(400).json({ error: 'Het nieuwe wachtwoord moet minstens 6 tekens zijn.' });
  accounts.setPassword(u.id, nieuw);
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const login = req.body.login || req.body.email || req.body.username;
  const bucket = 'auth:' + req.ip + ':' + String(login || '').toLowerCase().slice(0, 60);
  if (tooManyTries(res, bucket)) return;
  const user = accounts.findByLogin(login);
  if (!user || !accounts.verifyPassword(req.body.password, user.password_hash)) {
    noteFailedTry(bucket);
    return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
  }
  loginFails.delete(bucket);
  // juiste gegevens, maar de verkeerde pas-app: netjes doorverwijzen
  if (!pasAppOk(String(req.body.pasApp || ''), user.tier)) return res.status(403).json({ error: PAS_FOUT });
  const token = accounts.issueToken(user.id);
  const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
  res.json({ token, state: stateFor(sess, req.body.lang) });
});

app.post('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.session.account ? accounts.publicUser(req.session.account) : stateFor(req.session, req.body.lang).user });
});

app.post('/api/verify/upload', express.json({ limit: '6mb' }), auth, (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Verificatie is voor echte accounts.' });
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
  if (!m) return res.status(400).json({ error: 'Upload een foto (JPG, PNG of WebP) van uw identiteitsbewijs.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Bestand te groot (max 5 MB).' });
  // Identiteitsbewijs: alleen de eigenaar van het proces mag erbij (map 0700, bestand 0600).
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(UPLOAD_DIR, 0o700); } catch (e) {}
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const fname = req.session.account.id + '-' + Date.now() + '.' + ext;
  // met RTG_ENC_KEY wordt het identiteitsbewijs versleuteld op schijf gezet
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), require('../kluis').versleutelBuf(buf), { mode: 0o600 });
  accounts.setVerification(req.session.account.id, 'pending', fname);
  res.json({ ok: true, status: 'pending' });
});

app.post('/api/verify/status', auth, (req, res) => {
  res.json({ status: req.session.account ? req.session.account.verified : 'n/a' });
});
};
