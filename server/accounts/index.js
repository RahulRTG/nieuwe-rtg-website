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
const RING_FILE = path.join(DATA_DIR, 'vault.ring');     // extra kluissleutels na een rotatie

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

/* De keyring voor de VERSLEUTELING laden: extra sleutels die bij een rotatie zijn
   bijgezet, nieuwste eerst. De oorspronkelijke VAULT-sleutel komt er altijd achter
   -- die blijft nodig om blobs van voor de rotatie te lezen, en hij is bovendien
   de gepinde sleutel van de zoek-hashes (zie ./state).

   Zonder rotatie bestaat het ringbestand niet en is de ring simpelweg [VAULT]:
   dan verandert er niets ten opzichte van een installatie zonder rotatie. Bij
   meerdere instances moet de ring, net als VAULT zelf, op elke instance gelijk
   zijn; vandaar ook hier eerst de omgeving (RTG_VAULT_RING, komma-gescheiden hex,
   nieuwste eerst) en pas dan het bestand. */
function loadRing(file, vault) {
  const uit = [];
  const zieHex = (s) => { const t = String(s).trim(); if (/^[0-9a-fA-F]{64}$/.test(t)) uit.push(Buffer.from(t, 'hex')); };
  const env = process.env.RTG_VAULT_RING || '';
  if (env) env.split(',').forEach(zieHex);
  else if (fs.existsSync(file)) { try { fs.readFileSync(file, 'utf8').split('\n').forEach(zieHex); } catch (e) {} }
  // de oorspronkelijke sleutel sluit de rij; nooit dubbel
  if (!uit.some(k => k.equals(vault))) uit.push(vault);
  return uit;
}

/* De gelijktijdigheidsstand van een verbinding. Staat apart zodat de VOLGORDE
   beproefbaar is (test/pragmavolgorde.test.js) in plaats van alleen bedoeld. */
function zetGelijktijdigheid(db) {
  /* WAL + busy_timeout: lezers en schrijvers blokkeren elkaar niet meer, en
     als twee processen dezelfde accountsdatabase raken (failover-trio, een
     herstart die de oude instance een tel overlapt, parallelle testservers)
     wacht de tweede even in plaats van hard te crashen op "database is
     locked". Dit was de bron van de sporadische testflake.

     EN DAT GOLD NIET VOOR DE OMSCHAKELING ZELF. `journal_mode=WAL` vraagt even
     een exclusief slot op het bestand, en dat statement luistert als een van de
     weinige NIET naar `busy_timeout`: het weigert meteen. Dus juist de regel die
     de crash hoorde te voorkomen, was de regel waarop een tweede proces omviel
     ("database is locked", buiten elke route, dus fataal). De wachttijd
     vooropzetten repareert dat niet -- dat is beproefd en het hielp niet.

     Wat wel werkt is dat de stand PERSISTENT is: staat het bestand eenmaal in
     WAL, dan hoeft niemand meer om te schakelen. Alleen de allereerste opkomst
     op een verse database botst dus, en die botsing duurt zo lang als de ander
     erover doet. Daarom eerst kijken en pas dan schakelen, en bij een bezet
     bestand kort wachten en opnieuw kijken -- meestal blijkt de ander het dan
     al gedaan te hebben. Zie test/pragmavolgorde.test.js. */
  db.exec('PRAGMA busy_timeout=5000');
  const staatIn = () => String((db.prepare('PRAGMA journal_mode').get() || {}).journal_mode || '').toLowerCase();
  /* TELLEN EN NIET KLOKKIJKEN. Een grens van "vijf seconden" zou hier een
     `Date.now()` vragen, en dat is precies de klokschuld die scripts/klok.js
     meet -- deze module hoort niet rechtstreeks aan het besturingssysteem te
     vragen hoe laat het is. Tweehonderd pogingen van 25 ms is dezelfde grens,
     uitgedrukt in wat we hier wel weten. */
  for (let poging = 0; ; poging++) {
    if (staatIn() === 'wal') break;
    try { db.exec('PRAGMA journal_mode=WAL'); break; }
    catch (e) {
      const bezet = /lock|busy/i.test(String((e && e.message) || e));
      if (!bezet || poging >= 200) throw e;
      // synchroon wachten: hier draait nog geen server, en de rest van deze
      // opstart mag niet doorlopen op een verbinding die nog niet staat.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  db.exec('PRAGMA synchronous=NORMAL');
}

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  S.db = db;
  zetGelijktijdigheid(db);

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
  S.RING = loadRing(RING_FILE, S.VAULT);
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

/* De keyring duurzaam wegschrijven: nieuwste sleutel eerst, hex per regel, rechten
   600. Eerst een temp-bestand met fsync en dan een rename, zodat de ring nooit half
   op schijf staat -- de rotatie leunt erop dat dit KLAAR is voordat er ook maar een
   rij is hersleuteld (zie ./onderhoud roteer). Woont hier omdat dit deel de paden
   kent. */
function schrijfKluisRing(ring) {
  const tekst = ring.map(k => Buffer.from(k).toString('hex')).join('\n') + '\n';
  const tmp = RING_FILE + '.tmp';
  const fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, tekst); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, RING_FILE);
  try { fs.chmodSync(RING_FILE, 0o600); } catch (e) {}
}

module.exports = {
  init, zetGelijktijdigheid, checkpoint, schrijfKluisRing, RING_FILE,
  startPostgres: mirror.startPostgres, onExternalChange: mirror.onExternalChange, flushBijAfsluiten: mirror.flushBijAfsluiten,
  verifyPassword: kluis.verifyPassword,
  moetVernieuwen: kluis.moetVernieuwen,
  /* Een afgeleide sleutel voor een ander doel; de ruwe sessiesleutel verlaat de
     kluis nooit. Zie ./kluis.js voor waarom dat geen netheid maar scheiding is. */
  sleutelVoor: kluis.sleutelVoor,
  ...users,
  ...staff
};
