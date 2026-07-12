const fs = require('fs');
const path = require('path');
const seed = require('./seed');

// De datamap is instelbaar met RTG_DATA_DIR (handig voor tests en om data en
// sleutels op productie los van de app-schijf te zetten). Standaard server/data.
const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* writable: in de failover-opstelling (server/trio.js) en bij losse
   domeinprocessen schrijft er altijd maar EEN server naar de data. De anderen
   lezen mee, maar bewaren niets; bij promotie laden ze eerst de verse data en
   gaan dan pas schrijven. */
const db = { data: null, writable: process.env.RTG_ROL !== 'standby' };

/* Optioneel: gedeelde data via Redis. Zonder REDIS_URL werkt alles zoals altijd
   met een lokaal db.json. Met REDIS_URL delen meerdere processen dezelfde
   db.data: de schrijver spiegelt elke wijziging naar Redis, de lezers krijgen
   die live door. Zo ziet een los draaiend domeinproces dezelfde data. Precies
   een proces schrijft (db.writable), net als bij het failover-trio. */
const REDIS_URL = process.env.REDIS_URL;
let rPub = null, rSub = null, versie = 0, externCb = null;

/* Opslagmotor. Standaard 'json' (een db.json-bestand, zoals altijd). Met
   RTG_STORE=sqlite bewaart de server elke top-level collectie als een rij in een
   SQLite-database (WAL, transactioneel). Dat schaalt veel beter dan telkens een
   heel JSON-bestand herschrijven, en het is de basis voor ECHT losse schrijvende
   servers: meerdere processen delen hetzelfde store.db-bestand en schrijven
   tegelijk. Elke collectie krijgt een oplopend versienummer; een korte
   achtergrondpoll haalt de collecties op die een ander proces heeft gewijzigd.
   Zo kan de leden-server zijn eigen collecties schrijven terwijl de
   leverancier-server de zijne schrijft, zonder elkaar te overschrijven, en zien
   ze elkaars data live. (Binnen EEN collectie serialiseert SQLite de schrijvers;
   geef een collectie dus aan een domein.) De data in het geheugen (db.data)
   blijft precies gelijk, dus de rest van de app merkt er niets van. */
const STORE = process.env.RTG_STORE || 'json';
let kvdb = null;
const toegepast = new Map();   // collectie -> versienummer dat dit proces al toegepast heeft
const laatsteJson = new Map(); // collectie -> laatst weggeschreven JSON (om ongewijzigde over te slaan)
function sqliteInit() {
  if (kvdb) return;
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  kvdb = new DatabaseSync(path.join(DATA_DIR, 'store.db'));
  kvdb.exec('PRAGMA journal_mode=WAL');
  kvdb.exec('PRAGMA synchronous=NORMAL');
  kvdb.exec('PRAGMA busy_timeout=5000'); // wacht kort als een ander proces net schrijft
  kvdb.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0)');
  kvdb.exec('CREATE INDEX IF NOT EXISTS idx_kv_ver ON kv(ver)');
  kvdb.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER)');
  kvdb.exec("INSERT INTO meta(k,v) VALUES('ver',0) ON CONFLICT(k) DO NOTHING");
}
function loadSqlite() {
  sqliteInit();
  const rows = kvdb.prepare('SELECT key, val, ver FROM kv').all();
  if (!rows.length) return null;
  const data = {};
  for (const r of rows) { data[r.key] = JSON.parse(r.val); laatsteJson.set(r.key, r.val); toegepast.set(r.key, r.ver); }
  return data;
}
function saveSqlite() {
  sqliteInit();
  const gewijzigd = [];
  for (const k of Object.keys(db.data)) {
    const j = JSON.stringify(db.data[k]);
    if (laatsteJson.get(k) !== j) gewijzigd.push([k, j]);
  }
  if (!gewijzigd.length) return;
  const bump = kvdb.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'");
  const huidig = kvdb.prepare("SELECT v FROM meta WHERE k = 'ver'");
  const up = kvdb.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver');
  kvdb.exec('BEGIN IMMEDIATE'); // pak meteen de schrijflock, zodat het versienummer klopt
  try {
    for (const [k, j] of gewijzigd) {
      bump.run();
      const v = huidig.get().v;
      up.run(k, j, v);
      laatsteJson.set(k, j);
      toegepast.set(k, v);
    }
    kvdb.exec('COMMIT');
  } catch (e) { try { kvdb.exec('ROLLBACK'); } catch (x) {} throw e; }
}
// Haal de collecties op die een ANDER proces sinds onze laatste versie schreef,
// en zet ze in db.data. Zo blijven losse domeinprocessen bij elkaar in de pas.
function pollSqlite() {
  if (!kvdb) return;
  try {
    // per collectie kijken of een ANDER proces een nieuwere versie schreef dan wij
    // al toepasten (een globale hoogwatergrens zou een lager genummerde wijziging
    // van een ander proces missen zodra wij zelf iets hoger schreven).
    const rows = kvdb.prepare('SELECT key, val, ver FROM kv').all();
    let sessieGewijzigd = false;
    for (const r of rows) {
      if (r.ver <= (toegepast.get(r.key) || 0)) continue;
      db.data[r.key] = JSON.parse(r.val);
      laatsteJson.set(r.key, r.val);
      toegepast.set(r.key, r.ver);
      if (r.key === 'sessions') sessieGewijzigd = true;
    }
    if (sessieGewijzigd && externCb) externCb();
  } catch (e) {}
}
let pollTimer = null;
// Start de kruisproces-synchronisatie (alleen bij de SQLite-opslag).
function startSqliteSync() {
  if (STORE !== 'sqlite' || pollTimer) return;
  sqliteInit();
  pollTimer = setInterval(pollSqlite, Number(process.env.RTG_POLL_MS || 750));
  if (pollTimer.unref) pollTimer.unref();
}

