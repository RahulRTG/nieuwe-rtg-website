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

/* Ontsleutelde naam/e-mail (alleen voor de eigenaar zelf of de backoffice). */
function realNameOf(u) { return u ? (kluis.dec(u.enc_name) || u.username || 'Lid') : null; }
function emailOf(u) { return u ? kluis.dec(u.enc_email) : null; }
function phoneOf(u) { return u ? kluis.dec(u.enc_phone) : null; }

/* ---------- staatloze ondertekende tokens ---------- */
function issueToken(userId, days = 30) {
  const body = userId + '.' + (Date.now() + days * 86400000);
  return Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
}
function verifyToken(token) {
  try {
    const [b64, sig] = String(token).split('.');
    if (!b64 || !sig) return null;
    const body = Buffer.from(b64, 'base64url').toString();
    if (kluis.sign(body) !== sig) return null;
    const [id, exp] = body.split('.');
    if (Number(exp) < Date.now()) return null;
    return getUserById(Number(id));
  } catch (e) { return null; }
}
/* Doel-gebonden token (bijv. e-mailbevestiging), los van de sessie. */
function issueActionToken(userId, purpose, ttlMs) {
  const body = userId + '.' + purpose + '.' + (Date.now() + ttlMs);
  return Buffer.from(body).toString('base64url') + '.' + kluis.sign(body);
}
function verifyActionToken(token, purpose) {
  try {
    const [b64, sig] = String(token).split('.');
    if (!b64 || !sig || kluis.sign(Buffer.from(b64, 'base64url').toString()) !== sig) return null;
    const [id, p, exp] = Buffer.from(b64, 'base64url').toString().split('.');
    if (p !== purpose || Number(exp) < Date.now()) return null;
    return getUserById(Number(id));
  } catch (e) { return null; }
}

/* ---------- e-mailbevestiging & wachtwoord-herstel ---------- */
function setEmailVerified(userId) {
  S.db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
  mirror.markUser(userId);
  return getUserById(userId);
}
function createReset(userId, ttlMs = 3600000) {
  const token = crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  S.db.prepare('UPDATE users SET reset_hash = ?, reset_expires = ? WHERE id = ?').run(hash, Date.now() + ttlMs, userId);
  mirror.markUser(userId);
  return token;
}
function findByReset(token) {
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const u = S.db.prepare('SELECT * FROM users WHERE reset_hash = ?').get(hash);
  if (!u || !u.reset_expires || u.reset_expires < Date.now()) return null;
  return u;
}
async function setPassword(userId, password) {
  S.db.prepare('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL WHERE id = ?')
    .run(await kluis.hashPassword(password), userId);
  mirror.markUser(userId);
  return getUserById(userId);
}

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
  try { return JSON.parse(row.member_state); } catch (e) { return null; }
}
function saveMemberState(userId, obj) {
  S.db.prepare('UPDATE users SET member_state = ? WHERE id = ?').run(JSON.stringify(obj), userId);
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
    let md = {}; try { md = JSON.parse(r.member_state) || {}; } catch (e) {}
    return { id: r.id, tier: r.tier, codename: r.codename, conversation: md.conversation || [], needsConcierge: !!md.needsConcierge };
  }).filter(x => x.conversation.length);
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
  realNameOf, emailOf, phoneOf,
  issueToken, verifyToken, issueActionToken, verifyActionToken,
  setEmailVerified, createReset, findByReset, setPassword,
  getMemberState, saveMemberState, setVerification, listByVerification, conversations, deleteUser
};
