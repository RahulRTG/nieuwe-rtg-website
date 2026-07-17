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
/* De opslagkeuze: Postgres zodra er een DATABASE_URL is; anders houdt een
   bestaande installatie zijn db.json (niets verandert onder je voeten), en
   krijgt een VERSE installatie de SQLite-motor. Die schrijft per collectie
   in plaats van telkens de hele kast te serialiseren: zuiniger en veel
   beter schaalbaar. RTG_STORE blijft altijd de baas. */
const STORE = process.env.RTG_STORE || (DATABASE_URL ? 'postgres' : (fs.existsSync(DB_FILE) ? 'json' : 'sqlite'));
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
  } catch (e) { console.warn('[db] sqlite-sync mislukt:', e.message); }
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
      if (fs.existsSync(f)) {
        try { const data = JSON.parse(kluis.ontsleutel(fs.readFileSync(f, 'utf8'))); console.warn('[db] hersteld uit dagbackup:', f); return data; }
        catch (e) { console.warn('[db] backup onbruikbaar (' + f + '):', e.message); }
      }
    }
  } catch (e) { console.warn('[db] backupmap onleesbaar:', e.message); }
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
  } catch (e) {
    // Een corrupte of onleesbare snapshot mag niet geruisloos verdwijnen: dan
    // valt de app stil terug op een backup (of leeg) zonder dat iemand het merkt.
    console.warn('[db] snapshot onleesbaar (' + DB_FILE + '):', e.message, '- val terug op backup');
    return laadUitBackup();
  }
}
function planFlush() {
  pgVuil = true;
  if (pgFlushTimer || !pgKlaar) return;
  pgFlushTimer = setTimeout(flushNu, Number(process.env.PG_FLUSH_MS || 150));
  if (pgFlushTimer.unref) pgFlushTimer.unref();
}
// De lokale snapshot is met Postgres alleen een warme-start-cache: Postgres is
// de duurzame waarheid en wint bij het opstarten. Hem bij elke flush (elke
// ~150 ms) volledig serialiseren (bij een grote kast honderden MB's) blokkeert
// de event-loop seconden lang. Daarom ten hoogste eens per PG_SNAP_MS (5 min):
// een verse-genoeg cache, en de stringify-stall van het hele db.data raakt de
// p99 dan hooguit een paar keer per uur in plaats van elke halve minuut.
// (Bij het afsluiten schrijft flushBijAfsluiten sowieso nog een verse snapshot.)
let laatsteLokaleSnap = 0;
const PG_SNAP_MS = Number(process.env.PG_SNAP_MS || 300000);
async function flushNu() {
  pgFlushTimer = null;
  if (!pg || !pgKlaar || pgFlushBezig || !db.writable || !pgVuil) return;
  pgVuil = false; pgFlushBezig = true;
  try {
    await pg.flush(db.data);
    // grote collecties die door de flush-pacing zijn uitgesteld: vuil blijven,
    // zodat de her-geplande flush ze na de pauze alsnog wegschrijft
    if (pg.heeftUitgesteld && pg.heeftUitgesteld()) pgVuil = true;
    if (Date.now() - laatsteLokaleSnap >= PG_SNAP_MS) { schrijfLokaleSnapshotStil(); laatsteLokaleSnap = Date.now(); }
  }
  catch (e) { pgVuil = true; console.warn('[pg] flush mislukt:', e.message); }
  finally { pgFlushBezig = false; if (pgVuil && pgKlaar) planFlush(); }
}
/* Start de Postgres-koppeling: schema klaarzetten, de gedeelde data ophalen
   (Postgres wint bij het opstarten), en daarna live meeluisteren op wijzigingen
   van andere instances (LISTEN/NOTIFY) met een poll als vangnet. */
/* ---- Grootboek van zaken (suppliers_big) ----------------------------------
   Voor een echt enorme catalogus (miljoenen restaurants) is een array in het
   geheugen geen optie: de kast wordt bij elke save als EEN string geserialiseerd
   (>512 MB kan V8 niet) en zou gigabytes RAM kosten. Daarom staan de bulk-zaken
   als GEINDEXEERDE RIJEN in Postgres (code = primaire sleutel) en worden ze op
   aanvraag opgezocht, met een kleine cache. Zo passen miljoenen zaken zonder ze
   ooit allemaal in het geheugen te laden. De demo-/actieve zaken blijven gewoon
   in db.data.suppliers (klein, snel, ongewijzigd). Zonder Postgres is dit inert. */
