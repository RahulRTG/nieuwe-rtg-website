/* Auth (deelmodule): het account: registreren, de
   e-mailbevestiging en het opnieuw sturen van de bevestigingslink. Krijgt
   de gedeelde context een keer bij het opstarten vanuit routes/auth.js. */
const eigenaar = require('../../eigenaar'); // een bron van waarheid over wie de eigenaar is
module.exports = (actx) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN, automatisering } = actx;
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
  /* Een gratis RTG-account vraagt VIER dingen: naam, geboortedatum, e-mail en een
     wachtwoord. Een telefoonnummer hoort daar niet bij -- dat vraagt Rahul pas als
     er iets geregeld moet worden waar een derde partij bij komt (een bestelling,
     een reservering, een bezorging). Geeft iemand hem hier toch mee, dan nemen we
     hem aan; is hij te kort om te kloppen, dan laten we hem weg in plaats van de
     aanmelding te weigeren. */
  const telefoon = phone.replace(/\D/g, '').length >= 8 ? phone : null;
  if (password.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minstens 6 tekens zijn.' });
  // de geboortedatum bepaalt de leeftijdsgroep en dus wat er opengaat
  // (15-17 alleen met toestemming van ouder/voogd); het paspoort komt pas later,
  // bij een bestelling of reservering waar een derde partij bij komt
  const geboren = String(req.body.geboortedatum || '').slice(0, 10);
  const lftNieuw = leeftijdVan(geboren);
  if (lftNieuw == null) return res.status(400).json({ error: 'Vul uw geboortedatum in.' });
  if (lftNieuw < 15) return res.status(400).json({ error: 'Het RTG-lidmaatschap kan vanaf 15 jaar.' });
  if (lftNieuw > 120) return res.status(400).json({ error: 'Controleer uw geboortedatum.' });
  if (accounts.findByLogin(email)) return res.status(409).json({ error: 'Er bestaat al een account met dit e-mailadres.' });
  /* HET EIGENAARSACCOUNT ONTSTAAT UIT EEN BEWUSTE HANDELING, NIET UIT EEN FORMULIER.

     De technische pagina bepaalt de eigenaar met eigenaarUser(): staat er nog
     geen eigenaarId, dan zoekt hij het account op het eigenaarsadres op en PINT
     dat vast. Dat is prima zolang alleen een bewuste handeling zo'n account kan
     maken -- maar deze route kon het ook. Op een verse productie-installatie
     werd daarmee wie het eigenaarsadres als eerste registreerde de eigenaar van
     het platform: de technische pagina, de hoofdzekering, de boardroom. Het
     adres is niet geheim -- het staat in de omgevingsvariabelen en in de
     documentatie -- dus geheimhouding was nooit de bescherming.

     De deur helemaal dichtdoen kon niet: in productie is dit de ENIGE weg om
     een eerste eigenaar te krijgen (de overdracht vanuit de boardroom vereist
     dat er er al een is). Daarom een eenmalige sleutel: RTG_OWNER_BOOTSTRAP.
     Staat die gezet, dan mag de registratie op het eigenaarsadres door mits ze
     hem meestuurt; staat hij niet gezet, dan gaat het adres niet meer door de
     voordeur. De beheerder zet hem bij de eerste start naast de andere
     sleutels, registreert een keer, en haalt hem weg.

     In demostand maakt de opstart het account rechtstreeks aan (createUserSync,
     niet via deze route), dus daar verandert er niets. Een OPVOLGER registreert
     gewoon zijn eigen adres en krijgt het eigenaarschap daarna overgedragen.

     Het antwoord bij een ontbrekende of verkeerde sleutel is bewust hetzelfde
     409 als bij een bestaand account: of dat adres al een account heeft, gaat
     een buitenstaander niet aan. */
  if (email === eigenaar.eigenaarEmail()) {
    const verwacht = String(process.env.RTG_OWNER_BOOTSTRAP || '');
    const gegeven = String(req.body.eigenaarSleutel || '');
    const goed = verwacht.length >= 16 && gegeven.length === verwacht.length
      && crypto.timingSafeEqual(Buffer.from(gegeven), Buffer.from(verwacht));
    if (!goed) return res.status(409).json({ error: 'Er bestaat al een account met dit e-mailadres.' });
  }
  /* De poort van het merk: zelf-registreren levert ALTIJD hooguit een RTG Pass
     (of de gratis gast-laag). Lifestyle en Business komen -- per merkregel --
     uitsluitend na een menselijk besluit (kern/aanmeldingen.js beslis, dat
     accounts.setTier aanroept). Wie zich rechtstreeks als Lifestyle/Business
     probeert in te schrijven, krijgt gewoon RTG: geen enkele registratie geeft
     die passen zelf. Eerder gaf dit veld DIRECT een Business Pass -- dat gat is
     hier dicht. */
  const gevraagd = String(req.body.tier || 'rtg');
  const betaald = (gevraagd === 'lifestyle' || gevraagd === 'business');
  const tier = betaald ? 'rtg' : gevraagd;
  const pasApp = String(req.body.pasApp || '');
  /* In een pas-app registreer je alleen een account van die pas (gratis mag in de
     RTG-app). Vroeg iemand zich in de EIGEN betaalde-pas-app aan voor die pas
     (bijv. de Business-app, tier business) -- die we hierboven naar RTG
     terugbrengen -- dan zou de pasApp niet meer bij de (nu RTG-)pas passen. Dat
     is geen fout van de aanvrager maar het gevolg van onze eigen clamp, dus
     toetsen we dat geval tegen RTG: hij krijgt een RTG-account i.p.v. een
     weigering. Een ECHTE kruismismatch (bijv. business-tier in de Lifestyle-app)
     blijft gewoon geweigerd. */
  const pasAppKeuze = (betaald && pasApp === gevraagd) ? 'rtg' : pasApp;
  if (!pasAppOk(pasAppKeuze, tier)) return res.status(403).json({ error: PAS_FOUT });
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
