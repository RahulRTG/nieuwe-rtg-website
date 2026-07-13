const fs = require('fs');
const path = require('path');
const seed = require('./seed');
const kluis = require('./kluis'); // versleuteling-at-rest (met RTG_ENC_KEY)

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

// Privacy op schijf: de datamap en de databestanden bevatten chats, sessies en
// (tijdelijk) snaps. Alleen de eigenaar mag ze lezen (map 0700, bestanden 0600).
function besloten(f) { try { fs.chmodSync(f, 0o600); } catch (e) {} }
function beslotenMap(d) { try { fs.mkdirSync(d, { recursive: true, mode: 0o700 }); fs.chmodSync(d, 0o700); } catch (e) { try { fs.mkdirSync(d, { recursive: true }); } catch (x) {} } }

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
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL || null;
const STORE = process.env.RTG_STORE || (DATABASE_URL ? 'postgres' : 'json');
let kvdb = null;
const toegepast = new Map();   // collectie -> versienummer dat dit proces al toegepast heeft
const laatsteJson = new Map(); // collectie -> laatst weggeschreven JSON (om ongewijzigde over te slaan)
function sqliteInit() {
  if (kvdb) return;
  const { DatabaseSync } = require('node:sqlite');
  beslotenMap(DATA_DIR);
  const bestand = path.join(DATA_DIR, 'store.db');
  kvdb = new DatabaseSync(bestand);
  besloten(bestand);
  kvdb.exec('PRAGMA journal_mode=WAL');
  kvdb.exec('PRAGMA synchronous=NORMAL');
  kvdb.exec('PRAGMA busy_timeout=5000'); // wacht kort als een ander proces net schrijft
  kvdb.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0)');
  kvdb.exec('CREATE INDEX IF NOT EXISTS idx_kv_ver ON kv(ver)');
  kvdb.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER)');
  kvdb.exec("INSERT INTO meta(k,v) VALUES('ver',0) ON CONFLICT(k) DO NOTHING");
}
// De opgeslagen waarde is (met RTG_ENC_KEY) versleuteld; in het geheugen en in
// laatsteJson houden we altijd de leesbare JSON aan, alleen op schijf staat cijfer.
const uitStore = v => kluis.ontsleutel(v);       // ruwe kolomwaarde -> leesbare JSON
const naarStore = j => kluis.versleutel(j);      // leesbare JSON -> op te slaan waarde
function loadSqlite() {
  sqliteInit();
  const rows = kvdb.prepare('SELECT key, val, ver FROM kv').all();
  if (!rows.length) return null;
  const data = {};
  for (const r of rows) { const j = uitStore(r.val); data[r.key] = JSON.parse(j); laatsteJson.set(r.key, j); toegepast.set(r.key, r.ver); }
  return data;
}

/* Drie-weg samenvoeging op item-niveau. Schrijven twee processen tegelijk naar
   DEZELFDE collectie (bijv. allebei een gezin toevoegen aan foundation.gezinnen,
   of allebei een sessie), dan voegen we hun wijzigingen per item samen in plaats
   van de hele collectie te overschrijven. base = onze laatst-gesynchroniseerde
   waarde, ours = ons geheugen, theirs = wat er nu in de store staat.
   - objecten (maps): sleutel voor sleutel; een kant die niet wijzigde geeft mee.
   - arrays met een id (of a+b bij connecties): als map op die sleutel mergen,
     zodat toevoegingen van beide kanten blijven en verwijderingen doorwerken.
   - overige arrays/scalars: de gewijzigde kant wint (anders de onze). */
