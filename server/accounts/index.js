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
const migraties = require('../migraties');
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

  /* Het schema komt uit server/migraties: genummerde stappen die precies een
     keer draaien, met een grootboek erbij en een weigering om te starten op een
     database die nieuwer is dan deze code. Hiervoor stond de DDL hier, als een
     rij CREATE TABLE IF NOT EXISTS en ALTER TABLE in een try/catch -- dat werkt
     wel, maar je kunt zo'n database nooit vragen waar hij staat. Zie de kop van
     server/migraties/index.js voor waarom dat bij een storing het eerste is wat
     je wilt weten. */
  migraties.draai(db);

  S.SECRET = loadKey(SECRET_FILE, 'RTG_SECRET_KEY');
  S.VAULT = loadKey(VAULT_FILE, 'RTG_VAULT_KEY');
}

/* De WAL van rtg.db leegdrukken in het hoofdbestand.

   De identiteitskluis draait in WAL-modus: verse accounts staan in rtg.db-wal
   en pas een checkpoint schuift ze naar rtg.db. Een backup die alleen rtg.db
   kopieert, kopieert daardoor een bestand zonder de recentste leden -- bij een
   verse installatie zelfs een leeg bestand van 4 KB. De backup roept dit dus
   aan voordat hij kopieert. Faalt het (een ander proces leest nog), dan vangt
   de meegekopieerde -wal dat op. */
function checkpoint() {
  if (!S.db) return false;
  try { S.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); return true; }
  catch (e) { return false; }
}

module.exports = {
  init, checkpoint,
  startPostgres: mirror.startPostgres, onExternalChange: mirror.onExternalChange, flushBijAfsluiten: mirror.flushBijAfsluiten,
  verifyPassword: kluis.verifyPassword,
  ...users,
  ...staff
};
