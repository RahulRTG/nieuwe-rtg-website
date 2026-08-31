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
function setPhone(id, phone) {
  const nummer = String(phone || '').trim().slice(0, 30);
  if (!nummer) return null;
  S.zin('UPDATE users SET enc_phone = ?, phone_hash = ? WHERE id = ?')
    .run(gebonden.zegel('enc_phone', id, nummer), kluis.phoneHash(nummer), id);
  mirror.markUser(id);
  return getUserById(id);
}

/* Naamswijziging door het huis zelf (opstart-seed van het eigenaarsaccount):
   inlognaam en echte naam in een keer, de kluis blijft de bron. Geef je ook een
   e-mailadres mee, dan verhuist het account daarheen: de zoekhash en de
   versleutelde waarde gaan samen mee, anders zou het account onvindbaar worden. */
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
const { issueToken, verifyToken, sessieVan, trekIn, trekInActie, isIngetrokken, issueActionToken, verifyActionToken,
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
  renameUser, setTier, zetActief, isActief, realNameOf, emailOf, phoneOf, setPhone,
  issueToken, verifyToken, sessieVan, trekIn, trekInActie, isIngetrokken, issueActionToken, verifyActionToken,
  setEmailVerified, createReset, findByReset, setPassword, setPasswordSync, setPasswordZaai, vernieuwWachtwoordHash,
  getMemberState, saveMemberState, setVerification, listByVerification, conversations, ledenRegisterRijen, deleteUser
};
