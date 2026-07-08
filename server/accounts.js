/* ============================================================================
   Echte accounts op een echte database (SQLite).

   Vervangt de demo-login: gebruikers registreren met e-mail/gebruikersnaam en
   een wachtwoord dat veilig wordt gehasht (scrypt, met salt). Sessietokens
   worden staatloos ondertekend (HMAC), zodat ze een herstart overleven zonder
   sessies in het geheugen. Geen externe libraries nodig; alles zit in Node.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'rtg.db');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');

let db = null;
let SECRET = null;

const CODENAMES = [
  'Zilveren Valk', 'Gouden Ibis', 'Noordelijke Ster', 'Witte Reiger', 'Blauwe Fenix',
  'Stille Havik', 'Rode Kraanvogel', 'Zwarte Zwaan', 'Zilveren Lynx', 'Gouden Panter',
  'Nachtorchidee', 'Zeearend', 'Poolvos', 'Marmeren Valk', 'Saffieren Ooievaar'
];

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'rtg',
    codename TEXT,
    real_name TEXT,
    created_at TEXT NOT NULL,
    verified TEXT NOT NULL DEFAULT 'unverified',
    id_doc TEXT,
    member_state TEXT
  )`);
  // Migratie voor databases van vóór de verificatie-/ledeninhoud-kolommen.
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  for (const [name, def] of [['verified', "TEXT NOT NULL DEFAULT 'unverified'"], ['id_doc', 'TEXT'], ['member_state', 'TEXT']]) {
    if (!cols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
  }
  if (fs.existsSync(SECRET_FILE)) {
    SECRET = fs.readFileSync(SECRET_FILE);
  } else {
    SECRET = crypto.randomBytes(32);
    fs.writeFileSync(SECRET_FILE, SECRET);
  }
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
function createUser({ email, username, password, tier, realName }) {
  tier = ['rtg', 'lifestyle', 'business'].includes(tier) ? tier : 'rtg';
  const stmt = db.prepare(
    `INSERT INTO users (email, username, password_hash, tier, codename, real_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const info = stmt.run(
    email ? email.toLowerCase() : null,
    username || null,
    hashPassword(password),
    tier,
    makeCodename(),
    realName || null,
    new Date().toISOString()
  );
  return getUserById(info.lastInsertRowid);
}
function getUserById(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null; }
function findByLogin(login) {
  const v = String(login || '').trim().toLowerCase();
  if (!v) return null;
  return db.prepare('SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ?').get(v, v) || null;
}
function count() { return db.prepare('SELECT COUNT(*) AS c FROM users').get().c; }

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

/* Openbaar profiel dat de client mag zien (nooit de wachtwoord-hash). */
function publicUser(u) {
  if (!u) return null;
  const since = new Date(u.created_at);
  const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const parts = (u.real_name || u.username || 'Lid').trim().split(/\s+/);
  const shortName = parts.length > 1 ? parts[0][0] + '. ' + parts.slice(1).join(' ') : parts[0];
  return {
    id: u.id, tier: u.tier, name: shortName, full: u.real_name || u.username || 'Lid',
    codename: u.codename,
    number: 'RTG · ' + since.getFullYear() + ' · ' + String(1000 + u.id).slice(-4),
    since: months[since.getMonth()] + ' ' + since.getFullYear(),
    account: true, verified: u.verified || 'unverified'
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

module.exports = {
  init, createUser, getUserById, findByLogin, verifyPassword, issueToken, verifyToken, count, publicUser,
  getMemberState, saveMemberState, setVerification, listByVerification
};
