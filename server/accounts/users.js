/* Accounts, deel "users": de ledenaccounts. Aanmaken (async scrypt of de sync
   seed-variant), zoeken op login, het openbare profiel, de staatloze sessie- en
   actie-tokens, de e-mailbevestiging en het wachtwoord-herstel, de per-persoon
   ledeninhoud, de identiteitsverificatie en de AVG-vergetelheid. Afgesplitst uit
   accounts.js; crypto komt uit ./kluis, de Postgres-spiegel uit ./mirror. */
const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const gebonden = require('./gebonden'); // kluis, gebonden aan (kolom, rij-id)
const mirror = require('./mirror');

/* createUser is asynchroon (scrypt in de threadpool); createUserSync bestaat
   voor het opstart-seed en tests, waar blokkeren geen kwaad kan. */
async function createUser(gegevens) {
  return schrijfUser(gegevens, await kluis.hashPassword(gegevens.password));
}
function createUserSync(gegevens) {
  return schrijfUser(gegevens, kluis.hashPasswordSync(gegevens.password));
}
/* Alleen voor de demo-seed; waarom dat mag en waarom het buiten de demostand
   weigert, staat bij kluis.zaaiHash. */
function createUserZaai(gegevens) {
  return schrijfUser(gegevens, kluis.zaaiHash(gegevens.password));
}
function schrijfUser({ email, username, tier, realName, phone }, passwordHash) {
  // 'guest' is de gratis (bestel/betaal) laag: een echt account met paspoort,
  // maar zonder betaalde pas. rtg/lifestyle/business zijn de betaalde passen.
  tier = ['rtg', 'lifestyle', 'business', 'guest'].includes(tier) ? tier : 'rtg';
  const vals = [
    email ? kluis.emailHash(email) : null,
    username || null,
    passwordHash,
    tier,
    kluis.makeCodename(),
    kluis.enc(realName),
    kluis.enc(email),
    phone ? kluis.enc(phone) : null,
    phone ? kluis.phoneHash(phone) : null,
    new Date().toISOString()
  ];
  const kolommen = 'email_hash, username, password_hash, tier, codename, enc_name, enc_email, enc_phone, phone_hash, created_at';
  // In Postgres-modus geven we een globaal uniek id mee (uit het gereserveerde
  // blok), zodat twee instances nooit hetzelfde id uitdelen. Anders SQLite-autoincrement.
  const id = mirror.nieuwId();
  let newId;
  if (id != null) {
    S.zin(`INSERT INTO users (id, ${kolommen}) VALUES (?, ${vals.map(() => '?').join(', ')})`).run(id, ...vals);
    newId = id;
  } else {
    const info = S.zin(`INSERT INTO users (${kolommen}) VALUES (${vals.map(() => '?').join(', ')})`).run(...vals);
    newId = info.lastInsertRowid;
  }
  require('./onderhoud').herzegel(S.db, newId); // id is nu bekend: kolommen eraan binden
  mirror.markUser(newId);
  return getUserById(newId);
}
function getUserById(id) { return S.zin('SELECT * FROM users WHERE id = ?').get(id) || null; }
function findByLogin(login) {
  const v = String(login || '').trim();
  if (!v) return null;
  const byEmail = S.zin('SELECT * FROM users WHERE email_hash = ?').get(kluis.emailHash(v));
  if (byEmail) return byEmail;
  return S.zin('SELECT * FROM users WHERE lower(username) = lower(?)').get(v) || null;
}
function count() { return S.zin('SELECT COUNT(*) AS c FROM users').get().c; }

/* Het telefoonnummer bijzetten. Dat gebeurt niet meer bij de aanmelding maar pas
   wanneer er iets geregeld moet worden waar een derde partij bij komt (zie
   kern/gegevenspoort.js). Het nummer gaat gebonden de kluis in en de zoek-hash
   gaat mee, zodat herstel op telefoonnummer blijft werken. */