const _j = x => JSON.stringify(x);
function itemSleutel(it) {
  if (!it || typeof it !== 'object') return null;
  if (it.id != null) return 'id:' + it.id;
  if (it.a != null && it.b != null) return 'ab:' + [it.a, it.b].sort().join('|');
  return null;
}
function soort(x) { return Array.isArray(x) ? 'array' : (x && typeof x === 'object' ? 'object' : 'scalar'); }
function merge3(base, ours, theirs) {
  if (theirs === undefined) return ours;
  if (ours === undefined) return theirs;
  if (soort(ours) !== soort(theirs) || (base !== undefined && soort(base) !== soort(ours))) {
    return _j(ours) !== _j(base) ? ours : theirs; // structuur veranderde: de gewijzigde kant
  }
  if (soort(ours) === 'scalar') {
    if (_j(ours) === _j(base)) return theirs;
    if (_j(theirs) === _j(base)) return ours;
    return ours; // beide gewijzigd: de onze (laatste schrijver)
  }
  if (soort(ours) === 'object') {
    const res = {}, b = base || {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(ours), ...Object.keys(theirs)])) {
      const bo = b[k], oo = ours[k], to = theirs[k];
      if (oo === undefined && bo !== undefined && _j(to) === _j(bo)) continue; // wij verwijderden
      if (to === undefined && bo !== undefined && _j(oo) === _j(bo)) continue; // zij verwijderden
      const m = merge3(bo, oo, to);
      if (m !== undefined) res[k] = m;
    }
    return res;
  }
  // arrays
  const b = base || [];
  const keybaar = [ours, theirs, b].every(arr => Array.isArray(arr) && arr.every(it => itemSleutel(it) != null));
  if (keybaar) {
    const mapVan = arr => { const m = new Map(); for (const it of arr) m.set(itemSleutel(it), it); return m; };
    const mb = mapVan(b), mo = mapVan(ours), mt = mapVan(theirs), res = new Map();
    for (const k of new Set([...mb.keys(), ...mo.keys(), ...mt.keys()])) {
      const bo = mb.get(k), oo = mo.get(k), to = mt.get(k);
      if (oo === undefined && mb.has(k) && _j(to) === _j(bo)) continue; // wij verwijderden
      if (to === undefined && mb.has(k) && _j(oo) === _j(bo)) continue; // zij verwijderden
      const m = merge3(bo, oo, to);
      if (m !== undefined) res.set(k, m);
    }
    return [...res.values()];
  }
  if (_j(ours) === _j(base)) return theirs;
  if (_j(theirs) === _j(base)) return ours;
  return ours;
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
  const lees = kvdb.prepare('SELECT val, ver FROM kv WHERE key = ?');
  const up = kvdb.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver');
  kvdb.exec('BEGIN IMMEDIATE'); // pak meteen de schrijflock, zodat de versie en de merge kloppen
  try {
    for (const [k, jOns] of gewijzigd) {
      let j = jOns;
      const rij = lees.get(k);
      // Schreef een ander proces deze collectie ondertussen? Voeg per item samen
      // in plaats van hun wijzigingen te overschrijven.
      if (rij && rij.ver > (toegepast.get(k) || 0)) {
        const base = laatsteJson.has(k) ? JSON.parse(laatsteJson.get(k)) : undefined;
        const samen = merge3(base, db.data[k], JSON.parse(uitStore(rij.val)));
        db.data[k] = samen;
        j = JSON.stringify(samen);
      }
      bump.run();
      const v = huidig.get().v;
      up.run(k, naarStore(j), v);
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
    // van een ander proces missen zodra wij zelf iets hoger schreven). We halen
    // alleen rijen op boven onze laagst-toegepaste versie, zodat we niet elke
    // keer alle collecties hoeven te deserialiseren.
    let laagst = 0;
    for (const v of toegepast.values()) if (v < laagst || laagst === 0) laagst = v;
    const rows = kvdb.prepare('SELECT key, val, ver FROM kv WHERE ver > ?').all(laagst);
    let sessieGewijzigd = false;
    for (const r of rows) {
      if (r.ver <= (toegepast.get(r.key) || 0)) continue;
      const baseJson = laatsteJson.get(r.key);
      const hunJson = uitStore(r.val);
      const lokaalOpenstaand = baseJson !== undefined && JSON.stringify(db.data[r.key]) !== baseJson;
      if (lokaalOpenstaand) {
        // wij hebben nog niet-opgeslagen wijzigingen: samenvoegen en die niet
        // als "opgeslagen" markeren, zodat de eerstvolgende save ze wegschrijft.
        db.data[r.key] = merge3(JSON.parse(baseJson), db.data[r.key], JSON.parse(hunJson));
      } else {
        db.data[r.key] = JSON.parse(hunJson);
        laatsteJson.set(r.key, hunJson);
      }
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
      if (fs.existsSync(f)) { try { return JSON.parse(kluis.ontsleutel(fs.readFileSync(f, 'utf8'))); } catch (e) {} }
    }
  } catch (e) {}
  return null;
}

/* ---------- PostgreSQL (write-behind cache) ----------
   Zie server/pg.js. Postgres is de gedeelde, duurzame waarheid; het geheugen
   blijft de werkkopie en een lokale snapshot (DB_FILE) dient als warme cache en
   fallback als Postgres even wegvalt. */
