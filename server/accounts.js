/* ============================================================================
   Echte accounts op een echte database (SQLite), met pseudonimisering.

   Beveiliging rond de codenaam:
   - In de operationele users-tabel staat GEEN echte naam of e-mail in leesbare
     vorm. Alleen de codenaam, tier en inloggegevens. Reserveringen, betalingen
     en De Salon draaien op de codenaam.
   - De echte naam en e-mail liggen versleuteld (AES-256-GCM) in een aparte
     "kluis"-kolom, met een sleutel die los van de database staat (vault.key,
     in productie een secrets manager). Een datalek van de database toont dan
     alleen codenamen, geen identiteiten.
   - Inloggen op e-mail kan zonder de e-mail leesbaar op te slaan: we bewaren een
     HMAC-hash van de e-mail en zoeken daarop.

   Wachtwoorden: scrypt + salt, tijd-veilig vergeleken. Sessietokens: staatloos
   ondertekend (HMAC). Geen externe libraries; alles zit in Node.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// Zelfde datamap als db.js: instelbaar met RTG_DATA_DIR (tests + productie).
const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'rtg.db');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');   // ondertekent sessietokens
const VAULT_FILE = path.join(DATA_DIR, 'vault.key');     // versleutelt de identiteitskluis

let db = null;
let SECRET = null;
let VAULT = null;

const CODENAMES = [
  'Zilveren Valk', 'Gouden Ibis', 'Noordelijke Ster', 'Witte Reiger', 'Blauwe Fenix',
  'Stille Havik', 'Rode Kraanvogel', 'Zwarte Zwaan', 'Zilveren Lynx', 'Gouden Panter',
  'Nachtorchidee', 'Zeearend', 'Poolvos', 'Marmeren Valk', 'Saffieren Ooievaar'
];

function loadKey(file) {
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const k = crypto.randomBytes(32);
  fs.writeFileSync(file, k);
  return k;
}

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_hash TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'rtg',
    codename TEXT,
    enc_name TEXT,
    enc_email TEXT,
    enc_phone TEXT,
    phone_hash TEXT,
    created_at TEXT NOT NULL,
    verified TEXT NOT NULL DEFAULT 'unverified',
    id_doc TEXT,
    member_state TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    reset_hash TEXT,
    reset_expires INTEGER
  )`);
  // Migratie: voeg ontbrekende kolommen toe voor oudere databases.
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  const add = (n, d) => { if (!cols.includes(n)) db.exec(`ALTER TABLE users ADD COLUMN ${n} ${d}`); };
  add('email_hash', 'TEXT'); add('enc_name', 'TEXT'); add('enc_email', 'TEXT');
  add('enc_phone', 'TEXT'); add('phone_hash', 'TEXT');
  add('verified', "TEXT NOT NULL DEFAULT 'unverified'"); add('id_doc', 'TEXT'); add('member_state', 'TEXT');
  add('email_verified', 'INTEGER NOT NULL DEFAULT 0'); add('reset_hash', 'TEXT'); add('reset_expires', 'INTEGER');

  // Personeelsaccounts binnen een leverancier-bedrijfsaccount (PIN-login).
  db.exec(`CREATE TABLE IF NOT EXISTS supplier_staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_code TEXT NOT NULL,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`);
  try { db.exec('ALTER TABLE supplier_staff ADD COLUMN func TEXT'); } catch (e) { /* kolom bestaat al */ }

  SECRET = loadKey(SECRET_FILE);
  VAULT = loadKey(VAULT_FILE);
}