/* HET TELEFOONNUMMER IS EEN HERSTELKANAAL, en daarom is deze functie
   fail-closed op VERVANGEN.

   /api/auth/reset stuurt een sms naar phoneOf(u). Wie dat nummer omzet, verlegt
   de herstelweg naar zichzelf -- dat is de eerste stap van een accountovername,
   en het wachtwoord is pas de tweede. Toch eiste alleen die tweede stap een
   bevestiging (/api/auth/password vraagt het huidige wachtwoord); deze eerste
   deed dat niet.

   Het commentaar in routes/auth/herstel.js redeneert dat een aanvaller "eerst
   het telefoonnummer zou moeten weghalen, en daarvoor moet hij al binnen zijn".
   Die redenering klopt, maar de aanname eronder niet: deze functie kon een
   nummer niet LEEGMAKEN, maar wel VERVANGEN -- en dat komt op hetzelfde neer.

   HET ONDERSCHEID DAT ERTOE DOET is niet "zetten" maar "vervangen":

     nog geen nummer   dan is er ook geen herstelkanaal om te kapen. Gewoon
                       toestaan; iemand die zijn gegevens voor het eerst invult
                       een wachtwoord vragen is wrijving zonder winst.
     zelfde nummer     verandert niets. Toestaan.
     ander nummer      dit VERLEGT het herstelkanaal. Alleen met `vervangenMag`,
                       en die zet een aanroeper pas nadat hij de mens opnieuw
                       heeft gecontroleerd.

   Fail-closed betekent hier: de twee bestaande aanroepers (het gegevensgesprek
   en de onboarding) geven die vlag NIET mee en kunnen dus alleen nog een eerste
   nummer zetten. Dat is de veilige kant, en het is precies de reden dat de
   grendel hier staat en niet op de routes -- op een route dek je de aanroepers
   die je kent, hier ook die van volgend jaar. */
function setPhone(id, phone, opties) {
  const nummer = String(phone || '').trim().slice(0, 30);
  if (!nummer) return null;
  const bestaand = String(gebonden.phoneOf(getUserById(id)) || '').trim();
  if (bestaand && bestaand !== nummer && !(opties && opties.vervangenMag === true)) {
    return { error: 'herstelkanaal',
      reden: 'Dit account heeft al een telefoonnummer. Het vervangen ervan verlegt de weg waarlangs een wachtwoord hersteld wordt, en vraagt daarom eerst uw wachtwoord.' };
  }
  S.zin('UPDATE users SET enc_phone = ?, phone_hash = ? WHERE id = ?')
    .run(gebonden.zegel('enc_phone', id, nummer), kluis.phoneHash(nummer), id);
  mirror.markUser(id);
  return getUserById(id);
}

/* Naamswijziging door het huis zelf (opstart-seed van het eigenaarsaccount):
   inlognaam en echte naam in een keer, de kluis blijft de bron. Geef je ook een
   e-mailadres mee, dan verhuist het account daarheen: de zoekhash en de
   versleutelde waarde gaan samen mee, anders zou het account onvindbaar worden. */
/* HET E-MAILADRES IS DE INLOGSLEUTEL EN EEN HERSTELKANAAL TEGELIJK.

   Zelfde grendel als bij setPhone hierboven, en om een zwaardere reden: dit
   adres is waarop findByLogin zoekt (email_hash) EN waar de herstel-link
   heengaat. Wie het vervangt, neemt de voordeur en de achterdeur in een keer
   over.

   Dit deed vandaag geen enkele ledenroute -- renameUser is de enige schrijver en
   wordt alleen door de eigenaars-bootstrap in server.js aangeroepen. Er was dus
   niets te grendelen, maar wel iets te voorkomen: dat de eerste route die dit
   ooit nodig heeft, hem zonder grendel bouwt.

   DRIE DINGEN DIE HIER HARD STAAN:
     1. vervangen alleen met `vervangenMag === true`, net als bij het nummer;
     2. het adres mag niet al van een ander account zijn -- anders kun je een
        bestaand account onbereikbaar maken door zijn adres te claimen;
     3. het nieuwe adres komt binnen als ONBEVESTIGD (email_verified = 0). De
        route die dit aanroept hoort het pas te doen nadat de houder van het
        NIEUWE adres op een link heeft geklikt; deze regel is het vangnet als
        iemand die volgorde ooit omdraait. */
function setEmail(id, email, opties) {
  const adres = String(email || '').trim().toLowerCase().slice(0, 160);
  if (!adres || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adres)) return { error: 'adres' };
  const huidig = getUserById(id);
  if (!huidig) return { error: 'onbekend' };
  const bestaand = String(gebonden.emailOf(huidig) || '').trim().toLowerCase();
  if (bestaand === adres) return huidig;                  // niets te doen
  if (bestaand && !(opties && opties.vervangenMag === true)) {
    return { error: 'herstelkanaal',
      reden: 'Dit account heeft al een e-mailadres. Dat is zowel uw inlognaam als de weg waarlangs een wachtwoord hersteld wordt, en het vervangen ervan vraagt eerst uw wachtwoord en een bevestiging op het nieuwe adres.' };
  }
  const ander = S.zin('SELECT id FROM users WHERE email_hash = ?').get(kluis.emailHash(adres));
  if (ander && Number(ander.id) !== Number(id)) return { error: 'inGebruik' };
  S.zin('UPDATE users SET email_hash = ?, enc_email = ?, email_verified = 0 WHERE id = ?')
    .run(kluis.emailHash(adres), gebonden.zegel('enc_email', id, adres), id);
  mirror.markUser(id);
  return getUserById(id);
}