// Zoek de nieuwste bruikbare dagbackup (server maakt die in DATA_DIR/backups).
function laadUitBackup() {
  try {
    const bdir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(bdir)) return null;
    for (const d of fs.readdirSync(bdir).sort().reverse()) {
      const f = path.join(bdir, d, 'db.json');
      if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {} }
    }
  } catch (e) {}
  return null;
}

function load() {
  if (STORE === 'sqlite') {
    db.data = loadSqlite();
    if (!db.data) { db.data = seed(); save(); }
  } else if (fs.existsSync(DB_FILE)) {
    try {
      db.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      // corrupte db.json (bijv. na een stroomstoring midden in een schrijf):
      // val terug op de nieuwste backup in plaats van met lege data te starten.
      db.data = laadUitBackup();
      if (!db.data) throw new Error('db.json is onleesbaar en er is geen bruikbare backup.');
      console.warn('[db] db.json was corrupt; nieuwste backup teruggezet.');
    }
  } else {
    db.data = seed();
    save();
  }
  // Vormcontrole: liever stoppen dan met een kapot model draaien en het
  // (via save) over de goede data heen schrijven.
  if (!db.data || typeof db.data !== 'object' || Array.isArray(db.data)) {
    throw new Error('db.data heeft een onverwachte vorm; opstarten gestopt om data niet te overschrijven.');
  }
  if (db.data.__schema == null) db.data.__schema = 1;
}

function save() {
  if (!db.writable) return;
  if (STORE === 'sqlite') {
    // SQLite: kruisproces-sync via versienummers en de poll (geen Redis-mirror).
    saveSqlite();
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Atomisch wegschrijven: eerst een tijdelijk bestand, dan hernoemen.
    // Valt de server midden in een save uit, dan blijft het oude bestand heel.
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db.data, null, 2));
    fs.renameSync(tmp, DB_FILE);
    spiegelNaarRedis(); // alleen de JSON-opslag deelt via Redis (lees-replica's)
  }
}

// Zet de huidige data (met een oplopend versienummer) in Redis en seint de
// lezers. Vuurt-en-vergeet: een trage Redis houdt het verzoek niet op.
function spiegelNaarRedis() {
  if (!rPub) return;
  versie++;
  const v = versie;
  rPub.set('rtg:db', JSON.stringify(db.data)).then(() => rPub.publish('rtg:db:versie', String(v))).catch(() => {});
}

/* Start de gedeelde data. Roep dit na load() aan, zodra de kern zijn
   onExternalChange-hook heeft gezet. De schrijver deelt zijn data als startpunt;
   een lezer leest de verse data uit Redis en luistert daarna op wijzigingen. */
async function startGedeeld() {
  if (STORE === 'sqlite') return false; // SQLite deelt via de poll, niet via de Redis-mirror
  if (!REDIS_URL) return false;
  let redis;
  try { redis = require('redis'); } catch (e) { console.warn('[db] redis ontbreekt, alleen lokale data.'); return false; }
  rPub = redis.createClient({ url: REDIS_URL });
  rSub = redis.createClient({ url: REDIS_URL });
  rPub.on('error', e => console.warn('[db] redis:', e.message));
  rSub.on('error', e => console.warn('[db] redis:', e.message));
  await rPub.connect();
  await rSub.connect();
  await rSub.subscribe('rtg:db:versie', async (vStr) => {
    const v = Number(vStr);
    if (v <= versie) return; // eigen of oudere wijziging: negeren
    try {
      const raw = await rPub.get('rtg:db');
      if (raw) { db.data = JSON.parse(raw); versie = v; if (externCb) externCb(); }
    } catch (e) {}
  });
  if (db.writable) {
    spiegelNaarRedis();                          // schrijver deelt zijn huidige data
  } else {
    const raw = await rPub.get('rtg:db');
    if (raw) { db.data = JSON.parse(raw); if (externCb) externCb(); }
  }
  console.log('[db] gedeelde data via Redis actief, rol:', db.writable ? 'schrijver' : 'lezer');
  return true;
}

// De kern zet hier een functie neer die na een externe wijziging draait (bijv.
// de sessie-index opnieuw vullen). db.data zelf is dan al ververst.
function onExternalChange(cb) { externCb = cb; }

module.exports = { db, load, save, DATA_DIR, startGedeeld, startSqliteSync, onExternalChange };
