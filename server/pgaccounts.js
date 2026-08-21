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
  'member_state', 'email_verified', 'reset_hash', 'reset_expires', 'actief', 'sessies_vanaf',
  'public_mail_hash'];
// Houd de personeelsidentiteit ook in de gedeelde waarheid. Zonder member_id
// werkte "een account voor alles" alleen op de lokale SQLite-cache en raakte de
// koppeling kwijt zodra een volgende app-instance het verzoek afhandelde.
const STAFF_COLS = ['id', 'supplier_code', 'name', 'pin_hash', 'role', 'active', 'created_at', 'func',
  'member_id', 'member_tier'];

function maakPgAccounts({ url, log }) {
  const { Pool } = require('./pgwire');
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
      reset_hash TEXT, reset_expires BIGINT, actief INTEGER NOT NULL DEFAULT 1,
      sessies_vanaf BIGINT NOT NULL DEFAULT 0, public_mail_hash TEXT
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS supplier_staff (
      id BIGINT PRIMARY KEY, supplier_code TEXT NOT NULL, name TEXT NOT NULL,
      pin_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff',
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, func TEXT,
      member_id BIGINT, member_tier TEXT
    )`);
    // Bestaande installaties veilig vooruit migreren; IF NOT EXISTS maakt dit
    // herhaalbaar bij iedere start en vraagt geen migratiepakket.
    await pool.query('ALTER TABLE supplier_staff ADD COLUMN IF NOT EXISTS member_id BIGINT');
    await pool.query('ALTER TABLE supplier_staff ADD COLUMN IF NOT EXISTS member_tier TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS actief INTEGER NOT NULL DEFAULT 1');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS sessies_vanaf BIGINT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS public_mail_hash TEXT');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_mail_hash ON users(public_mail_hash) WHERE public_mail_hash IS NOT NULL');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_staff_code ON supplier_staff(supplier_code)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_staff_member ON supplier_staff(member_id)`);
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

  /* WIE HET BERICHT STUURDE. Elk proces zet zijn eigen kenmerk achter de melding,
     zodat het zijn EIGEN melding kan overslaan.

     Zonder dit trok een instance zijn eigen schrijfactie terug. De volgorde:
     de spiegel leest de lokale rij, duwt hem naar Postgres en stuurt een NOTIFY;
     valt er in dat gaatje een tweede lokale schrijfactie op dezelfde rij, dan
     komt de eigen melding daarna binnen, haalt de OUDE rij uit Postgres en zet
     die met INSERT OR REPLACE over de nieuwe heen.

     Dat is geen theorie. Met 100 miljoen leden in de gids is het in acht
     pogingen een keer gereproduceerd: een lid uploadt zijn paspoort, de stand
     gaat naar "pending", en een tel later leest hij "unverified" -- waarna RTG
     Pay hem netjes 403 geeft met "we hebben je paspoort nodig", voor een
     paspoort dat hij net heeft laten zien. De volgende spoelronde zette het
     weer goed, dus in de database is niets kapot; het is een venster waarin het
     systeem zijn eigen schrijfactie niet ziet. Elke kolom van een lid kan erin
     vallen -- de pas, de e-mailbevestiging, de codenaam.

     Een instance moet zijn eigen melding niet volgen: hij HEEFT de nieuwste
     stand al, dat is precies waarom hij hem stuurde. Meldingen van een andere
     instance blijven gewoon werken; daar is de melding voor. */
  const BRON = require('crypto').randomBytes(6).toString('hex');

  async function upsertUser(row) {
    await pool.query(upUserSQL(), USER_COLS.map(c => row[c] === undefined ? null : row[c]));
    await pool.query('SELECT pg_notify($1, $2)', [KANAAL, 'user:' + row.id + ':' + BRON]);
  }
  async function upsertStaff(row) {
    await pool.query(upStaffSQL(), STAFF_COLS.map(c => row[c] === undefined ? null : row[c]));
    await pool.query('SELECT pg_notify($1, $2)', [KANAAL, 'staff:' + row.id + ':' + BRON]);
  }
  async function deleteUser(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await pool.query('SELECT pg_notify($1, $2)', [KANAAL, 'user:' + id + ':' + BRON]);
  }
  // voor de spiegel: is deze melding van onszelf?
  const vanMij = payload => String(payload || '').split(':')[2] === BRON;

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

  return { schema, reserveerBlok, pullAlles, upsertUser, upsertStaff, deleteUser, luister, sluit, pool, vanMij, BRON, USER_COLS, STAFF_COLS };
}

module.exports = { maakPgAccounts };
