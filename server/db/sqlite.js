/* Opslag, deel "sqlite": de SQLite-kv-motor. Elke top-level collectie is een rij
   (WAL, transactioneel), met een oplopend versienummer per collectie; een korte
   achtergrondpoll haalt de collecties op die een ANDER proces heeft gewijzigd.
   Zo kunnen echt losse schrijvende servers hetzelfde store.db delen zonder elkaar
   te overschrijven (per collectie serialiseert SQLite de schrijvers), en zien ze
   elkaars data live. De data in het geheugen (db.data) blijft gelijk. */
const path = require('path');
const kluis = require('../kluis');
const state = require('./state');
const { merge3 } = require('./merge');
const { DATA_DIR, STORE, besloten, beslotenMap } = require('./opslag');
// De goedkope veranderingsdetectie op GROTE collecties; daar staat ook waarom
// hij veilig is en waarom geld er nooit door gaat.
const voorcheck = require('./voorcheck');
const db = state.db;

let kvdb = null;
const toegepast = new Map();   // collectie -> versienummer dat dit proces al toegepast heeft
const laatsteJson = new Map(); // collectie -> laatst weggeschreven JSON (om ongewijzigde over te slaan)

// De opgeslagen waarde is (met RTG_ENC_KEY) versleuteld; in het geheugen en in
// laatsteJson houden we altijd de leesbare JSON aan, alleen op schijf staat cijfer.
const uitStore = v => kluis.ontsleutel(v);       // ruwe kolomwaarde -> leesbare JSON
const naarStore = j => kluis.versleutel(j);      // leesbare JSON -> op te slaan waarde

function sqliteInit() {
  if (kvdb) return;
  const { DatabaseSync } = require('node:sqlite');
  beslotenMap(DATA_DIR);
  const bestand = path.join(DATA_DIR, 'store.db');
  kvdb = new DatabaseSync(bestand);
  stmt = null; // verse verbinding: de voorbereide statements horen bij de oude
  besloten(bestand);
  /* Twee verse processen kunnen tegelijk de WAL-modus willen activeren. De
     wachttijd moet daarom VOOR die eerste lockende PRAGMA gelden; erna was te
     laat en maakte parallelle opstart incidenteel rood met "database is locked". */
  kvdb.exec('PRAGMA busy_timeout=5000');
  kvdb.exec('PRAGMA journal_mode=WAL');
  kvdb.exec('PRAGMA synchronous=NORMAL');
  // Houd het WAL-bestand begrensd: na een checkpoint wordt het teruggezet naar
  // deze grens in plaats van op zijn hoogste stand te blijven staan. Zonder dit
  // groeide store.db-wal tot een paar MB en werd elke start onnodig traag.
  kvdb.exec('PRAGMA journal_size_limit=' + Number(process.env.RTG_SQLITE_WAL_MAX || 8 * 1024 * 1024));
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
  for (const r of rows) { const j = uitStore(r.val); data[r.key] = JSON.parse(j); laatsteJson.set(r.key, j); toegepast.set(r.key, r.ver); }
  return data;
}
// De vier statements zijn per verbinding altijd dezelfde: één keer voorbereiden
// in plaats van bij elke save opnieuw (SQLite hoeft dan niet te hercompileren).
let stmt = null;
function statements() {
  if (stmt) return stmt;
  stmt = {
    bump: kvdb.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'"),
    huidig: kvdb.prepare("SELECT v FROM meta WHERE k = 'ver'"),
    lees: kvdb.prepare('SELECT val, ver FROM kv WHERE key = ?'),
    up: kvdb.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver')
  };
  return stmt;
}
function saveSqlite(force) {
  sqliteInit();
  const gewijzigd = [];
  const nu = Date.now();
  let uitgesteld = false;
  for (const k of Object.keys(db.data)) {
    if (voorcheck.magOverslaan(k, db.data[k], force, nu)) { uitgesteld = true; continue; }
    const j = JSON.stringify(db.data[k]);
    voorcheck.onthoud(k, j.length, db.data[k], nu);
    if (laatsteJson.get(k) !== j) gewijzigd.push([k, j]);
  }
  if (uitgesteld) voorcheck.planNaronde(saveSqlite);
  if (!gewijzigd.length) return;
  const { bump, huidig, lees, up } = statements();
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
        // na een merge is de collectie een ANDER object: de maten van de
        // voorcheck horen bij deze nieuwe inhoud, niet bij die van voor de merge
        voorcheck.onthoud(k, j.length, samen);
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
      // De inhoud komt van BUITEN: wat de voorcheck van deze collectie meende te
      // weten, geldt niet meer. Vergeten, zodat de volgende save hem exact nakijkt.
      voorcheck.vergeet(r.key);
      if (r.key === 'sessions') sessieGewijzigd = true;
    }
    if (sessieGewijzigd) { const ext = state.getExternCb(); if (ext) ext(); }
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

/* Netjes afronden: alles nog een keer volledig nakijken (de voorcheck mag niets
   achterlaten) en daarna de WAL in het hoofdbestand vouwen. Zonder die
   checkpoint blijft store.db-wal staan waar hij stond -- gemeten 4,9 MB naast
   een database van 1,9 MB -- en moet de volgende start dat eerst inlezen.
   TRUNCATE lukt alleen als geen ander proces meer leest; mislukt hij, dan is dat
   geen probleem (de data staat al gecommit in de WAL), dus alleen loggen. */
/* De WAL leegdrukken in store.db zelf.

   In WAL-modus staat verse data NIET in store.db maar in store.db-wal, en
   pas een checkpoint schuift hem over. Wie store.db kopieert zonder eerst te
   checkpointen, kopieert dus een bestand waar de recentste gegevens niet in
   staan -- en bij een verse installatie is dat letterlijk een leeg bestand van
   4 KB. Daarom roept de backup dit eerst aan. */
function checkpointSqlite() {
  if (!kvdb) return false;
  try { saveSqlite(true); } catch (e) {}
  try { kvdb.exec('PRAGMA wal_checkpoint(TRUNCATE)'); return true; }
  catch (e) { return false; }        // een ander proces leest nog; de -wal-kopie vangt dat op
}

function afrondSqlite() {
  if (!kvdb) return;
  try { saveSqlite(true); } catch (e) { console.warn('[db] laatste sqlite-save mislukt:', e.message); }
  try { kvdb.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* ander proces leest nog */ }
}

/* DE PERSISTENTE VERSIE, gelezen uit de DATABASE en niet uit het geheugen.

   Dit is het enige getal waarmee een aanroeper kan vaststellen dat zijn
   schrijfactie werkelijk de schijf heeft gehaald. Het geheugen kan hem niet
   bevestigen -- daar staat de wijziging sowieso -- en juist dat verschil is waar
   een verloren schrijfactie zich verstopt. Geeft null als er geen SQLite-opslag
   draait; de aanroeper hoort dat als "niet vast te stellen" te behandelen en
   niet als "in orde". */
function persistentieStandSqlite() {
  try { sqliteInit(); const r = statements().huidig.get(); return r ? Number(r.v) : null; }
  catch (e) { return null; }
}

const bewerkCollectieSqlite = require('./collectie-sqlite')({
  db, verbinding: () => { sqliteInit(); return kvdb; }, statements, uitStore, naarStore,
  laatsteJson, toegepast, voorcheck
});

module.exports = { loadSqlite, saveSqlite, bewerkCollectieSqlite, startSqliteSync, afrondSqlite, checkpointSqlite,
  persistentieStandSqlite };
