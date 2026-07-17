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
// Gedeelde accounts over meerdere instances: met DATABASE_URL spiegelt SQLite
// naar PostgreSQL (zie server/pgaccounts.js). Zonder verandert er niets.
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL || null;
const PGMODE = !!DATABASE_URL;
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

/* Sleutels laden. Bij meerdere instances MOETEN de identiteitskluis (VAULT) en
   de token-ondertekening (SECRET) op elke instance gelijk zijn, anders kan de ene
   instance de gegevens van de andere niet ontsleutelen en klopt de e-mail-hash
   voor het inloggen niet. Daarom eerst uit de omgeving (gedeeld secret manager),
   en pas als terugval een lokaal bestand (prima voor één instance / lokaal). */
function loadKey(file, envName) {
  const env = envName ? process.env[envName] : null;
  if (env) return /^[0-9a-fA-F]{64}$/.test(env) ? Buffer.from(env, 'hex') : crypto.createHash('sha256').update(env).digest();
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const k = crypto.randomBytes(32);
  try { fs.writeFileSync(file, k); } catch (e) {}
  return k;
}

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  /* WAL + busy_timeout: lezers en schrijvers blokkeren elkaar niet meer, en
     als twee processen dezelfde accountsdatabase raken (failover-trio, een
     herstart die de oude instance een tel overlapt, parallelle testservers)
     wacht de tweede even in plaats van hard te crashen op "database is
     locked". Dit was de bron van de sporadische testflake. */
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA synchronous=NORMAL');
  db.exec('PRAGMA busy_timeout=5000');
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

  // Inloggen op gebruikersnaam gebeurt hoofdletter-ongevoelig (lower(username)).
  // De UNIQUE-index op username is hoofdlettergevoelig en kan die zoekopdracht
  // niet bedienen, dus zonder deze expressie-index scant elke gebruikersnaam-login
  // (en elke MISLUKTE login, die door de e-mail-tak heen valt) de hele tabel. Bij
  // een miljoen leden is dat ~170 ms per poging; met de index blijft het < 1 ms.
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users(lower(username))'); } catch (e) {}

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
  // Personeel is voortaan een RTG-lid: member_id koppelt het personeelsaccount
  // aan het ledenaccount (users.id), member_tier bewaart de pas op moment van
  // aanmelden. Oudere/geseede accounts hebben deze leeg (member_id NULL).
  try { db.exec('ALTER TABLE supplier_staff ADD COLUMN member_id INTEGER'); } catch (e) { /* bestaat al */ }
  try { db.exec('ALTER TABLE supplier_staff ADD COLUMN member_tier TEXT'); } catch (e) { /* bestaat al */ }
  // Personeel wordt altijd per bedrijf opgevraagd (listStaff/verifyStaffPin).
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_staff_supplier ON supplier_staff(supplier_code)'); } catch (e) {}

  SECRET = loadKey(SECRET_FILE, 'RTG_SECRET_KEY');
  VAULT = loadKey(VAULT_FILE, 'RTG_VAULT_KEY');
}

/* ---------- PostgreSQL-spiegel (alleen met DATABASE_URL) ----------
   SQLite blijft de synchrone lokale cache; elke wijziging wordt (gecoalesceerd)
   naar Postgres doorgeschreven, en bij het opstarten trekken we de gedeelde
   staat uit Postgres. Zonder DATABASE_URL is dit alles inert. */
let pg = null, pgKlaar = false, idBlok = null, idRefillBezig = false, externCb = null;
const pgLog = { warn: (m, v) => console.warn('[pgaccounts]', m, v || '') };
const vuileUsers = new Set(), vuileStaff = new Set(), verwijderdeUsers = new Set();
let mirrorTimer = null;

function rawUser(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null; }
function rawStaff(id) { return db.prepare('SELECT * FROM supplier_staff WHERE id = ?').get(id) || null; }

function nieuwId() {
  if (!PGMODE || !idBlok) return null;              // buiten PG of vóór reservering: SQLite-autoincrement
  if (idBlok.volgende > idBlok.eind) { refillBlok(); return null; }
  const id = idBlok.volgende++;
  if (idBlok.eind - idBlok.volgende < 100) refillBlok(); // ruim op tijd bijvullen
  return id;
}
async function refillBlok() {
  if (idRefillBezig || !pg) return;
  idRefillBezig = true;
  try { idBlok = await pg.reserveerBlok(); }
  catch (e) { pgLog.warn('id-blok reserveren mislukt', { fout: e.message }); }
  finally { idRefillBezig = false; }
}

