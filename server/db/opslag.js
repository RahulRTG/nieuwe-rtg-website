/* Opslag, deel "bestandslaag": de paden en de opslagkeuze, de rechten op de
   datamap/bestanden, het atomisch-en-duurzaam wegschrijven (fsync) en het lezen/
   schrijven van de volledige lokale snapshot (db.json). Gedeeld door de index-
   orchestratie en de Postgres-write-behind. */
const fs = require('fs');
const path = require('path');
const kluis = require('../kluis'); // versleuteling-at-rest (met RTG_ENC_KEY)
const state = require('./state');

/* DE DATAMAP IS EEN LEZING GEWORDEN, GEEN CONSTANTE.

   Hij stond hier als `const DATA_DIR = process.env.RTG_DATA_DIR || ...`, en dat
   is een regel met een prijs die pas zichtbaar werd toen ik de toestandswortels
   ging classificeren: 647 toetsbestanden starten een eigen server EN zetten een
   eigen RTG_DATA_DIR. Dat zijn precies de 647 serverstarts waar dit programma om
   begon. Een toets start geen eigen server omdat hij bang is voor een singleton
   -- hij start er een omdat hij een eigen SCHIJF wil, en de schijf lag vast op
   het moment dat deze module laadde. Zolang dat zo bleef kon geen van die 647
   ooit een server delen, hoe netjes elke module ook terug naar vers kan.

   Nu wordt de map gelezen wanneer hij nodig is. `DATA_DIR` en `DB_FILE` blijven
   bestaan als levende eigenschappen op module.exports (zie onderaan), zodat de
   tientallen plekken die `opslag.DATA_DIR` lezen ongewijzigd blijven werken en
   vanzelf meebewegen. Wie ze bij het laden DESTRUCTUREERT houdt de oude waarde
   vast; die vier gevallen in db/ zijn mee omgezet, en scripts/lib/staatscan.js
   telt ze zodat er geen nieuwe bijkomen (meter datamapVastgeklonken).

   Wat dit NIET is: een tweede plek waar de map woont. De env blijft de enige
   bron; dit is dezelfde regel, alleen op het juiste moment uitgevoerd. */
const STANDAARD_DATAMAP = path.join(__dirname, '..', 'data');
const dataMap = () => process.env.RTG_DATA_DIR || STANDAARD_DATAMAP;
const dbBestand = () => path.join(dataMap(), 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL || null;
const REDIS_URL = process.env.REDIS_URL;
/* De opslagkeuze: Postgres zodra er een DATABASE_URL is; anders houdt een
   bestaande installatie zijn db.json (niets verandert onder je voeten), en
   krijgt een VERSE installatie de SQLite-motor. RTG_STORE blijft altijd de baas.
   De regel zelf staat in ./keuze, want de configuratiekeuring moet hem ook
   kunnen stellen -- en die had er een eigen, net andere benadering van. */
const { kiesStore, heeftGrootboek } = require('./keuze');
/* STORE blijft EEN KEER beslist, en dat is met opzet. De keuze kijkt of er al
   een db.json ligt; hem bij elke lezing opnieuw stellen zou de opslagvorm midden
   in een rit kunnen laten omslaan, en dat is een veel erger kwaad dan een vaste
   map. Hij hoort bij een verificatiecontext, niet bij een proces -- en tot die
   context bestaat telt hij terecht mee in datamapVastgeklonken. */
const STORE = kiesStore(process.env, fs.existsSync(dbBestand()));

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
    const bdir = path.join(dataMap(), 'backups');
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
    if (!fs.existsSync(dbBestand())) return null;
    return JSON.parse(kluis.ontsleutel(fs.readFileSync(dbBestand(), 'utf8')));
  } catch (e) {
    // Een corrupte of onleesbare snapshot mag niet geruisloos verdwijnen: dan
    // valt de app stil terug op een backup (of leeg) zonder dat iemand het merkt.
    console.warn('[db] snapshot onleesbaar (' + dbBestand() + '):', e.message, '- val terug op backup');
    return laadUitBackup();
  }
}

// De volledige lokale snapshot (in Postgres-modus enkel een warme-start-cache).
function schrijfLokaleSnapshot() {
  beslotenMap(dataMap());
  const uit = kluis.AAN ? kluis.versleutel(JSON.stringify(state.db.data)) : JSON.stringify(state.db.data, null, 2);
  schrijfDuurzaam(dbBestand(), uit, 0o600);
  besloten(dbBestand());
}
function schrijfLokaleSnapshotStil() { try { schrijfLokaleSnapshot(); } catch (e) {} }

module.exports = {
  dataMap, dbBestand,
  DATABASE_URL, REDIS_URL, STORE, kiesStore, heeftGrootboek,
  besloten, beslotenMap, schrijfDuurzaam, laadUitBackup, leesLokaleSnapshot,
  schrijfLokaleSnapshot, schrijfLokaleSnapshotStil
};
/* DATA_DIR en DB_FILE als LEVENDE eigenschappen. Wie `opslag.DATA_DIR` leest
   krijgt de map van dit moment; dat zijn de tientallen plekken die hem via de
   opzetlagen doorkrijgen, en die hoeven niets te weten van deze verandering.
   Wie hem bij het laden destructureert krijgt nog steeds een momentopname --
   daarom telt staatscan.js die vorm apart, zodat er geen nieuwe bijkomen. */
Object.defineProperty(module.exports, 'DATA_DIR', { enumerable: true, get: dataMap });
Object.defineProperty(module.exports, 'DB_FILE', { enumerable: true, get: dbBestand });
