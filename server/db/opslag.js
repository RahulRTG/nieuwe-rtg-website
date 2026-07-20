/* Opslag, deel "bestandslaag": de paden en de opslagkeuze, de rechten op de
   datamap/bestanden, het atomisch-en-duurzaam wegschrijven (fsync) en het lezen/
   schrijven van de volledige lokale snapshot (db.json). Gedeeld door de index-
   orchestratie en de Postgres-write-behind. */
const fs = require('fs');
const path = require('path');
const kluis = require('../kluis'); // versleuteling-at-rest (met RTG_ENC_KEY)
const state = require('./state');

// De datamap is instelbaar met RTG_DATA_DIR (handig voor tests en om data en
// sleutels op productie los van de app-schijf te zetten). Standaard server/data.
const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL || null;
const REDIS_URL = process.env.REDIS_URL;
/* De opslagkeuze: Postgres zodra er een DATABASE_URL is; anders houdt een
   bestaande installatie zijn db.json (niets verandert onder je voeten), en
   krijgt een VERSE installatie de SQLite-motor. RTG_STORE blijft altijd de baas. */
const STORE = process.env.RTG_STORE || (DATABASE_URL ? 'postgres' : (fs.existsSync(DB_FILE) ? 'json' : 'sqlite'));

// Privacy op schijf: de datamap en de databestanden bevatten chats, sessies en
// (tijdelijk) snaps. Alleen de eigenaar mag ze lezen (map 0700, bestanden 0600).
function besloten(f) { try { fs.chmodSync(f, 0o600); } catch (e) {} }
function beslotenMap(d) { try { fs.mkdirSync(d, { recursive: true, mode: 0o700 }); fs.chmodSync(d, 0o700); } catch (e) { try { fs.mkdirSync(d, { recursive: true }); } catch (x) {} } }

/* Atomisch én duurzaam wegschrijven. Naast hernoemen (atomisch: het oude
   bestand blijft heel bij een crash midden in de save) forceren we de bytes met
   fsync naar schijf, en daarna de map, zodat de hernoeming zelf een
   stroomstoring overleeft. Zonder die fsync kan de directory de nieuwe naam al
   hebben terwijl de data nog in de buffer stond: dat geeft een leeg of half
   bestand na een stroomuitval. */
function schrijfDuurzaam(doel, data, mode) {
  const tmp = doel + '.tmp';
  const fd = fs.openSync(tmp, 'w', mode || 0o600);
  try {
    fs.writeSync(fd, typeof data === 'string' ? Buffer.from(data) : data);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  try { fs.chmodSync(tmp, mode || 0o600); } catch (e) {}
  fs.renameSync(tmp, doel);
  // de map fsync-en maakt de hernoeming duurzaam; niet elk platform staat dit
  // toe (Windows), dus fouten hier zijn niet fataal.
  try { const dfd = fs.openSync(path.dirname(doel), 'r'); try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); } } catch (e) {}
}

// Zoek de nieuwste bruikbare dagbackup (server maakt die in DATA_DIR/backups).
function laadUitBackup() {
  try {
    const bdir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(bdir)) return null;
    for (const d of fs.readdirSync(bdir).sort().reverse()) {
      const f = path.join(bdir, d, 'db.json');
      if (fs.existsSync(f)) {
        try { const data = JSON.parse(kluis.ontsleutel(fs.readFileSync(f, 'utf8'))); console.warn('[db] hersteld uit dagbackup:', f); return data; }
        catch (e) { console.warn('[db] backup onbruikbaar (' + f + '):', e.message); }
      }
    }
  } catch (e) { console.warn('[db] backupmap onleesbaar:', e.message); }
  return null;
}

function leesLokaleSnapshot() {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    return JSON.parse(kluis.ontsleutel(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (e) {
    // Een corrupte of onleesbare snapshot mag niet geruisloos verdwijnen: dan
    // valt de app stil terug op een backup (of leeg) zonder dat iemand het merkt.
    console.warn('[db] snapshot onleesbaar (' + DB_FILE + '):', e.message, '- val terug op backup');
    return laadUitBackup();
  }
}

// De volledige lokale snapshot (in Postgres-modus enkel een warme-start-cache).
function schrijfLokaleSnapshot() {
  beslotenMap(DATA_DIR);
  const uit = kluis.AAN ? kluis.versleutel(JSON.stringify(state.db.data)) : JSON.stringify(state.db.data, null, 2);
  schrijfDuurzaam(DB_FILE, uit, 0o600);
  besloten(DB_FILE);
}
function schrijfLokaleSnapshotStil() { try { schrijfLokaleSnapshot(); } catch (e) {} }

module.exports = {
  DATA_DIR, DB_FILE, DATABASE_URL, REDIS_URL, STORE,
  besloten, beslotenMap, schrijfDuurzaam, laadUitBackup, leesLokaleSnapshot,
  schrijfLokaleSnapshot, schrijfLokaleSnapshotStil
};