let grootPool = null;
const grootCache = new Map();      // code -> zaak-object of null (niet gevonden)
let grootN = 0, grootNAt = 0;
async function ververGrootN() {
  if (!grootPool) return 0;
  try { const r = await grootPool.query('SELECT count(*)::bigint AS c FROM suppliers_big'); grootN = Number(r.rows[0].c); grootNAt = Date.now(); } catch (e) {}
  return grootN;
}
async function laadGroot(code) {
  try {
    const r = await grootPool.query('SELECT code, name, type, city FROM suppliers_big WHERE code = $1', [code]);
    const row = r.rows[0];
    if (grootCache.size > 5000) grootCache.clear();            // kleine LRU: gewoon legen bij vol
    grootCache.set(code, row ? { code: row.code, name: row.name, type: row.type, city: row.city, menu: [], rate: 0.12 } : null);
  } catch (e) { grootCache.delete(code); }
}
// Synchronoon zoeken in het grootboek: uit de cache, of null terwijl we hem
// asynchroon inladen (de volgende keer zit hij in de cache). Zo blijft
// findSupplier synchroon zoals de hele app verwacht.
function grootSupplierSync(code) {
  if (!grootPool) return null;
  if (grootCache.has(code)) return grootCache.get(code);
  grootCache.set(code, null);        // voorkom een storm van gelijke queries
  laadGroot(code);
  return null;
}
function grootAantal() {
  if (grootPool && Date.now() - grootNAt > 10000) { grootNAt = Date.now(); ververGrootN().catch(() => {}); }
  return grootN;
}

/* ---- Ledengids (member_dir) -----------------------------------------------
   De codenaam/pas-gids per lid (sleutel -> {codename, tier}) is bij miljoenen
   leden geen array/object in het geheugen: dat kost gigabytes en zou de hele
   kast als EEN string moeten serialiseren. Daarom staan de leden hier als
   GEINDEXEERDE RIJEN in Postgres (key = primaire sleutel, codename_lower voor
   zoeken), met een kleine cache van de actieve leden. Zo passen tientallen
   miljoenen leden zonder ze ooit allemaal in het geheugen te laden. Zonder
   Postgres is dit inert en gebruikt de app db.data.memberDir zoals voorheen. */
