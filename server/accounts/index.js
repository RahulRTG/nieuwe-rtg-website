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

   Deze module is opgesplitst: ./kluis (crypto/pseudonimisering), ./mirror (de
   PostgreSQL-spiegel), ./users (ledenaccounts + tokens), ./staff (leverancier-
   personeel). Hier het openen van de database, het schema en de migraties, het
   laden van de sleutels, en het samenstellen van de publieke API. De gedeelde,
   levende staat (db + sleutels) loopt via ./state.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const S = require('./state');
const kluis = require('./kluis');
const mirror = require('./mirror');
const users = require('./users');
const staff = require('./staff');

// Zelfde datamap als db.js: instelbaar met RTG_DATA_DIR (tests + productie).
const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'rtg.db');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');   // ondertekent sessietokens
const VAULT_FILE = path.join(DATA_DIR, 'vault.key');     // versleutelt de identiteitskluis

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
  const db = new DatabaseSync(DB_FILE);
  S.db = db;
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

  S.SECRET = loadKey(SECRET_FILE, 'RTG_SECRET_KEY');
  S.VAULT = loadKey(VAULT_FILE, 'RTG_VAULT_KEY');
}

module.exports = {
  init,
  startPostgres: mirror.startPostgres, onExternalChange: mirror.onExternalChange, flushBijAfsluiten: mirror.flushBijAfsluiten,
  verifyPassword: kluis.verifyPassword,
  ...users,
  ...staff
};
