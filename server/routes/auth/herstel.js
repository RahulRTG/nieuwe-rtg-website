/* Auth (deelmodule): wachtwoordherstel: de tweestapsflow (herstel-link per
   e-mail plus code per telefoon), het resetten en het wijzigen met het
   huidige wachtwoord als bevestiging. Krijgt de gedeelde context een keer
   bij het opstarten vanuit routes/auth.js. */
module.exports = (actx) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN } = actx;
/* Wachtwoord vergeten: tweestapsverificatie via de website. Stap 1 is de
   herstel-link in de e-mail; stap 2 is een zescijferige code die per SMS naar de
   telefoon van het account gaat (zonder provider naar de outbox). Pas met link
   EN code samen kan een nieuw wachtwoord worden gezet. */
function herstel2fa() {
  if (!db.data.herstel2fa) db.data.herstel2fa = {}; // userId -> { hash, tot, pogingen }
  return db.data.herstel2fa;
}
const codeHash = (c) => crypto.createHash('sha256').update(String(c)).digest('hex');

/* HETZELFDE ANTWOORD, MAAR NIET IN DEZELFDE TIJD.

   Deze route geeft bewust altijd hetzelfde antwoord terug: of een adres bij ons
   een account heeft, gaat een buitenstaander niet aan. Dat klopte -- in WOORDEN.
   De DUUR verschilde: bestond het account, dan werd er een hersteltoken
   aangemaakt, een code gehasht, de database weggeschreven en twee berichten
   ingepland; bestond het niet, dan keerde de route meteen terug. Dat verschil is
   over een reeks verzoeken gewoon te meten, en dan is dit alsnog een
   ledenlijst-controle -- precies wat het gelijke antwoord moest voorkomen.

   Vandaar een vloer onder de antwoordtijd: elk verzoek doet er minstens
   MIN_MS over, hoe kort het echte werk ook was. Een vloer en geen ruis, want
   ruis middelt weg als je vaak genoeg meet. Een aanvaller ziet nu een vlakke
   lijn; een gewone gebruiker merkt een kwart seconde niet. */
const MIN_MS = 250;

app.post('/api/auth/forgot', (req, res) => {
  const begon = Date.now();
  const antwoord = (lijf) => {
    const over = MIN_MS - (Date.now() - begon);
    if (over > 0) setTimeout(() => res.json(lijf), over);
    else res.json(lijf);
  };
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
    mail.send('sms:' + tel, 'Uw RTG-herstelcode',
      'Uw code om het wachtwoord te herstellen: ' + code + '\nGeldig: 1 uur. Vroeg u dit niet aan? Negeer dit bericht.');
    if (DEV_VELDEN(req)) { devResetUrl = url; devCode = code; }
  }
  // Altijd hetzelfde antwoord, en sinds deze ronde ook in dezelfde tijd.
  antwoord({ ok: true, tweestaps: true, ...(devResetUrl ? { devResetUrl, devCode } : {}) });
});

app.post('/api/auth/reset', async (req, res) => {
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
  await accounts.setPassword(u.id, pw);
  res.json({ ok: true });
});

/* Wachtwoord wijzigen vanuit de eigen backoffice: altijd met het huidige
   wachtwoord als bevestiging. */
app.post('/api/auth/password', auth, async (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
  const u = req.session.account;
  if (!await accounts.verifyPassword(String(req.body.huidig || ''), u.password_hash))
    return res.status(403).json({ error: 'Het huidige wachtwoord klopt niet.' });
  const nieuw = String(req.body.nieuw || '');
  if (nieuw.length < 6) return res.status(400).json({ error: 'Het nieuwe wachtwoord moet minstens 6 tekens zijn.' });
  await accounts.setPassword(u.id, nieuw);
  res.json({ ok: true });
});
};