/* ---------- identiteitskluis (versleuteling van naam/e-mail) ---------- */
function enc(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', VAULT, iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function dec(blob) {
  if (!blob) return null;
  try {
    const buf = Buffer.from(blob, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', VAULT, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return null; }
}
function emailHash(email) {
  return crypto.createHmac('sha256', VAULT).update(String(email || '').trim().toLowerCase()).digest('hex');
}
// Normaliseer een telefoonnummer tot louter cijfers (met landcode) voor de hash,
// zodat een inkomend WhatsApp-nummer aan het juiste account gekoppeld kan worden.
function normalizePhone(phone) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0')) p = '+31' + p.slice(1); // NL-standaard voor de demo
  if (!p.startsWith('+') && p.length >= 9) p = '+' + p;
  return p.replace(/\D/g, '');
}
function phoneHash(phone) {
  const n = normalizePhone(phone);
  return n ? crypto.createHmac('sha256', VAULT).update(n).digest('hex') : null;
}

/* ---------- wachtwoorden (scrypt + salt, tijd-veilige vergelijking) ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
function verifyPassword(pw, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], 'hex');
  const expected = Buffer.from(parts[1], 'hex');
  const actual = crypto.scryptSync(String(pw), salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function makeCodename() {
  return CODENAMES[crypto.randomInt(CODENAMES.length)] + ' ' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

/* ---------- gebruikers ---------- */
function createUser({ email, username, password, tier, realName, phone }) {
  tier = ['rtg', 'lifestyle', 'business'].includes(tier) ? tier : 'rtg';
  const info = db.prepare(
    `INSERT INTO users (email_hash, username, password_hash, tier, codename, enc_name, enc_email, enc_phone, phone_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    email ? emailHash(email) : null,
    username || null,
    hashPassword(password),
    tier,
    makeCodename(),
    enc(realName),
    enc(email),
    phone ? enc(phone) : null,
    phone ? phoneHash(phone) : null,
    new Date().toISOString()
  );
  return getUserById(info.lastInsertRowid);
}
function findByPhone(phone) {
  const h = phoneHash(phone);
  if (!h) return null;
  return db.prepare('SELECT * FROM users WHERE phone_hash = ?').get(h) || null;
}
function getUserById(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null; }
function findByLogin(login) {
  const v = String(login || '').trim();
  if (!v) return null;
  const byEmail = db.prepare('SELECT * FROM users WHERE email_hash = ?').get(emailHash(v));
  if (byEmail) return byEmail;
  return db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(v) || null;
}
function count() { return db.prepare('SELECT COUNT(*) AS c FROM users').get().c; }

/* Ontsleutelde naam/e-mail (alleen voor de eigenaar zelf of de backoffice). */
function realNameOf(u) { return u ? (dec(u.enc_name) || u.username || 'Lid') : null; }
function emailOf(u) { return u ? dec(u.enc_email) : null; }
function phoneOf(u) { return u ? dec(u.enc_phone) : null; }

/* ---------- staatloze ondertekende tokens ---------- */
function sign(body) { return crypto.createHmac('sha256', SECRET).update(body).digest('hex').slice(0, 32); }
function issueToken(userId, days = 30) {
  const body = userId + '.' + (Date.now() + days * 86400000);
  return Buffer.from(body).toString('base64url') + '.' + sign(body);
}
function verifyToken(token) {
  try {
    const [b64, sig] = String(token).split('.');
    if (!b64 || !sig) return null;
    const body = Buffer.from(b64, 'base64url').toString();
    if (sign(body) !== sig) return null;
    const [id, exp] = body.split('.');
    if (Number(exp) < Date.now()) return null;
    return getUserById(Number(id));
  } catch (e) { return null; }
}
/* Doel-gebonden token (bijv. e-mailbevestiging), los van de sessie. */
function issueActionToken(userId, purpose, ttlMs) {
  const body = userId + '.' + purpose + '.' + (Date.now() + ttlMs);
  return Buffer.from(body).toString('base64url') + '.' + sign(body);
}
function verifyActionToken(token, purpose) {
  try {
    const [b64, sig] = String(token).split('.');
    if (!b64 || !sig || sign(Buffer.from(b64, 'base64url').toString()) !== sig) return null;
    const [id, p, exp] = Buffer.from(b64, 'base64url').toString().split('.');
    if (p !== purpose || Number(exp) < Date.now()) return null;
    return getUserById(Number(id));
  } catch (e) { return null; }
}

/* ---------- e-mailbevestiging & wachtwoord-herstel ---------- */
function setEmailVerified(userId) {
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
  return getUserById(userId);
}
function createReset(userId, ttlMs = 3600000) {
  const token = crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare('UPDATE users SET reset_hash = ?, reset_expires = ? WHERE id = ?').run(hash, Date.now() + ttlMs, userId);
  return token;
}
function findByReset(token) {
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const u = db.prepare('SELECT * FROM users WHERE reset_hash = ?').get(hash);
  if (!u || !u.reset_expires || u.reset_expires < Date.now()) return null;
  return u;
}
function setPassword(userId, password) {
  db.prepare('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL WHERE id = ?')
    .run(hashPassword(password), userId);
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
  const row = db.prepare('SELECT member_state FROM users WHERE id = ?').get(userId);
  if (!row || !row.member_state) return null;
  try { return JSON.parse(row.member_state); } catch (e) { return null; }
}
function saveMemberState(userId, obj) {
  db.prepare('UPDATE users SET member_state = ? WHERE id = ?').run(JSON.stringify(obj), userId);
}

/* ---------- identiteitsverificatie ---------- */
function setVerification(userId, status, docFilename) {
  if (docFilename !== undefined) db.prepare('UPDATE users SET verified = ?, id_doc = ? WHERE id = ?').run(status, docFilename, userId);
  else db.prepare('UPDATE users SET verified = ? WHERE id = ?').run(status, userId);
  return getUserById(userId);
}
function listByVerification(status) {
  return db.prepare('SELECT * FROM users WHERE verified = ? ORDER BY created_at DESC').all(status);
}

/* Gesprekken (WhatsApp + app) per account, voor de concierge-inbox. */
function conversations() {
  const rows = db.prepare('SELECT id, tier, codename, member_state FROM users WHERE member_state IS NOT NULL').all();
  return rows.map(r => {
    let md = {}; try { md = JSON.parse(r.member_state) || {}; } catch (e) {}
    return { id: r.id, tier: r.tier, codename: r.codename, conversation: md.conversation || [], needsConcierge: !!md.needsConcierge };
  }).filter(x => x.conversation.length);
}

/* ---------- leverancier-personeel (PIN-accounts binnen een bedrijf) ---------- */
function createStaff({ supplierCode, name, pin, role, func }) {
  const info = db.prepare(
    'INSERT INTO supplier_staff (supplier_code, name, pin_hash, role, func, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(String(supplierCode || '').toUpperCase(), String(name).slice(0, 60), hashPassword(String(pin)), role === 'manager' ? 'manager' : 'staff', func ? String(func).slice(0, 40) : null, new Date().toISOString());
  return getStaffById(info.lastInsertRowid);
}
function getStaffById(id) { return db.prepare('SELECT * FROM supplier_staff WHERE id = ? AND active = 1').get(id) || null; }
function listStaff(code) { return db.prepare('SELECT * FROM supplier_staff WHERE supplier_code = ? AND active = 1 ORDER BY (role=\'manager\') DESC, id').all(String(code || '').toUpperCase()); }
function countStaff(code) { return db.prepare('SELECT COUNT(*) AS c FROM supplier_staff WHERE supplier_code = ? AND active = 1').get(String(code || '').toUpperCase()).c; }
function verifyStaffPin(id, pin) { const s = getStaffById(id); return (s && verifyPassword(String(pin), s.pin_hash)) ? s : null; }
function deactivateStaff(id) { db.prepare('UPDATE supplier_staff SET active = 0 WHERE id = ?').run(id); }
function publicStaff(s) { return s ? { id: s.id, name: s.name, role: s.role, func: s.func || null } : null; }
function makePin() { return String(crypto.randomInt(1000, 10000)); }

/* AVG-vergetelheid: verwijdert het account definitief. Geeft de bestandsnaam
   van een eventueel geupload identiteitsdocument terug, zodat de server die
   ook van schijf kan wissen. */
function deleteUser(id) {
  const u = getUserById(id);
  if (!u) return null;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return u.id_doc || null;
}

module.exports = {
  init, createUser, getUserById, findByLogin, findByPhone, verifyPassword, issueToken, verifyToken, count, publicUser,
  createStaff, getStaffById, listStaff, countStaff, verifyStaffPin, deactivateStaff, publicStaff, makePin, deleteUser,
  getMemberState, saveMemberState, setVerification, listByVerification, conversations,
  realNameOf, emailOf, phoneOf, issueActionToken, verifyActionToken,
  setEmailVerified, createReset, findByReset, setPassword
};