let ledenPool = null;
const ledenCache = new Map();      // key -> { codename, tier } of null (niet gevonden)
let ledenN = 0, ledenNAt = 0;
async function ververLedenN() {
  if (!ledenPool) return 0;
  try { const r = await ledenPool.query('SELECT count(*)::bigint AS c FROM member_dir'); ledenN = Number(r.rows[0].c); ledenNAt = Date.now(); } catch (e) {}
  return ledenN;
}
async function laadLid(key) {
  try {
    const r = await ledenPool.query('SELECT codename, tier FROM member_dir WHERE key = $1', [key]);
    const row = r.rows[0];
    if (ledenCache.size > 100000) ledenCache.clear();          // begrensde cache van actieve leden
    ledenCache.set(key, row ? { codename: row.codename, tier: row.tier } : null);
  } catch (e) { ledenCache.delete(key); }
}
function ledenGidsActief() { return !!ledenPool; }
// Synchroon opzoeken: uit de cache, of null terwijl we hem asynchroon inladen
// (de volgende keer zit hij in de cache). Zo blijven de bestaande synchrone
// lezers werken zoals de app verwacht.
function ledenGidsHaal(key) {
  if (!ledenPool) return undefined;
  if (ledenCache.has(key)) return ledenCache.get(key);
  ledenCache.set(key, null);          // voorkom een storm van gelijke queries
  laadLid(key);
  return null;
}
function ledenGidsAantal() {
  if (ledenPool && Date.now() - ledenNAt > 10000) { ledenNAt = Date.now(); ververLedenN().catch(() => {}); }
  return ledenN;
}
// Nieuw of gewijzigd lid: cache meteen bijwerken (zodat een lezer direct na een
// schrijf het juiste antwoord krijgt) en de rij in Postgres upserten.
async function ledenGidsZet(key, codename, tier) {
  if (!ledenPool) return;
  ledenCache.set(key, { codename, tier });
  try {
    const r = await ledenPool.query(
      'INSERT INTO member_dir(key, codename, tier, codename_lower) VALUES($1,$2,$3,$4) ' +
      'ON CONFLICT(key) DO UPDATE SET codename=$2, tier=$3, codename_lower=$4 RETURNING (xmax=0) AS nieuw',
      [key, codename, tier, String(codename || '').toLowerCase()]);
    if (r.rows[0] && r.rows[0].nieuw) ledenN++;
  } catch (e) {}
}
// Omgekeerd opzoeken (codenaam -> sleutel), geindexeerd i.p.v. een scan.
async function ledenGidsKeyVanCodenaam(codename) {
  if (!ledenPool) return null;
  try { const r = await ledenPool.query('SELECT key FROM member_dir WHERE codename_lower = $1 LIMIT 1', [String(codename || '').trim().toLowerCase()]); return r.rows[0] ? r.rows[0].key : null; } catch (e) { return null; }
}
// Zoeken op (deel van) een codenaam, geindexeerd en begrensd.
async function ledenGidsZoek(qLower, limit) {
  if (!ledenPool) return [];
  try {
    const r = await ledenPool.query('SELECT key, codename, tier FROM member_dir WHERE codename_lower LIKE $1 LIMIT $2', ['%' + String(qLower || '') + '%', limit || 20]);
    // De gevonden leden meteen in de per-sleutel cache warmen: wie iemand net via
    // de zoekindex vond en daarna op de sleutel opzoekt (codeExists bij verbinden
    // of bellen) moet die synchroon terugvinden, niet op een koude cache stuiten.
    if (ledenCache.size > 100000) ledenCache.clear();
    for (const row of r.rows) ledenCache.set(row.key, { codename: row.codename, tier: row.tier });
    return r.rows.map(row => ({ key: row.key, codename: row.codename, tier: row.tier }));
  } catch (e) { return []; }
}

/* ---- Transactie-index (orders/boekingen) ----------------------------------
   De hete leespaden zoeken een order/boeking op ref, klant of zaak. Als lineaire
   scan over de array is dat O(N) per verzoek: met honderdduizenden levende
   tickets blokkeert elke aanvraag de event-loop. Deze secundaire indexen maken
   dat O(1), in ALLE opslagmodi (json/sqlite/postgres), zonder de arrays zelf te
   veranderen: de waarheid blijft db.data.orders / db.data.boekingen.

   Zelfherstellend: wordt de array vervangen (archief, venster-kap, een
   Postgres-sync die de collectie overschrijft) of muteert iemand hem buiten de
   helpers om (lengte klopt niet meer), dan bouwt de index zichzelf lui opnieuw
   bij de eerstvolgende lezing. De indexsleutels (ref, klant, zaak) veranderen
   nooit na aanmaak; statuswissels muteren het object in-place en zijn dus
   automatisch zichtbaar via de index. */