let pg = null, pgKlaar = false, pgVuil = false, pgFlushBezig = false, pgFlushTimer = null, pgPoll = null, pgVeilig = null;
const pgLog = { warn: (m, v) => console.warn('[pg]', m, v || '') };

function schrijfLokaleSnapshot() {
  beslotenMap(DATA_DIR);
  const uit = kluis.AAN ? kluis.versleutel(JSON.stringify(db.data)) : JSON.stringify(db.data, null, 2);
  schrijfDuurzaam(DB_FILE, uit, 0o600);
  besloten(DB_FILE);
}
function schrijfLokaleSnapshotStil() { try { schrijfLokaleSnapshot(); } catch (e) {} }
function leesLokaleSnapshot() {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    return JSON.parse(kluis.ontsleutel(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (e) { return laadUitBackup(); }
}
function planFlush() {
  pgVuil = true;
  if (pgFlushTimer || !pgKlaar) return;
  pgFlushTimer = setTimeout(flushNu, Number(process.env.PG_FLUSH_MS || 150));
  if (pgFlushTimer.unref) pgFlushTimer.unref();
}
async function flushNu() {
  pgFlushTimer = null;
  if (!pg || !pgKlaar || pgFlushBezig || !db.writable || !pgVuil) return;
  pgVuil = false; pgFlushBezig = true;
  try { await pg.flush(db.data); schrijfLokaleSnapshotStil(); }
  catch (e) { pgVuil = true; console.warn('[pg] flush mislukt:', e.message); }
  finally { pgFlushBezig = false; if (pgVuil && pgKlaar) planFlush(); }
}
/* Start de Postgres-koppeling: schema klaarzetten, de gedeelde data ophalen
   (Postgres wint bij het opstarten), en daarna live meeluisteren op wijzigingen
   van andere instances (LISTEN/NOTIFY) met een poll als vangnet. */
async function startPostgres() {
  if (STORE !== 'postgres') return false;
  pg = require('./pg').maakPg({ merge3, kluis, log: pgLog, url: DATABASE_URL });
  await pg.schema();
  const pgData = await pg.laadAlles();
  if (pgData) {
    db.data = pgData; // Postgres is de gedeelde waarheid
    if (db.data.__schema == null) db.data.__schema = 1;
    schrijfLokaleSnapshotStil();
    if (externCb) externCb();
  } else if (db.writable) {
    await pg.flush(db.data); // lege database: onze seed/snapshot erin
  }
  pgKlaar = true;
  await pg.luister(() => { pg.haalNieuwer(db.data, externCb).then(schrijfLokaleSnapshotStil).catch(() => {}); });
  pgPoll = setInterval(() => pg.haalNieuwer(db.data, externCb).catch(() => {}), Number(process.env.RTG_POLL_MS || 2000));
  if (pgPoll.unref) pgPoll.unref();
  pgVeilig = setInterval(() => { if (pgVuil) flushNu(); }, 1000);
  if (pgVeilig.unref) pgVeilig.unref();
  if (pgVuil) planFlush();
  console.log('[db] PostgreSQL-opslag actief, rol:', db.writable ? 'schrijver' : 'lezer');
  return true;
}
// Laatste flush bij het afsluiten, zodat niets in de write-behind blijft hangen.
async function flushBijAfsluiten() {
  if (db.writable && saveVuil) { try { schrijfSnapshotNu(); } catch (e) {} }
  if (STORE !== 'postgres' || !pg || !db.writable) return;
  try { await pg.flush(db.data); } catch (e) {}
}

// Ping de database voor de gezondheidscheck; geeft de antwoordtijd in ms.
async function pgPing() {
  if (STORE !== 'postgres' || !pg) throw new Error('PostgreSQL is niet actief.');
  const t = Date.now();
  await pg.pool.query('SELECT 1');
  return Date.now() - t;
}

function load() {
  if (STORE === 'postgres') {
    // Warme cache / fallback; de echte gedeelde data komt via startPostgres().
    db.data = leesLokaleSnapshot() || seed();
  } else if (STORE === 'sqlite') {
    db.data = loadSqlite();
    if (!db.data) { db.data = seed(); save(); }
  } else if (fs.existsSync(DB_FILE)) {
    const ruw = fs.readFileSync(DB_FILE, 'utf8');
    let tekst;
    try { tekst = kluis.ontsleutel(ruw); }
    catch (e) { throw new Error('db.json kan niet ontsleuteld worden; klopt RTG_ENC_KEY? (' + e.message + ')'); }
    try {
      db.data = JSON.parse(tekst);
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

/* Write-behind voor het volledige-snapshot-schrijven (JSON-opslag en de lokale
   snapshot in Postgres-modus). Het serialiseren van de HELE datastore is O(alle
   data): bij een grote kast (honderdduizenden tickets) kostte elke mutatie
   tientallen tot honderden ms synchroon, en onder spitsdruk stapelde dat op tot
   seconden wachtrij voor de hele server. Daarom: de eerste save schrijft nog
   steeds DIRECT (zelfde duurzaamheid voor losse acties), maar een burst wordt
   gecoalesceerd tot een flush per venster. Het venster reguleert zichzelf: nooit
   vaker dan eens per RTG_SAVE_MS en nooit meer dan ~25% van de tijd aan het
   schrijven (4x de laatst gemeten flushduur). Bij een harde crash kan zo
   hooguit een venster aan mutaties verloren gaan; SIGTERM/SIGINT flushen altijd
   eerst (zie flushBijAfsluiten). Voor echt grote datasets is Postgres of
   RTG_STORE=sqlite de juiste opslag; dit houdt de JSON-modus eerlijk overeind.*/
const SAVE_MS = Number(process.env.RTG_SAVE_MS || 250);
let saveTimer = null, saveVuil = false, saveDuur = 0, saveKlaar = 0;
function schrijfSnapshotNu() {
  saveVuil = false;
  const t0 = Date.now();
  try {
    beslotenMap(DATA_DIR);
    // compact (geen pretty-print): bij grote data scheelt dat ~40% tijd en ruimte
    const uit = kluis.AAN ? kluis.versleutel(JSON.stringify(db.data)) : JSON.stringify(db.data);
    schrijfDuurzaam(DB_FILE, uit, 0o600);
    besloten(DB_FILE);
    if (STORE !== 'postgres') spiegelNaarRedis(); // alleen de JSON-opslag deelt via Redis
  } catch (e) { console.warn('[db] snapshot schrijven mislukt:', e.message); }
  saveDuur = Date.now() - t0;
  saveKlaar = Date.now();
}
function planSnapshot() {
  saveVuil = true;
  if (saveTimer) return;
  const venster = Math.max(SAVE_MS, saveDuur * 4);
  const sinds = Date.now() - saveKlaar;
  if (sinds >= venster) return schrijfSnapshotNu(); // losse actie: meteen, net als vroeger
  saveTimer = setTimeout(() => { saveTimer = null; if (saveVuil) schrijfSnapshotNu(); }, venster - sinds);
  if (saveTimer.unref) saveTimer.unref();
}
function save() {
  if (!db.writable) return;
  if (STORE === 'postgres') {
    // Lokale snapshot (warme cache/fallback) gecoalesceerd + async flush naar
    // Postgres plannen (write-behind). Postgres is de duurzame waarheid.
    planSnapshot();
    planFlush();
  } else if (STORE === 'sqlite') {
    // SQLite: kruisproces-sync via versienummers en de poll (geen Redis-mirror).
    saveSqlite();
  } else {
    planSnapshot();
  }
}

// Zet de huidige data (met een oplopend versienummer) in Redis en seint de
// lezers. Vuurt-en-vergeet: een trage Redis houdt het verzoek niet op.
function spiegelNaarRedis() {
  if (!rPub) return;
  versie++;
  const v = versie;
  rPub.set('rtg:db', kluis.versleutel(JSON.stringify(db.data))).then(() => rPub.publish('rtg:db:versie', String(v))).catch(() => {});
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
      if (raw) { db.data = JSON.parse(kluis.ontsleutel(raw)); versie = v; if (externCb) externCb(); }
    } catch (e) {}
  });
  if (db.writable) {
    spiegelNaarRedis();                          // schrijver deelt zijn huidige data
  } else {
    const raw = await rPub.get('rtg:db');
    if (raw) { db.data = JSON.parse(kluis.ontsleutel(raw)); if (externCb) externCb(); }
  }
  console.log('[db] gedeelde data via Redis actief, rol:', db.writable ? 'schrijver' : 'lezer');
  return true;
}

// De kern zet hier een functie neer die na een externe wijziging draait (bijv.
// de sessie-index opnieuw vullen). db.data zelf is dan al ververst.
function onExternalChange(cb) { externCb = cb; }

module.exports = { db, load, save, DATA_DIR, STORE, startGedeeld, startSqliteSync, startPostgres, flushBijAfsluiten, pgPing, onExternalChange, merge3, schrijfDuurzaam };
