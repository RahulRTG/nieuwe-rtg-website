/* Auth (deelmodule): het account: registreren, de
   e-mailbevestiging en het opnieuw sturen van de bevestigingslink. Krijgt
   de gedeelde context een keer bij het opstarten vanuit routes/auth.js. */
const eigenaar = require('../../eigenaar'); // een bron van waarheid over wie de eigenaar is
module.exports = (actx) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN, automatisering, kern } = actx;
  const keurAanmelding = require('./aanmeldcontrole')({ accounts, crypto, schoon, leeftijdVan, pasAppOk, PAS_FOUT });
app.post('/api/auth/register', async (req, res) => {
  // Registratie-zekering (een noodrem-trede dooft vanzelf; zie techniek.js).
  const zReg = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.registratie;
  if (require('../../techniek').zekeringGesprongen(zReg)) return res.status(503).json({ error: 'Registreren is tijdelijk uitgeschakeld.' });
  /* De poortcontrole staat in ./aanmeldcontrole.js: wat mag er binnenkomen en
     met welke pas. Die geeft een fout terug of de schoongemaakte velden; hier
     blijft staan wat we met een GOEDGEKEURDE aanmelding doen. */
  const keur = keurAanmelding(req);
  if (!keur.ok) return res.status(keur.status).json({ error: keur.error });
  const { name, email, telefoon, password, geboren, tier } = keur;
  let user;
  try {
    user = await accounts.createUser({ email, username: req.body.username || null, password, tier, realName: name, phone: telefoon });
  } catch (e) {
    return res.status(409).json({ error: 'Dit account bestaat al.' });
  }
  // De vervolgstappen (profiel bewaren, tokens uitgeven, staat opbouwen) raken
  // de opslag. Faalt daar iets (bijv. de database onder zware druk), dan geven
  // we een nette 503 terug in plaats van een onafgevangen 500.
  try {
    const mdNieuw = memberTemplate();
    /* Een nieuw account begint LEEG (kern/lid.js): geen reis en geen facturen
       van de demo. Wat er wel bij hoort is de eigen maandbijdrage, hier gemaakt
       op naam en maand (kern/lid/facturen.js) in plaats van geërfd uit de seed. */
    const eerste = kern.eersteBijdrageFactuur ? kern.eersteBijdrageFactuur(user.tier, user.id, user.created_at) : null;
    if (eerste) mdNieuw.invoices = [eerste];
    mdNieuw.geboren = geboren;
    // geslacht zoals in het paspoort (v/m/x); pas betrouwbaar na RTG-verificatie.
    // Gebruikt o.a. door Salon-ontmoetingen voor de "naar de vrouw"-regel.
    const g = String(req.body.geslacht || '').toLowerCase();
    if (g === 'v' || g === 'm' || g === 'x') mdNieuw.geslacht = g;
    // land (2-letter code) van het lid: stuurt o.a. de Boardroom "per land"-regels
    const ln = String(req.body.land || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    if (ln.length === 2) mdNieuw.land = ln;
    // woonplaats (stad of dorp, vrije naam): stuurt de "per plaats"-regels van
    // de schakelkast; genormaliseerd zodat "Den  HAAG" en "den haag" een zijn
    const pl = require('../../functies').plaatsNorm(req.body.plaats);
    if (pl) mdNieuw.plaats = pl;
    accounts.saveMemberState(user.id, mdNieuw);
    // welkom-draaiboek: een automatisch bericht in het eigen RTMAIL-postvak
    try { if (automatisering) automatisering.welkomLid({ codename: user.codename, wereld: 'RTG' }); } catch (e) {}
    // bevestigingsmail met een echte, werkende link
    const vtok = accounts.issueActionToken(user.id, 'verify-email', 3 * 86400000);
    const verifyUrl = appUrl(req) + '/apps/app.html?pas=' + pasAppVan(user.tier) + '&verify=' + vtok;
    try { mail.send(email, 'Bevestig uw e-mailadres bij Rahul Travel Group',
      'Welkom bij RTG. Bevestig uw e-mailadres via deze link:\n' + verifyUrl); } catch (e) {}
    /* Kwam dit account via een WERVINGSLINK binnen, dan zijn aanmelden en in
       dienst treden een handeling. Zie werving/uitnodiging.js. */
    const werk = kern.wisselCodeIn
      ? await kern.wisselCodeIn(user, String(req.body.wervingscode || '').trim().toUpperCase())
      : null;
    const token = accounts.issueToken(user.id);
    const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
    if (email === eigenaar.eigenaarEmail()) delete process.env.RTG_OWNER_BOOTSTRAP;
    res.json({ token, state: stateFor(sess, req.body.lang), needsEmailVerify: true,
      ...(werk ? { werk } : {}), ...(DEV_VELDEN(req) ? { devVerifyUrl: verifyUrl } : {}) });
  } catch (e) {
    return res.status(503).json({ error: 'Registreren lukte even niet. Probeer het zo opnieuw.' });
  }
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
  res.json({ ok: true, ...(DEV_VELDEN(req) ? { devVerifyUrl: url } : {}) });
});
};