const txStaat = { orders: null, boekingen: null };
const txKlantVan = t => t.customerKey || t.customerTier;
function txBouw(naam) {
  const arr = db.data[naam] || [];
  const st = { arr, len: arr.length, byRef: new Map(), byKlant: new Map(), byZaak: new Map() };
  for (const t of arr) {
    if (!t) continue;
    if (t.ref != null && !st.byRef.has(t.ref)) st.byRef.set(t.ref, t); // .find-semantiek: de eerste (nieuwste) wint
    const k = txKlantVan(t); if (k != null) { let l = st.byKlant.get(k); if (!l) st.byKlant.set(k, l = []); l.push(t); }
    const z = t.supplierCode; if (z != null) { let l = st.byZaak.get(z); if (!l) st.byZaak.set(z, l = []); l.push(t); }
  }
  txStaat[naam] = st;
  return st;
}
function txZorg(naam) {
  const st = txStaat[naam], arr = db.data[naam];
  if (!st || st.arr !== arr || st.len !== (arr ? arr.length : 0)) return txBouw(naam);
  return st;
}
// Nieuw ticket vooraan (nieuwste eerst), incrementeel in de index. Met
// achteraan:true blijft de oude push-volgorde van die ene kassaroute intact.
function txVoegToe(naam, t, opties) {
  const st = txZorg(naam);
  const achteraan = !!(opties && opties.achteraan);
  if (achteraan) st.arr.push(t); else st.arr.unshift(t);
  st.len++;
  if (t.ref != null && (achteraan ? !st.byRef.has(t.ref) : true)) st.byRef.set(t.ref, t);
  const k = txKlantVan(t); if (k != null) { let l = st.byKlant.get(k); if (!l) st.byKlant.set(k, l = []); if (achteraan) l.push(t); else l.unshift(t); }
  const z = t.supplierCode; if (z != null) { let l = st.byZaak.get(z); if (!l) st.byZaak.set(z, l = []); if (achteraan) l.push(t); else l.unshift(t); }
  // Nieuw item ook meteen (best-effort) naar het grootboek als dat actief is;
  // de veegronde is het vangnet voor gemiste schrijfacties en statuswissels.
  if (txPool) txLedgerZet(naam, t);
  // Begrensde collecties (boekingen): pas kappen als de grens echt overschreden
  // is, in plaats van bij elke toevoeging een kopie te slicen zoals voorheen.
  // Met een actief grootboek kapt de veegronde (die de staart eerst veilig
  // wegschrijft) -- dan verdwijnt er niets meer stilletjes.
  const cap = opties && opties.cap;
  if (cap && !txPool && st.arr.length > cap) { st.arr.length = cap; txBouw(naam); }
}
// De staart voorbij `max` (voor het RAM-venster van Fase B: eerst veilig naar
// het grootboek, daarna pas verwijderen). Verwijderen gaat op identiteit, zodat
// nieuwe toevoegingen tussendoor niets verschuiven.
function txStaartNa(naam, max) { txZorg(naam); return (db.data[naam] || []).slice(max); }
function txVerwijder(naam, items) {
  if (!items || !items.length) return;
  const weg = new Set(items);
  db.data[naam] = (db.data[naam] || []).filter(t => !weg.has(t));
  txBouw(naam);
}
const txMetRef = (naam, ref) => txZorg(naam).byRef.get(ref);
const txVanKlant = (naam, key) => txZorg(naam).byKlant.get(key) || [];
const txVanZaak = (naam, code) => txZorg(naam).byZaak.get(code) || [];
// De gemaksnamen waar de routes en kern-modules mee lezen/schrijven.
const orderMetRef = ref => txMetRef('orders', ref);
const ordersVanKlant = key => txVanKlant('orders', key);
const ordersVanZaak = code => txVanZaak('orders', code);
const ordersVoegToe = (o, opties) => txVoegToe('orders', o, opties);
const boekingMetRef = ref => txMetRef('boekingen', ref);
const boekingenVanKlant = key => txVanKlant('boekingen', key);
const boekingenVanZaak = code => txVanZaak('boekingen', code);
const boekingenVoegToe = b => txVoegToe('boekingen', b, { cap: 50000 });

/* ---- Transactie-grootboek (tx_ledger) -------------------------------------
   Dezelfde stap als de ledengids, maar voor de transacties: orders en boekingen
   als GEINDEXEERDE RIJEN in Postgres (soort+ref als sleutel, klant/zaak/at
   geindexeerd), buiten het procesgeheugen. Het werkgeheugen houdt alleen een
   VENSTER van de recentste items (TX_RAM_*); alles daarbuiten leeft in het
   grootboek en is via de gepagineerde lezers bereikbaar. Zo blijft de kv-blob
   klein (goedkope flush) en verdwijnt de laatste O(alles)-serialisatie.

   Verlies-vrij per constructie: de veegronde schrijft de staart EERST (upsert,
   idempotent) naar het grootboek en haalt hem pas daarna uit het RAM. Nieuwe
   items gaan bij aanmaak direct (best-effort) mee; statuswissels van recente
   items neemt de veegronde mee via de hete kop. Het grootboek is daarmee
   hooguit een veegronde achter op in-place mutaties -- gedocumenteerd en
   bewust: het RAM-venster blijft de waarheid voor het hete pad.
   Zonder Postgres is dit alles inert en verandert er niets aan het gedrag,
   op een verschil na dat alleen maar veiliger is: de boekingen-cap (50k) laat
   met grootboek niets meer stilletjes verdwijnen. */