function planMirror() { if (!PGMODE || !pgKlaar || mirrorTimer) return; mirrorTimer = setTimeout(flushMirror, 150); if (mirrorTimer.unref) mirrorTimer.unref(); }
async function flushMirror() {
  mirrorTimer = null;
  if (!pg || !pgKlaar) return;
  const us = [...vuileUsers]; vuileUsers.clear();
  const ss = [...vuileStaff]; vuileStaff.clear();
  const del = [...verwijderdeUsers]; verwijderdeUsers.clear();
  for (const id of del) { try { await pg.deleteUser(id); } catch (e) { verwijderdeUsers.add(id); } }
  for (const id of us) { const r = rawUser(id); if (r) { try { await pg.upsertUser(r); } catch (e) { vuileUsers.add(id); } } }
  for (const id of ss) { const r = rawStaff(id); if (r) { try { await pg.upsertStaff(r); } catch (e) { vuileStaff.add(id); } } }
  if (vuileUsers.size || vuileStaff.size || verwijderdeUsers.size) planMirror();
}
function markUser(id) { if (PGMODE && id != null) { vuileUsers.add(Number(id)); planMirror(); } }
function markStaff(id) { if (PGMODE && id != null) { vuileStaff.add(Number(id)); planMirror(); } }
function markDelete(id) { if (PGMODE && id != null) { verwijderdeUsers.add(Number(id)); vuileUsers.delete(Number(id)); planMirror(); } }

