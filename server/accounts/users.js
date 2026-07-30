/* Accounts, deel "users": de ledenaccounts. Aanmaken (async scrypt of de sync
   seed-variant), zoeken op login, het openbare profiel, de staatloze sessie- en
   actie-tokens, de e-mailbevestiging en het wachtwoord-herstel, de per-persoon
   ledeninhoud, de identiteitsverificatie en de AVG-vergetelheid. Afgesplitst uit
   accounts.js; crypto komt uit ./kluis, de Postgres-spiegel uit ./mirror. */
const crypto = require('crypto');
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');

/* createUser is asynchroon (scrypt in de threadpool); createUserSync bestaat
   voor het opstart-seed en tests, waar blokkeren geen kwaad kan. */
async function createUser(gegevens) {
  return schrijfUser(gegevens, await kluis.hashPassword(gegevens.password));
}
function createUserSync(gegevens) {
  return schrijfUser(gegevens, kluis.hashPasswordSync(gegevens.password));
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
    S.db.prepare(`INSERT INTO users (id, ${kolommen}) VALUES (?, ${vals.map(() => '?').join(', ')})`).run(id, ...vals);
    newId = id;
  } else {
    const info = S.db.prepare(`INSERT INTO users (${kolommen}) VALUES (${vals.map(() => '?').join(', ')})`).run(...vals);
    newId = info.lastInsertRowid;
  }
  mirror.markUser(newId);
  return getUserById(newId);
}
function getUserById(id) { return S.db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null; }
function findByLogin(login) {
  const v = String(login || '').trim();
  if (!v) return null;
  const byEmail = S.db.prepare('SELECT * FROM users WHERE email_hash = ?').get(kluis.emailHash(v));
  if (byEmail) return byEmail;
  return S.db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(v) || null;
}
function count() { return S.db.prepare('SELECT COUNT(*) AS c FROM users').get().c; }

/* Naamswijziging door het huis zelf (opstart-seed van het eigenaarsaccount):
   inlognaam en echte naam in een keer, de kluis blijft de bron. Geef je ook een
   e-mailadres mee, dan verhuist het account daarheen: de zoekhash en de
   versleutelde waarde gaan samen mee, anders zou het account onvindbaar worden. */
function renameUser(id, { username, realName, email }) {
  if (email === undefined) {
    S.db.prepare('UPDATE users SET username = ?, enc_name = ? WHERE id = ?')
      .run(username, kluis.enc(realName), id);
  } else {
    S.db.prepare('UPDATE users SET username = ?, enc_name = ?, email_hash = ?, enc_email = ? WHERE id = ?')
      .run(username, kluis.enc(realName), kluis.emailHash(email), kluis.enc(email), id);
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
  S.db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, id);
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
  S.db.prepare('UPDATE users SET actief = ? WHERE id = ?').run(aan ? 1 : 0, id);
  mirror.markUser(id);
  return getUserById(id);
}
const isActief = (u) => !!u && u.actief !== 0;

/* Wachtwoord zetten zonder await, voor het opstart-seed; verder gelijk aan
   setPassword. Blokkeren kan daar geen kwaad: dit draait voor 'listen'. */
function setPasswordSync(userId, password) {
  S.db.prepare('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL WHERE id = ?')
    .run(kluis.hashPasswordSync(password), userId);
  mirror.markUser(userId);
  return getUserById(userId);
}

/* Ontsleutelde naam/e-mail (alleen voor de eigenaar zelf of de backoffice). */
function realNameOf(u) { return u ? (kluis.dec(u.enc_name) || u.username || 'Lid') : null; }
function emailOf(u) { return u ? kluis.dec(u.enc_email) : null; }
function phoneOf(u) { return u ? kluis.dec(u.enc_phone) : null; }

/* De staatloze tokens, de e-mailbevestiging en het wachtwoord-herstel staan
   in ./tokens.js; ze krijgen getUserById mee en verhuizen mee in de export,
   zodat aanroepers niets merken. */
