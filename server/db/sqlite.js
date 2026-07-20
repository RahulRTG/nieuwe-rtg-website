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
  besloten(bestand);
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
  for (const r of rows) { const j = uitStore(r.val); data[r.key] = JSON.parse(j); laatsteJson.set(r.key, j); toegepast.set(r.key, r.ver); }
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

module.exports = { loadSqlite, saveSqlite, startSqliteSync };