function renameUser(id, { username, realName, email }) {
  if (email === undefined) {
    S.zin('UPDATE users SET username = ?, enc_name = ? WHERE id = ?')
      .run(username, gebonden.zegel('enc_name', id, realName), id);
  } else {
    S.zin('UPDATE users SET username = ?, enc_name = ?, email_hash = ?, enc_email = ? WHERE id = ?')
      .run(username, gebonden.zegel('enc_name', id, realName), kluis.emailHash(email), gebonden.zegel('enc_email', id, email), id);
  }
  mirror.markUser(id);
  return getUserById(id);
}

/* De pas van een account wijzigen. Dit is de ENIGE manier waarop een account op
   Lifestyle of Business terechtkomt: zelf-registreren levert altijd hooguit RTG
   (zie routes/auth/account.js), en de merkregel eist een menselijk besluit voor
   de betaalde passen. Daarom wordt dit uitsluitend aangeroepen vanuit de
   goedkeuringsflow (kern/aanmeldingen.js beslis), nooit vanuit een client. */
function setTier(id, tier) {
  if (!['rtg', 'lifestyle', 'business', 'guest'].includes(tier)) return null;
  const u = getUserById(id);
  if (!u) return null;
  S.zin('UPDATE users SET tier = ? WHERE id = ?').run(tier, id);
  mirror.markUser(id);
  return getUserById(id);
}

/* Een account aan- of uitzetten (in/uit dienst bij een SSO-organisatie).

   Uitzetten is geen wissen: alles blijft staan, er komt alleen niemand meer
   mee binnen. Dat is precies wat je wilt bij uitdiensttreding -- de facturen
   en boekingen van die persoon horen bewaard te blijven, en als het een
   vergissing was, is het met een schakelaar terug te draaien. */
function zetActief(id, aan) {
  const u = getUserById(id);
  if (!u) return null;
  S.zin('UPDATE users SET actief = ? WHERE id = ?').run(aan ? 1 : 0, id);
  mirror.markUser(id);
  return getUserById(id);
}
const isActief = (u) => !!u && u.actief !== 0;

/* Het schrijven zelf, los van waar de hash vandaan komt. Twee kopieen van deze
   UPDATE lopen uiteen zodra de sessiegrens verandert (LAT.md regel 4). */
function zetWachtwoordHash(userId, hash) {
  // ook hier de sessiegrens, en om dezelfde reden als in tokens.js setPassword:
  // twee wegen naar hetzelfde wachtwoord horen niet twee verschillende dingen
  // met de lopende sessies te doen
  S.zin('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL, sessies_vanaf = ? WHERE id = ?')
    .run(hash, Date.now(), userId);
  mirror.markUser(userId);
  return getUserById(userId);
}
/* ALLEEN DE SESSIEGRENS VERZETTEN, zonder aan het wachtwoord te komen.

   Nodig voor het eigenaarsherstel (kern/eigenaarherstel.js): wie met een quorum
   terugkomt, moet de sessies van wie dan ook kunnen doorsnijden -- een herstel
   dat de sessie van de indringer laat staan, herstelt niets. Het wachtwoord
   hoort daar NIET bij: dat is een tweede handeling met een eigen bewijslast, en
   ze hier samenvoegen zou betekenen dat een herstel stilzwijgend ook het
   wachtwoord vervangt.

   Zelfde kolom en dezelfde betekenis als in zetWachtwoordHash, met opzet: twee
   manieren om sessies te verlopen zouden op een dag twee verschillende
   antwoorden geven op "vanaf wanneer telt een token niet meer". */
function zetSessiegrens(userId) {
  S.zin('UPDATE users SET sessies_vanaf = ? WHERE id = ?').run(Date.now(), userId);
  mirror.markUser(userId);
  return getUserById(userId);
}
/* Wachtwoord zetten zonder await, voor het opstart-seed; verder gelijk aan
   setPassword. Blokkeren kan daar geen kwaad: dit draait voor 'listen'. */
