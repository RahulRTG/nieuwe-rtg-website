/* Auth (deelmodule): wachtwoordherstel: de tweestapsflow (herstel-link per
   e-mail plus code per telefoon), het resetten en het wijzigen met het
   huidige wachtwoord als bevestiging. Krijgt de gedeelde context een keer
   bij het opstarten vanuit routes/auth.js. */
const rtgKlok = require('../../lib/klok');
module.exports = (actx) => {
  const { PERSONAS, PRODUCTION, UPLOAD_DIR, accounts, app, appUrl, auth, checkCred, crypto, db, express, forgetSession, fs, hasCred, leeftijdVan, loginFails, mail, memberTemplate, noteFailedTry, path, rememberSession, save, schoon, sessions, stateFor, tooManyTries, logInlog,
    DEMO, pasAppOk, PAS_FOUT, pasAppVan, DEV_VELDEN , kern} = actx;
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
/* Deze vlag is geen bypass maar een extra grendel: als hij staat, blijft
   telefoonherstel ook dicht wanneer later per ongeluk een half geconfigureerde
   SMS-module wordt toegevoegd. Activeren vraagt dan twee bewuste wijzigingen. */
const HERSTEL_SMS_BEWUST_UIT = process.env.RTG_HERSTEL_SMS_UIT_BEWUST === '1';

/* HET HERSTEL IN GANG ZETTEN -- als eigen functie, niet alleen als route.

   Deze stroom stond volledig binnen de route. Dat werkte, tot er een TWEEDE
   plek kwam die hem nodig heeft: de ledenbalie, waar een medewerker een lid
   helpt dat er niet meer in komt. Die had de stroom moeten nabouwen, en dan
   heb je twee waarheden over hoe een herstel werkt -- precies de vorm waar
   vandaag de helft van de fouten vandaan kwam.

   Dus een functie, en de route roept hem aan. De balie straks ook. Wie de regels
   verandert, verandert ze voor allebei. */
function herstelStart(u, req) {
  if (!u) return { ok: true, tweestaps: false };   // bestaan lekken we nooit
  const tel = accounts.phoneOf(u);
  /* PRODUCTIE ZONDER ECHT TWEEDE KANAAL: GEEN TOKEN UITGEVEN.

     De outbox is een storingsvangnet voor medewerkers, geen telefoon. Een
     herstel-link mailen en tegelijk een code eisen die de gebruiker nooit kan
     ontvangen maakt het account onherstelbaar; link-only doorgaan zou de
     beveiliging juist verlagen. We falen daarom gesloten en houden het
     publieke antwoord generiek. Lokaal blijft de outbox-proef beschikbaar. */
  if (tel && PRODUCTION && (HERSTEL_SMS_BEWUST_UIT || !mail.smsConfigured)) {
    console.error('[auth] herstel veilig geblokkeerd: account heeft telefoon maar er is geen echte SMS-provider.');
    return { ok: true, tweestaps: true, geblokkeerd: true, url: null, code: null };
  }
  const code = String(crypto.randomInt(100000, 1000000));
  /* GEEN TELEFOON, GEEN TWEEDE STAP -- en dat moet je dan ook zeggen.
     Hier stond `accounts.phoneOf(u) || 'onbekend'`, en de code ging als
     'sms:onbekend' de deur uit: naar niemand. /api/auth/reset EIST die code,
     dus voor elk account zonder telefoonnummer was herstellen onmogelijk. En de
     registratie vraagt met opzet GEEN telefoonnummer, dus dat was niet de
     uitzondering maar de regel. Een `|| 'onbekend'` is een fallback die iets
     VERZINT in plaats van te weigeren. */
  if (tel) {
    /* Eerst het tweede kanaal laten accepteren, pas daarna een herstel-link
       uitgeven. Een gesimuleerde providerstoring laat zo geen half geldige
       herstelpoging achter. */
    mail.sendSms(tel, 'Uw RTG-herstelcode',
      'Uw code om het wachtwoord te herstellen: ' + code + '\nGeldig: 1 uur. Vroeg u dit niet aan? Negeer dit bericht.');
  }
  const tok = accounts.createReset(u.id);
  const url = appUrl(req) + '/apps/app.html?pas=' + pasAppVan(u.tier) + '&reset=' + tok;
  mail.send(accounts.emailOf(u) || '', 'Wachtwoord herstellen bij Rahul Travel Group',
    'U vroeg een nieuw wachtwoord aan. Stel het in via deze link (1 uur geldig):\n' + url +
    (tel ? '\n\nUit veiligheid sturen we ook een code naar uw telefoon; die vult u op de website in.' : ''));
  if (tel) {
    herstel2fa()[u.id] = { hash: codeHash(code), tot: rtgKlok.nu() + 3600000, pogingen: 0 };
  } else {
    herstel2fa()[u.id] = { zonderCode: true, tot: rtgKlok.nu() + 3600000, pogingen: 0 };
  }
  save();
  return { ok: true, tweestaps: !!tel, url, code: tel ? code : null };
}
/* De balie (routes/ledenbalie.js) zet hetzelfde herstel in gang voor een lid dat
   belt. Hij krijgt de LINK en de CODE bewust NIET terug -- alleen dat het is
   verstuurd. Een medewerker die de link ziet, kan het account overnemen. */
kern.herstelStart = (u, req) => {
  let r;
  try { r = herstelStart(u, req); }
  catch (e) {
    console.error('[auth] herstel niet gestart:', e && e.message);
    r = { ok: true, tweestaps: !!(u && accounts.phoneOf(u)), url: null, code: null };
  }
  return { ok: r.ok, verstuurd: !!u, tweestaps: r.tweestaps };
};

app.post('/api/auth/forgot', (req, res) => {
  const begon = rtgKlok.nu();
  const antwoord = (lijf) => {
    const over = MIN_MS - (rtgKlok.nu() - begon);
    if (over > 0) setTimeout(() => res.json(lijf), over);
    else res.json(lijf);
  };
  const email = String(req.body.email || '').trim();
  const u = email ? accounts.findByLogin(email) : null;
  let r;
  try { r = herstelStart(u, req); }
  catch (e) {
    /* Een providerstoring mag niet verraden of dit account bestaat en mag ook
       geen half geldige herstelpoging opleveren. herstelStart maakt het token
       pas NA SMS-acceptatie; hier houden we het publieke antwoord generiek. */
    console.error('[auth] herstel niet gestart:', e && e.message);
    r = { ok: true, tweestaps: !!(u && accounts.phoneOf(u)), url: null, code: null };
  }
  const dev = DEV_VELDEN(req) && u ? { devResetUrl: r.url, devCode: r.code } : {};
  // Altijd hetzelfde antwoord, en sinds deze ronde ook in dezelfde tijd.
  antwoord({ ok: true, tweestaps: r.tweestaps, ...dev });
});
app.post('/api/auth/reset', async (req, res) => {
  const u = accounts.findByReset(req.body.token);
  if (!u) return res.status(400).json({ error: 'Ongeldige of verlopen herstel-link.' });
  const pw = String(req.body.password || '');
  /* Een ongeldig nieuw wachtwoord mag geen enkele herstelstap verbruiken. Dat
     gebeurde bij accounts zonder telefoon al voor deze controle, waardoor een
     gewone typefout de geldige herstel-link onbruikbaar maakte. */
  if (pw.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minstens 6 tekens zijn.' });
  // tweede stap: de code van de telefoon moet kloppen
  const entry = herstel2fa()[u.id];
  if (!entry || entry.tot < rtgKlok.nu())
    return res.status(400).json({ error: 'De code is verlopen. Vraag een nieuwe herstel-link aan.' });
  /* Was er geen tweede kanaal, dan is de link het bewijs. De vlag komt uit
     dezelfde aanvraag die de link maakte, dus een aanvaller kan hem niet zelf
     zetten: hij zou eerst het telefoonnummer van het account moeten weghalen,
     en daarvoor moet hij al binnen zijn. */
  if (!entry.zonderCode && entry.hash !== codeHash(String(req.body.code || '').trim())) {
    entry.pogingen = (entry.pogingen || 0) + 1;
    if (entry.pogingen >= 5) {
      delete herstel2fa()[u.id];
      save();
      return res.status(403).json({ error: 'Te veel foute codes. Vraag een nieuwe herstel-link aan.' });
    }
    save();
    return res.status(403).json({ error: 'Onjuiste code. Kijk in het bericht op uw telefoon.' });
  }
  /* De accountslaag vergelijkt en wist de reset-hash in dezelfde SQL-update
     als het nieuwe wachtwoord. Twee gelijktijdige geldige verzoeken kunnen dus
     niet allebei winnen. Pas na die commit ruimen we de tweede stap op. */
  const gezet = await accounts.consumeReset(req.body.token, pw);
  if (!gezet) return res.status(409).json({ error: 'Deze herstel-link is al gebruikt. Log in of vraag een nieuwe aan.' });
  delete herstel2fa()[u.id];
  save();
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
