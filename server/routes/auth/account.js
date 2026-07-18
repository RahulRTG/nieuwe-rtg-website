/* Auth (deelmodule): het account: registreren met paspoortgegevens, de
   e-mailbevestiging en het opnieuw sturen van de bevestigingslink. Krijgt
   de gedeelde context een keer bij het opstarten vanuit routes/auth.js. */
module.exports = (actx) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN } = actx;
app.post('/api/auth/register', async (req, res) => {
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
  if (phone.replace(/\D/g, '').length < 8) return res.status(400).json({ error: 'Vul een geldig mobiel nummer in (voor herstel en meldingen).' });
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
    user = await accounts.createUser({ email, username: req.body.username || null, password, tier: req.body.tier, realName: name, phone });
  } catch (e) {
    return res.status(409).json({ error: 'Dit account bestaat al.' });
  }
  // De vervolgstappen (profiel bewaren, tokens uitgeven, staat opbouwen) raken
  // de opslag. Faalt daar iets (bijv. de database onder zware druk), dan geven
  // we een nette 503 terug in plaats van een onafgevangen 500.
  try {
    const mdNieuw = memberTemplate();
    mdNieuw.geboren = geboren;
    // geslacht zoals in het paspoort (v/m/x); pas betrouwbaar na RTG-verificatie.
    // Gebruikt o.a. door Salon-ontmoetingen voor de "naar de vrouw"-regel.
    const g = String(req.body.geslacht || '').toLowerCase();
    if (g === 'v' || g === 'm' || g === 'x') mdNieuw.geslacht = g;
    // land (2-letter code) van het lid: stuurt o.a. de Boardroom "per land"-regels
    const ln = String(req.body.land || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    if (ln.length === 2) mdNieuw.land = ln;
    accounts.saveMemberState(user.id, mdNieuw);
    // bevestigingsmail met een echte, werkende link
    const vtok = accounts.issueActionToken(user.id, 'verify-email', 3 * 86400000);
    const verifyUrl = appUrl(req) + '/apps/app.html?pas=' + pasAppVan(user.tier) + '&verify=' + vtok;
    try { mail.send(email, 'Bevestig uw e-mailadres bij Rahul Travel Group',
      'Welkom bij RTG. Bevestig uw e-mailadres via deze link:\n' + verifyUrl); } catch (e) {}
    const token = accounts.issueToken(user.id);
    const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
    res.json({ token, state: stateFor(sess, req.body.lang), needsEmailVerify: true, ...(DEV_VELDEN ? { devVerifyUrl: verifyUrl } : {}) });
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
  res.json({ ok: true, ...(DEV_VELDEN ? { devVerifyUrl: url } : {}) });
});
};