function setPasswordSync(userId, password) {
  return zetWachtwoordHash(userId, kluis.hashPasswordSync(password));
}
/* Alleen voor de demo-seed: de eigenaar krijgt bij elke start zijn bekende
   wachtwoord terug. Zie kluis.zaaiHash. */
function setPasswordZaai(userId, password) {
  return zetWachtwoordHash(userId, kluis.zaaiHash(password));
}

/* DE HASH OPWAARDEREN ZONDER IEMAND UIT TE LOGGEN.

   Lijkt op setPassword en mist met opzet een ding: `sessies_vanaf`. Daar hoort
   dat wel -- wie zijn wachtwoord WIJZIGT gooit elke sessie eruit. Hier is het
   wachtwoord onveranderd en gaan alleen de scrypt-kosten omhoog (zie
   ./wachtwoord.js); zou dit sessies_vanaf zetten, dan vloog elk lid met een
   oude hash er bij zijn volgende inlog overal uit en voelde een stille
   verbetering als een storing. reset_hash blijft er om dezelfde reden af.

   De klaartekst is er alleen bij een GESLAAGDE inlog; daarom staat de aanroep
   daar en nergens anders. */
async function vernieuwWachtwoordHash(userId, password) {
  const u = getUserById(userId);
  if (!u || !kluis.moetVernieuwen(u.password_hash)) return false;
  S.zin('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(await kluis.hashPassword(password), userId);
  mirror.markUser(userId);
  return true;
}

/* Ontsleutelde naam/e-mail (alleen voor de eigenaar zelf of de backoffice). */
const { realNameOf, emailOf, phoneOf } = gebonden; // lezen zit bij de binding

/* De staatloze tokens, de e-mailbevestiging en het wachtwoord-herstel staan
   in ./tokens.js; ze krijgen getUserById mee en verhuizen mee in de export,
   zodat aanroepers niets merken. */
const { issueToken, verifyToken, apparaatVanToken, sessieVan, trekIn, trekInActie, isIngetrokken, trekInSessie, sessieIngetrokken, issueActionToken, verifyActionToken,
  setEmailVerified, createReset, findByReset, setPassword } = require('./tokens').maakTokens(getUserById);

/* Openbaar profiel voor de client (nooit de wachtwoord-hash of ruwe kluis). */
function publicUser(u) {
  if (!u) return null;
  const since = new Date(u.created_at);
  const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const full = realNameOf(u);
  const parts = full.trim().split(/\s+/);
  const shortName = parts.length > 1 ? parts[0][0] + '. ' + parts.slice(1).join(' ') : parts[0];
  return {
    id: u.id, tier: u.tier, name: shortName, full,
    email: emailOf(u), phone: phoneOf(u), codename: u.codename,
    number: 'RTG · ' + since.getFullYear() + ' · ' + String(1000 + u.id).slice(-4),
    since: months[since.getMonth()] + ' ' + since.getFullYear(),
    account: true, verified: u.verified || 'unverified', emailVerified: !!u.email_verified
  };
}

/* Het ledendossier, de verificatie, de kantoorlijsten en de AVG-vergetelheid
   staan in ./dossier.js; ook dat deel krijgt getUserById mee en verhuist mee in
   de export, zodat aanroepers niets merken. */
const { getMemberState, saveMemberState, setVerification, listByVerification,
  conversations, ledenRegisterRijen, deleteUser } = require('./dossier').maakDossier(getUserById);

const { findByPublicMail, reservePublicMail } = require('./publiekmail')({ getUserById, getMemberState, saveMemberState });

module.exports = {
  createUser, createUserSync, createUserZaai, getUserById, findByLogin, count, publicUser,
  /* uit ./publiekmail.js -- hier doorgegeven zodat de gevel (accounts/index.js)
     en alle bestaande aanroepers niets merken van de opsplitsing. */
  findByPublicMail, reservePublicMail,
  renameUser, setTier, zetActief, isActief, realNameOf, emailOf, phoneOf, setPhone, setEmail,
  zetSessiegrens,
  issueToken, verifyToken, apparaatVanToken, sessieVan, trekIn, trekInActie, isIngetrokken, trekInSessie, sessieIngetrokken, issueActionToken, verifyActionToken,
  setEmailVerified, createReset, findByReset, setPassword, setPasswordSync, setPasswordZaai, vernieuwWachtwoordHash,
  getMemberState, saveMemberState, setVerification, listByVerification, conversations, ledenRegisterRijen, deleteUser
};
