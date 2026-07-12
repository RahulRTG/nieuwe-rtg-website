/* PostgreSQL-spiegel voor de accounts (server/accounts.js).

   Waarom: accounts.js draait op een LOKAAL SQLite-bestand. Met meerdere
   app-instances heeft elke instance dan zijn eigen gebruikers, en dat is fout:
   wie zich op instance A registreert, kan niet inloggen op instance B.

   Deze module maakt PostgreSQL de gedeelde waarheid, zonder de (synchrone)
   accounts-API te hoeven omschrijven:
   - SQLite blijft de lokale, synchrone leescache (bestaande code ongewijzigd);
   - elke wijziging wordt doorgeschreven naar Postgres (write-through);
   - bij het opstarten wordt de gedeelde staat uit Postgres in de lokale cache
     getrokken, en LISTEN/NOTIFY houdt instances daarna live in de pas;
   - id's komen uit een Postgres-reeks in blokken, zodat twee instances nooit
     hetzelfde id uitdelen.

   De kolommen zijn identiek aan het SQLite-schema; de identiteitskluis-velden
   (enc_name/enc_email/...) blijven versleuteld, dus Postgres ziet net als SQLite
   nooit een leesbare naam of e-mail. */

const KANAAL = 'rtg_accounts';
const BLOK = 1000;          // id's per reservering
const BLOK_START = 1000000; // reeks begint hoog, zodat losse seed-id's (1,2,3) nooit botsen

const USER_COLS = ['id', 'email_hash', 'username', 'password_hash', 'tier', 'codename',
  'enc_name', 'enc_email', 'enc_phone', 'phone_hash', 'created_at', 'verified', 'id_doc',
  'member_state', 'email_verified', 'reset_hash', 'reset_expires'];
const STAFF_COLS = ['id', 'supplier_code', 'name', 'pin_hash', 'role', 'active', 'created_at', 'func'];

function maakPgAccounts({ url, log }) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX || 10) });
  let luisterClient = null;

  async function schema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      email_hash TEXT UNIQUE, username TEXT UNIQUE, password_hash TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'rtg', codename TEXT,
      enc_name TEXT, enc_email TEXT, enc_phone TEXT, phone_hash TEXT,
      created_at TEXT NOT NULL, verified TEXT NOT NULL DEFAULT 'unverified', id_doc TEXT,
      member_state TEXT, email_verified INTEGER NOT NULL DEFAULT 0,
      reset_hash TEXT, reset_expires BIGINT
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS supplier_staff (
      id BIGINT PRIMARY KEY, supplier_code TEXT NOT NULL, name TEXT NOT NULL,
      pin_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff',
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, func TEXT
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_staff_code ON supplier_staff(supplier_code)`);
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS rtg_id_seq INCREMENT BY ${BLOK} START ${BLOK_START} MINVALUE ${BLOK_START}`);
  }

  // Reserveer een blok id's: de reeks springt met BLOK, dus dit proces bezit
  // [v, v+BLOK-1] exclusief; een ander proces krijgt het volgende blok.
  async function reserveerBlok() {
    const { rows } = await pool.query("SELECT nextval('rtg_id_seq') AS v");
    const v = Number(rows[0].v);
    return { volgende: v, eind: v + BLOK - 1 };
  }

  async function pullAlles() {
    const u = await pool.query('SELECT * FROM users');
    const s = await pool.query('SELECT * FROM supplier_staff');
    return { users: u.rows, staff: s.rows };
  }

  function upsertSQL(tabel, cols) {
    const ph = cols.map((_, i) => '$' + (i + 1)).join(', ');
    const set = cols.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
    return `INSERT INTO ${tabel} (${cols.join(', ')}) VALUES (${ph})
            ON CONFLICT (id) DO UPDATE SET ${set}`;
  }
  const upUserSQL = () => upsertSQL('users', USER_COLS);
  const upStaffSQL = () => upsertSQL('supplier_staff', STAFF_COLS);

  async function upsertUser(row) {
    await pool.query(upUserSQL(), USER_COLS.map(c => row[c] === undefined ? null : row[c]));
    await pool.query('SELECT pg_notify($1, $2)', [KANAAL, 'user:' + row.id]);
  }
  async function upsertStaff(row) {
    await pool.query(upStaffSQL(), STAFF_COLS.map(c => row[c] === undefined ? null : row[c]));
    await pool.query('SELECT pg_notify($1, $2)', [KANAAL, 'staff:' + row.id]);
  }
  async function deleteUser(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await pool.query('SELECT pg_notify($1, $2)', [KANAAL, 'user:' + id]);
  }

  async function luister(onWijziging) {
    luisterClient = await pool.connect();
    luisterClient.on('notification', (msg) => onWijziging(msg.payload));
    luisterClient.on('error', (e) => { if (log) log.warn('pgaccounts-listen', { fout: e.message }); });
    await luisterClient.query('LISTEN ' + KANAAL);
  }

  async function sluit() {
    try { if (luisterClient) luisterClient.release(); } catch (e) {}
    try { await pool.end(); } catch (e) {}
  }

  return { schema, reserveerBlok, pullAlles, upsertUser, upsertStaff, deleteUser, luister, sluit, pool, USER_COLS, STAFF_COLS };
}

module.exports = { maakPgAccounts };