// Trek een enkele, door NOTIFY gemelde rij van een ander proces in de lokale cache.
function upsertLocalUser(r) {
  const cols = pg.USER_COLS;
  db.prepare(`INSERT OR REPLACE INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map(c => r[c] === undefined ? null : r[c]));
}
function upsertLocalStaff(r) {
  const cols = pg.STAFF_COLS;
  db.prepare(`INSERT OR REPLACE INTO supplier_staff (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map(c => r[c] === undefined ? null : r[c]));
}
async function pullEen(payload) {
  try {
    const [soort, idStr] = String(payload).split(':'); const id = Number(idStr);
    if (soort === 'user') {
      const { rows } = await pg.pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (rows.length) upsertLocalUser(rows[0]); else db.prepare('DELETE FROM users WHERE id = ?').run(id);
      if (externCb) externCb();
    } else if (soort === 'staff') {
      const { rows } = await pg.pool.query('SELECT * FROM supplier_staff WHERE id = $1', [id]);
      if (rows.length) upsertLocalStaff(rows[0]);
    }
  } catch (e) {}
}

/* Start de Postgres-spiegel: schema klaarzetten, gedeelde staat ophalen
   (Postgres wint), lokale rijen die nog niet gedeeld zijn erheen duwen (eerste
   migratie), een id-blok reserveren en live meeluisteren. */
async function startPostgres() {
  if (!PGMODE) return false;
  pg = require('./pgaccounts').maakPgAccounts({ url: DATABASE_URL, log: pgLog });
  await pg.schema();
  const { users, staff } = await pg.pullAlles();
  for (const r of users) upsertLocalUser(r);   // Postgres wint
  for (const r of staff) upsertLocalStaff(r);
  // Lokale rijen die (nog) niet in Postgres staan: eenmalig erheen duwen.
  const pgUserIds = new Set(users.map(r => Number(r.id)));
  const pgStaffIds = new Set(staff.map(r => Number(r.id)));
  for (const r of db.prepare('SELECT id FROM users').all()) if (!pgUserIds.has(Number(r.id))) markUser(r.id);
  for (const r of db.prepare('SELECT id FROM supplier_staff').all()) if (!pgStaffIds.has(Number(r.id))) markStaff(r.id);
  idBlok = await pg.reserveerBlok();
  pgKlaar = true;
  planMirror(); // duw eventuele lokaal-only rijen nu weg
  await pg.luister(pullEen);
  console.log('[accounts] PostgreSQL-spiegel actief (gedeelde accounts over instances).');
  return true;
}
function onExternalChange(cb) { externCb = cb; }
async function flushBijAfsluiten() { if (PGMODE && pg && pgKlaar) { try { await flushMirror(); } catch (e) {} } }

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
// zodat een telefoonnummer aan het juiste account gekoppeld kan worden.
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

/* ---------- wachtwoorden (scrypt + salt, tijd-veilige vergelijking) ----------
   scrypt is bewust zwaar (dat is de bescherming), maar de synchrone variant
   blokkeert de HELE server tijdens het rekenen: bij 100 gelijktijdige logins
   stond alles seconden stil. De asynchrone variant rekent in de threadpool
   naast de server, zodat andere verzoeken gewoon doorlopen. De Sync-varianten
   blijven bestaan voor het opstarten (seed) en tests: eenmalig blokkeren voor
   'listen' is prima en houdt de boot deterministisch. */
const scryptAsync = (pw, salt, len) => new Promise((resolve, reject) =>
  crypto.scrypt(pw, salt, len, (err, key) => err ? reject(err) : resolve(key)));

function hashPasswordSync(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], 'hex');
  const expected = Buffer.from(parts[1], 'hex');
  const actual = await scryptAsync(String(pw), salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function makeCodename() {
  return CODENAMES[crypto.randomInt(CODENAMES.length)] + ' ' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

/* ---------- gebruikers ---------- */
/* createUser is asynchroon (scrypt in de threadpool); createUserSync bestaat
   voor het opstart-seed en tests, waar blokkeren geen kwaad kan. */
async function createUser(gegevens) {
  return schrijfUser(gegevens, await hashPassword(gegevens.password));
}
function createUserSync(gegevens) {
  return schrijfUser(gegevens, hashPasswordSync(gegevens.password));
}
function schrijfUser({ email, username, tier, realName, phone }, passwordHash) {
  // 'guest' is de gratis (bestel/betaal) laag: een echt account met paspoort,
  // maar zonder betaalde pas. rtg/lifestyle/business zijn de betaalde passen.
  tier = ['rtg', 'lifestyle', 'business', 'guest'].includes(tier) ? tier : 'rtg';
  const vals = [
    email ? emailHash(email) : null,
    username || null,
    passwordHash,
    tier,
    makeCodename(),
    enc(realName),
    enc(email),
    phone ? enc(phone) : null,
    phone ? phoneHash(phone) : null,
    new Date().toISOString()
  ];
  const kolommen = 'email_hash, username, password_hash, tier, codename, enc_name, enc_email, enc_phone, phone_hash, created_at';
  // In Postgres-modus geven we een globaal uniek id mee (uit het gereserveerde
  // blok), zodat twee instances nooit hetzelfde id uitdelen. Anders SQLite-autoincrement.
  const id = nieuwId();
  let newId;
  if (id != null) {
    db.prepare(`INSERT INTO users (id, ${kolommen}) VALUES (?, ${vals.map(() => '?').join(', ')})`).run(id, ...vals);
    newId = id;
  } else {
    const info = db.prepare(`INSERT INTO users (${kolommen}) VALUES (${vals.map(() => '?').join(', ')})`).run(...vals);
    newId = info.lastInsertRowid;
  }
  markUser(newId);
  return getUserById(newId);
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
  markUser(userId);
  return getUserById(userId);
}
function createReset(userId, ttlMs = 3600000) {
  const token = crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare('UPDATE users SET reset_hash = ?, reset_expires = ? WHERE id = ?').run(hash, Date.now() + ttlMs, userId);
  markUser(userId);
  return token;
}
function findByReset(token) {
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const u = db.prepare('SELECT * FROM users WHERE reset_hash = ?').get(hash);
  if (!u || !u.reset_expires || u.reset_expires < Date.now()) return null;
  return u;
}
async function setPassword(userId, password) {
  db.prepare('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL WHERE id = ?')
    .run(await hashPassword(password), userId);
  markUser(userId);
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
  markUser(userId);
}

/* ---------- identiteitsverificatie ---------- */
function setVerification(userId, status, docFilename) {
  if (docFilename !== undefined) db.prepare('UPDATE users SET verified = ?, id_doc = ? WHERE id = ?').run(status, docFilename, userId);
  else db.prepare('UPDATE users SET verified = ? WHERE id = ?').run(status, userId);
  markUser(userId);
  return getUserById(userId);
}
function listByVerification(status) {
  return db.prepare('SELECT * FROM users WHERE verified = ? ORDER BY created_at DESC').all(status);
}

/* Gesprekken in de app per account, voor de concierge-inbox. */
function conversations() {
  const rows = db.prepare('SELECT id, tier, codename, member_state FROM users WHERE member_state IS NOT NULL').all();
  return rows.map(r => {
    let md = {}; try { md = JSON.parse(r.member_state) || {}; } catch (e) {}
    return { id: r.id, tier: r.tier, codename: r.codename, conversation: md.conversation || [], needsConcierge: !!md.needsConcierge };
  }).filter(x => x.conversation.length);
}

/* ---------- leverancier-personeel (PIN-accounts binnen een bedrijf) ---------- */
async function createStaff(gegevens) {
  return schrijfStaff(gegevens, await hashPassword(String(gegevens.pin)));
}
function createStaffSync(gegevens) {
  return schrijfStaff(gegevens, hashPasswordSync(String(gegevens.pin)));
}
function schrijfStaff({ supplierCode, name, role, func, memberId, memberTier }, pinHash) {
  const vals = [String(supplierCode || '').toUpperCase(), String(name).slice(0, 60), pinHash, role === 'manager' ? 'manager' : 'staff', func ? String(func).slice(0, 40) : null, new Date().toISOString(),
    memberId != null ? Number(memberId) : null, memberTier ? String(memberTier).slice(0, 20) : null];
  const kolommen = 'supplier_code, name, pin_hash, role, func, created_at, member_id, member_tier';
  const id = nieuwId();
  let newId;
  if (id != null) {
    db.prepare(`INSERT INTO supplier_staff (id, ${kolommen}) VALUES (?, ${vals.map(() => '?').join(', ')})`).run(id, ...vals);
    newId = id;
  } else {
    const info = db.prepare(`INSERT INTO supplier_staff (${kolommen}) VALUES (${vals.map(() => '?').join(', ')})`).run(...vals);
    newId = info.lastInsertRowid;
  }
  markStaff(newId);
  return getStaffById(newId);
}
function getStaffById(id) { return db.prepare('SELECT * FROM supplier_staff WHERE id = ? AND active = 1').get(id) || null; }
function listStaff(code) { return db.prepare('SELECT * FROM supplier_staff WHERE supplier_code = ? AND active = 1 ORDER BY (role=\'manager\') DESC, id').all(String(code || '').toUpperCase()); }
function countStaff(code) { return db.prepare('SELECT COUNT(*) AS c FROM supplier_staff WHERE supplier_code = ? AND active = 1').get(String(code || '').toUpperCase()).c; }
async function verifyStaffPin(id, pin) { const s = getStaffById(id); return (s && await verifyPassword(String(pin), s.pin_hash)) ? s : null; }
// Manager reset: geef een teamlid een nieuwe pincode (bij vergeten of misbruik).
async function setStaffPin(id, pin) {
  db.prepare('UPDATE supplier_staff SET pin_hash = ? WHERE id = ?').run(await hashPassword(String(pin)), id);
  markStaff(id);
  return getStaffById(id);
}
function deactivateStaff(id) { db.prepare('UPDATE supplier_staff SET active = 0 WHERE id = ?').run(id); markStaff(id); }
// Actief personeelsaccount van een lid binnen een bedrijf (voorkomt dubbel aanmelden).
function staffByMember(supplierCode, memberId) {
  if (memberId == null) return null;
  return db.prepare('SELECT * FROM supplier_staff WHERE supplier_code = ? AND member_id = ? AND active = 1')
    .get(String(supplierCode || '').toUpperCase(), Number(memberId)) || null;
}
// Alle actieve personeelsplekken van één RTG-lid, over alle bedrijven heen.
// Basis voor de "1x aanmelden"-inlog: log één keer in en land meteen op het
// juiste bedrijf; wie bij meer bedrijven werkt, ziet die allemaal als opties.
function staffPositions(memberId) {
  if (memberId == null) return [];
  return db.prepare('SELECT * FROM supplier_staff WHERE member_id = ? AND active = 1 ORDER BY supplier_code')
    .all(Number(memberId));
}
// Koppel een bestaand personeelsaccount aan een RTG-lid (voor de demo-seed en
// voor het achteraf verbinden van een naam-account met een echt RTG-account).
function setStaffMember(id, memberId, memberTier) {
  db.prepare('UPDATE supplier_staff SET member_id = ?, member_tier = ? WHERE id = ?')
    .run(memberId != null ? Number(memberId) : null, memberTier ? String(memberTier).slice(0, 20) : null, id);
  markStaff(id);
  return getStaffById(id);
}
function publicStaff(s) { return s ? { id: s.id, name: s.name, role: s.role, func: s.func || null, lid: s.member_id != null } : null; }
function makePin() { return String(crypto.randomInt(1000, 10000)); }

/* AVG-vergetelheid: verwijdert het account definitief. Geeft de bestandsnaam
   van een eventueel geupload identiteitsdocument terug, zodat de server die
   ook van schijf kan wissen. */
function deleteUser(id) {
  const u = getUserById(id);
  if (!u) return null;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  markDelete(id);
  return u.id_doc || null;
}

module.exports = {
  init, startPostgres, onExternalChange, flushBijAfsluiten,
  createUser, createUserSync, getUserById, findByLogin, findByPhone, verifyPassword, issueToken, verifyToken, count, publicUser,
  createStaff, createStaffSync, getStaffById, listStaff, countStaff, verifyStaffPin, setStaffPin, deactivateStaff, staffByMember, staffPositions, setStaffMember, publicStaff, makePin, deleteUser,
  getMemberState, saveMemberState, setVerification, listByVerification, conversations,
  realNameOf, emailOf, phoneOf, issueActionToken, verifyActionToken,
  setEmailVerified, createReset, findByReset, setPassword
};