let txPool = null;
const TX_RAM_MAX = { orders: Number(process.env.TX_RAM_ORDERS || 30000), boekingen: Number(process.env.TX_RAM_BOEKINGEN || 50000) };
const TX_SOORT = { orders: 'order', boekingen: 'boeking' };
const TX_VEEG_MS = Number(process.env.TX_VEEG_MS || 30000);
const TX_KAP = Number(process.env.TX_KAP || 20000);      // max staart-items per veegronde (tegen event-loop-stalls)
const TX_KOP = Number(process.env.TX_KOP || 500);        // hete kop die elke ronde opnieuw meegaat (statuswissels)
const txBekend = { orders: new Set(), boekingen: new Set() }; // refs waarvan we weten dat ze in het grootboek staan
let txVeegTimer = null, txVeegBezig = false;
function txLedgerActief() { return !!txPool; }
const txDedup = items => { const gezien = new Set(); const uit = []; for (const t of items) { if (!t || t.ref == null || gezien.has(t.ref)) continue; gezien.add(t.ref); uit.push(t); } return uit; };
async function txLedgerZet(naam, t) {
  if (!txPool || !t || t.ref == null) return;
  try {
    await txPool.query(
      `INSERT INTO tx_ledger(soort, ref, klant, zaak, paid, status, totaal, at, data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(soort, ref) DO UPDATE SET klant=$3, zaak=$4, paid=$5, status=$6, totaal=$7, at=$8, data=$9`,
      [TX_SOORT[naam], String(t.ref), txKlantVan(t) || null, t.supplierCode || null, !!t.paid, t.status || null,
        Number(t.total != null ? t.total : t.price) || 0, t.at || new Date().toISOString(), kluis.versleutel(JSON.stringify(t))]);
    txBekend[naam].add(t.ref);
  } catch (e) { /* eventueel-consistent: de veegronde (backfill/kop) probeert het opnieuw */ }
}
async function txLedgerBulk(naam, items) {
  if (!txPool) return false;
  const schoonItems = txDedup(items);
  const soort = TX_SOORT[naam];
  for (let i = 0; i < schoonItems.length; i += 1000) {
    const brok = schoonItems.slice(i, i + 1000);
    const vals = [], params = [];
    brok.forEach((t, j) => {
      const b = j * 9;
      vals.push('($' + (b + 1) + ',$' + (b + 2) + ',$' + (b + 3) + ',$' + (b + 4) + ',$' + (b + 5) + ',$' + (b + 6) + ',$' + (b + 7) + ',$' + (b + 8) + ',$' + (b + 9) + ')');
      params.push(soort, String(t.ref), txKlantVan(t) || null, t.supplierCode || null, !!t.paid, t.status || null,
        Number(t.total != null ? t.total : t.price) || 0, t.at || new Date().toISOString(), kluis.versleutel(JSON.stringify(t)));
    });
    await txPool.query(
      'INSERT INTO tx_ledger(soort,ref,klant,zaak,paid,status,totaal,at,data) VALUES ' + vals.join(',') +
      ' ON CONFLICT(soort,ref) DO UPDATE SET klant=EXCLUDED.klant, zaak=EXCLUDED.zaak, paid=EXCLUDED.paid, status=EXCLUDED.status, totaal=EXCLUDED.totaal, at=EXCLUDED.at, data=EXCLUDED.data',
      params);
    for (const t of brok) txBekend[naam].add(t.ref);
  }
  return true;
}
// Gepagineerde lezers: geindexeerd op (soort, klant/zaak, at), nooit een scan.
async function txLedgerVanKlant(naam, klant, limit, offset) {
  if (!txPool) return [];
  try {
    const r = await txPool.query('SELECT data FROM tx_ledger WHERE soort=$1 AND klant=$2 ORDER BY at DESC LIMIT $3 OFFSET $4',
      [TX_SOORT[naam], String(klant || ''), Math.min(200, limit || 25), Math.max(0, offset || 0)]);
    return r.rows.map(x => JSON.parse(kluis.ontsleutel(x.data)));
  } catch (e) { return []; }
}
async function txLedgerVanZaak(naam, zaak, limit, offset) {
  if (!txPool) return [];
  try {
    const r = await txPool.query('SELECT data FROM tx_ledger WHERE soort=$1 AND zaak=$2 ORDER BY at DESC LIMIT $3 OFFSET $4',
      [TX_SOORT[naam], String(zaak || ''), Math.min(200, limit || 25), Math.max(0, offset || 0)]);
    return r.rows.map(x => JSON.parse(kluis.ontsleutel(x.data)));
  } catch (e) { return []; }
}
async function txLedgerTel(naam, klant) {
  if (!txPool) return 0;
  try {
    const r = klant != null
      ? await txPool.query('SELECT count(*)::bigint AS c FROM tx_ledger WHERE soort=$1 AND klant=$2', [TX_SOORT[naam], String(klant)])
      : await txPool.query('SELECT count(*)::bigint AS c FROM tx_ledger WHERE soort=$1', [TX_SOORT[naam]]);
    return Number(r.rows[0].c);
  } catch (e) { return 0; }
}
// Synchrone, gecachete totalen (zelfde patroon als ledenGidsAantal): de
// KPI-lezers blijven synchroon en krijgen een teller die hooguit ~10 s achterloopt.
const txN = { orders: 0, boekingen: 0 };
let txNAt = 0;
function txLedgerAantal(naam) {
  if (txPool && Date.now() - txNAt > 10000) {
    txNAt = Date.now();
    (async () => { try { txN.orders = await txLedgerTel('orders'); txN.boekingen = await txLedgerTel('boekingen'); } catch (e) {} })();
  }
  return txN[naam] || 0;
}
/* De veegronde: (1) backfill wat het grootboek nog niet kent (na een boot met
   een bestaande kv), (2) de hete kop opnieuw (statuswissels), (3) de staart
   voorbij het venster veilig wegschrijven en dan pas uit het RAM halen.
   Gepaced (TX_KAP per ronde) zodat een grote achterstand nooit de event-loop
   blokkeert maar in rustige stappen wegloopt. */