const { issueToken, verifyToken, trekIn, trekInActie, isIngetrokken, issueActionToken, verifyActionToken,
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

/* ---------- ledeninhoud per persoon (eigen boekingen/betalingen) ---------- */
function getMemberState(userId) {
  const row = S.db.prepare('SELECT member_state FROM users WHERE id = ?').get(userId);
  if (!row || !row.member_state) return null;
  try { return JSON.parse(kluis.decVeld(row.member_state)); } catch (e) { return null; }
}
/* Het ledendossier gaat versleuteld de kolom in. Dat is geen luxe: hier staan
   de gesprekken met Rahul, de boekingen, de facturen en de geboortedatum, en
   ze staan in DEZELFDE rij als de identiteit. Bleef dit platte tekst, dan zou
   wie de accountdatabase in handen krijgt het hele dossier kunnen lezen, terwijl
   de naam ernaast wel versleuteld is. Dat maakt het codenaam-ontwerp waardeloos.
   De Postgres-spiegel kopieert de kolom ongewijzigd en erft de bescherming. */
function saveMemberState(userId, obj) {
  S.db.prepare('UPDATE users SET member_state = ? WHERE id = ?').run(kluis.encVeld(JSON.stringify(obj)), userId);
  mirror.markUser(userId);
}

/* ---------- identiteitsverificatie ---------- */
function setVerification(userId, status, docFilename) {
  if (docFilename !== undefined) S.db.prepare('UPDATE users SET verified = ?, id_doc = ? WHERE id = ?').run(status, docFilename, userId);
  else S.db.prepare('UPDATE users SET verified = ? WHERE id = ?').run(status, userId);
  mirror.markUser(userId);
  return getUserById(userId);
}
function listByVerification(status) {
  return S.db.prepare('SELECT * FROM users WHERE verified = ? ORDER BY created_at DESC').all(status);
}

/* Gesprekken in de app per account, voor de concierge-inbox. */
function conversations() {
  const rows = S.db.prepare('SELECT id, tier, codename, member_state FROM users WHERE member_state IS NOT NULL').all();
  return rows.map(r => {
    let md = {}; try { md = JSON.parse(kluis.decVeld(r.member_state)) || {}; } catch (e) {}
    return { id: r.id, tier: r.tier, codename: r.codename, conversation: md.conversation || [], needsConcierge: !!md.needsConcierge };
  }).filter(x => x.conversation.length);
}

/* De leden voor het ledenregister (kantoor): codenaam, pas en de facetten
   (geslacht v/m/x, land) uit de member_state. Nooit de echte naam -- die blijft
   in de kluis. Begrensd (de boardroom leest een venster, geen miljoenen rijen);
   met een echt grootboek (Postgres) zou dit aggregatie-per-facet worden. */
function ledenRegisterRijen(limit) {
  const n = Math.max(1, Math.min(Number(limit) || 5000, 20000));
  const rows = S.db.prepare('SELECT id, tier, codename, member_state FROM users ORDER BY codename ASC LIMIT ?').all(n);
  return rows.map(r => {
    let md = {}; try { md = r.member_state ? (JSON.parse(kluis.decVeld(r.member_state)) || {}) : {}; } catch (e) {}
    const gs = String(md.geslacht || '').toLowerCase();
    return { id: r.id, key: 'user-' + r.id, tier: r.tier || 'rtg', codename: r.codename || null,
      geslacht: (gs === 'v' || gs === 'm' || gs === 'x') ? gs : null, land: md.land || null };
  });
}

/* AVG-vergetelheid: verwijdert het account definitief. Geeft de bestandsnaam
   van een eventueel geupload identiteitsdocument terug, zodat de server die
   ook van schijf kan wissen. */
function deleteUser(id) {
  const u = getUserById(id);
  if (!u) return null;
  S.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  mirror.markDelete(id);
  return u.id_doc || null;
}

module.exports = {
  createUser, createUserSync, getUserById, findByLogin, count, publicUser,
  renameUser, setTier, zetActief, isActief, realNameOf, emailOf, phoneOf,
  issueToken, verifyToken, trekIn, trekInActie, isIngetrokken, issueActionToken, verifyActionToken,
  setEmailVerified, createReset, findByReset, setPassword, setPasswordSync,
  getMemberState, saveMemberState, setVerification, listByVerification, conversations, ledenRegisterRijen, deleteUser
};