async function txVeegNu() {
  if (!txPool || txVeegBezig || !db.writable) return;
  txVeegBezig = true;
  try {
    for (const naam of ['orders', 'boekingen']) {
      const arr = db.data[naam] || [];
      const onbekend = arr.filter(t => t && t.ref != null && !txBekend[naam].has(t.ref)).slice(0, TX_KAP);
      if (onbekend.length) await txLedgerBulk(naam, onbekend);
      if (arr.length) await txLedgerBulk(naam, arr.slice(0, TX_KOP));
      if (arr.length > TX_RAM_MAX[naam]) {
        const staart = txStaartNa(naam, TX_RAM_MAX[naam]).slice(-TX_KAP).filter(t => t && t.ref != null);
        if (staart.length) {
          await txLedgerBulk(naam, staart);   // eerst duurzaam in het grootboek...
          txVerwijder(naam, staart);          // ...dan pas uit het venster
          save();
          console.log('[tx] ' + staart.length + ' ' + naam + ' voorbij het venster naar het grootboek verhuisd; ' + (db.data[naam] || []).length + ' in het RAM.');
        }
      }
    }
  } catch (e) { console.warn('[tx] veegronde mislukt:', e.message); }
  finally { txVeegBezig = false; }
}

async function startPostgres() {
  if (STORE !== 'postgres') return false;
  pg = require('./pg').maakPg({ merge3, kluis, log: pgLog, url: DATABASE_URL });
  await pg.schema();
  // het grootboek van bulk-zaken (geindexeerd, buiten het geheugen)
  grootPool = pg.pool;
  try { await grootPool.query('CREATE TABLE IF NOT EXISTS suppliers_big(code text PRIMARY KEY, name text, type text, city text)'); await ververGrootN(); } catch (e) { pgLog && pgLog.warn && pgLog.warn('[db] grootboek init mislukt: ' + e.message); }
  // de ledengids: geindexeerde rijen buiten het geheugen (zie boven)
  ledenPool = pg.pool;
  try {
    await ledenPool.query('CREATE TABLE IF NOT EXISTS member_dir(key text PRIMARY KEY, codename text, tier text, codename_lower text)');
    // btree: exact opzoeken (codenaam -> sleutel, de betaal/Tik-weg) is O(log n)
    await ledenPool.query('CREATE INDEX IF NOT EXISTS member_dir_codename_lower ON member_dir(codename_lower)');
    // Deelzoeken ("vind een vriend", LIKE '%q%') kan een btree-index niet
    // gebruiken door het wildcard-voorvoegsel: dan scant hij alle rijen (bij
    // tientallen miljoenen leden seconden per zoekopdracht). De trigram-index
    // (pg_trgm) maakt juist die LIKE '%q%' geindexeerd. Best-effort: mag de
    // extensie niet (geen rechten) of ontbreekt pg_trgm, dan valt het zoeken
    // terug op de scan en werkt de rest gewoon door.
    try {
      await ledenPool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await ledenPool.query('CREATE INDEX IF NOT EXISTS member_dir_codename_trgm ON member_dir USING gin(codename_lower gin_trgm_ops)');
    } catch (e) { pgLog && pgLog.warn && pgLog.warn('[db] trigram-zoekindex niet beschikbaar (deelzoeken valt terug op scan): ' + e.message); }
    await ververLedenN();
  } catch (e) { ledenPool = null; pgLog && pgLog.warn && pgLog.warn('[db] ledengids init mislukt: ' + e.message); }
  // het transactie-grootboek: orders/boekingen als geindexeerde rijen (zie boven)
  try {
    await pg.pool.query(`CREATE TABLE IF NOT EXISTS tx_ledger(
      soort text NOT NULL, ref text NOT NULL, klant text, zaak text,
      paid boolean, status text, totaal numeric, at timestamptz, data text NOT NULL,
      PRIMARY KEY(soort, ref))`);
    await pg.pool.query('CREATE INDEX IF NOT EXISTS tx_ledger_klant ON tx_ledger(soort, klant, at DESC)');
    await pg.pool.query('CREATE INDEX IF NOT EXISTS tx_ledger_zaak ON tx_ledger(soort, zaak, at DESC)');
    txPool = pg.pool;
    txVeegTimer = setInterval(() => { txVeegNu().catch(() => {}); }, TX_VEEG_MS);
    if (txVeegTimer.unref) txVeegTimer.unref();
    const eersteVeeg = setTimeout(() => { txVeegNu().catch(() => {}); }, 3000);
    if (eersteVeeg.unref) eersteVeeg.unref();
  } catch (e) { txPool = null; pgLog && pgLog.warn && pgLog.warn('[db] tx-grootboek init mislukt: ' + e.message); }
  const pgData = await pg.laadAlles();
  if (pgData) {
    // Postgres is de gedeelde waarheid en wint voor elke collectie die hij heeft.
    // Maar bij twee instances op een VERSE database kan een lezer een partiele
    // snapshot lezen terwijl de ander nog aan het flushen is; zonder backfill zou
    // db.data dan een collectie (bijv. live) missen en zouden lezers crashen op
    // Object.keys(undefined). Daarom vullen we ontbrekende collecties aan met de
    // al geseede defaults; zodra de flush rond is, synchroniseert de rest vanzelf.
    db.data = Object.assign(db.data || {}, pgData);
    if (db.data.__schema == null) db.data.__schema = 1;
    schrijfLokaleSnapshotStil();
    if (externCb) externCb();
  } else if (db.writable) {
    await pg.flush(db.data, true); // lege database: onze seed/snapshot erin (alles, ook grote collecties)
  }
  // Venster-top-up uit het grootboek: de kv-blob mag voor grote collecties een
  // paar seconden achterlopen (flush-pacing). Items die al wel als rij in het
  // grootboek staan maar nog niet in de blob, komen hier terug in het venster,
  // zodat er bij een herstart niets uit de actieve stroom verdwijnt.
  if (txPool && db.data) {
    for (const naam of ['orders', 'boekingen']) {
      try {
        const r = await txPool.query('SELECT data FROM tx_ledger WHERE soort=$1 ORDER BY at DESC LIMIT 500', [TX_SOORT[naam]]);
        const arr = Array.isArray(db.data[naam]) ? db.data[naam] : (db.data[naam] = []);
        const bekend = new Set(arr.map(t => t && t.ref).filter(x => x != null));
        const missend = [];
        for (const row of r.rows) { const t = JSON.parse(kluis.ontsleutel(row.data)); if (!bekend.has(t.ref)) missend.push(t); }
        if (missend.length) {
          missend.sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))); // nieuwste eerst, zoals unshift
          db.data[naam] = missend.concat(arr);
          console.log('[tx] ' + missend.length + ' ' + naam + ' uit het grootboek teruggezet in het venster (kv liep achter).');
        }
      } catch (e) { pgLog && pgLog.warn && pgLog.warn('[db] venster-top-up ' + naam + ' mislukt: ' + e.message); }
    }
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
  try { await pg.flush(db.data, true); } catch (e) {} // force: ook de door pacing uitgestelde grote collecties
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
    if (!db.data) {
      // migratiepad: wie met RTG_STORE=sqlite overstapt terwijl er nog een
      // db.json ligt, neemt die data mee in plaats van leeg te beginnen
      const oud = leesLokaleSnapshot();
      if (oud) console.log('[db] bestaande db.json overgenomen in de SQLite-opslag.');
      db.data = oud || seed();
      save();
    }
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
// Boven ~512 MB serialiseert V8 geen string meer ("Invalid string length"): dan
// is de JSON-snapshotopslag vol. We proberen 'm dan niet bij ELKE save opnieuw
// (dat blokkeert de event-loop telkens seconden op een zinloze poging), maar
// koelen 60 s af en waarschuwen luid dat de Postgres-opslag nodig is voor deze
// omvang. Zodra de data weer past, herstelt het zichzelf.
let snapshotVol = false, snapshotWaarschuwing = 0;
function schrijfSnapshotNu() {
  saveVuil = false;
  if (snapshotVol && Date.now() - snapshotWaarschuwing < 60000) { saveKlaar = Date.now(); return; }
  const t0 = Date.now();
  try {
    beslotenMap(DATA_DIR);
    // compact (geen pretty-print): bij grote data scheelt dat ~40% tijd en ruimte
    const uit = kluis.AAN ? kluis.versleutel(JSON.stringify(db.data)) : JSON.stringify(db.data);
    schrijfDuurzaam(DB_FILE, uit, 0o600);
    besloten(DB_FILE);
    if (STORE !== 'postgres') spiegelNaarRedis(); // alleen de JSON-opslag deelt via Redis
    snapshotVol = false;
  } catch (e) {
    if (/Invalid string length|string longer than|Cannot create a string/i.test(e.message || '')) {
      snapshotVol = true; snapshotWaarschuwing = Date.now();
      console.error('[db] datastore te groot voor een JSON-snapshot (' + e.message +
        '). Schakel voor deze omvang over op STORE=postgres; snapshots worden 60 s overgeslagen.');
    } else {
      console.warn('[db] snapshot schrijven mislukt:', e.message);
    }
  }
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
    // Postgres is de duurzame waarheid (write-behind via planFlush). De lokale
    // snapshot is enkel een warme cache en wordt binnen flushNu gethrotteld
    // geschreven; hem hier óók plannen zou de event-loop dubbel belasten.
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

module.exports = { db, load, save, DATA_DIR, STORE, startGedeeld, startSqliteSync, startPostgres, flushBijAfsluiten, pgPing, onExternalChange, merge3, schrijfDuurzaam, grootSupplierSync, grootAantal,
  ledenGidsActief, ledenGidsHaal, ledenGidsAantal, ledenGidsZet, ledenGidsKeyVanCodenaam, ledenGidsZoek,
  orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  txStaartNa, txVerwijder,
  txLedgerActief, txLedgerVanKlant, txLedgerVanZaak, txLedgerTel, txLedgerAantal, txVeegNu };
