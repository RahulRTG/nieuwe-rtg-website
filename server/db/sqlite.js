/* SQLite/WAL: collecties hebben versies; de poll leest externe wijzigingen.
   Schrijvers delen dezelfde transactionele store.db. De twee auditjournalen
   hebben eigen rijen; db.data blijft de leesprojectie van dezelfde opslag.
   Een verwijderde collectie wordt een tombstone (kolom `deleted`), zodat een
   tweede instance haar niet uit een verouderde werkkopie laat herrijzen. */
const path = require('path');
const kluis = require('../kluis');
const state = require('./state');
const { merge3 } = require('./merge');
const { DATA_DIR, STORE, besloten, beslotenMap } = require('./opslag');
// De goedkope veranderingsdetectie op GROTE collecties; daar staat ook waarom
// hij veilig is en waarom geld er nooit door gaat.
const voorcheck = require('./voorcheck');
const mutaties = require('./mutatietracker');
const { snapshot, externeCollecties } = require('./sqlite-poll');
const db = state.db;
let auditMotorWaarde;
function auditMotor() {
  sqliteInit();
  return auditMotorWaarde || (auditMotorWaarde = require('./audit-sqlite')({ db, kv: kvdb,
    decode: uitStore, encode: naarStore, bump: () => statements().bump.run() }));
}

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
  require('../lib/sqlite-gelijktijdigheid')(kvdb);
  // Houd het WAL-bestand begrensd: na een checkpoint wordt het teruggezet naar
  // deze grens in plaats van op zijn hoogste stand te blijven staan. Zonder dit
  // groeide store.db-wal tot een paar MB en werd elke start onnodig traag.
  kvdb.exec('PRAGMA journal_size_limit=' + Number(process.env.RTG_SQLITE_WAL_MAX || 8 * 1024 * 1024));
  kvdb.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0)');
  const kolommen = kvdb.prepare('PRAGMA table_info(kv)').all();
  if (!kolommen.some(k => k.name === 'deleted'))
    kvdb.exec('ALTER TABLE kv ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
  kvdb.exec('CREATE INDEX IF NOT EXISTS idx_kv_ver ON kv(ver)');
  kvdb.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER)');
  kvdb.exec("INSERT INTO meta(k,v) VALUES('ver',0) ON CONFLICT(k) DO NOTHING");
}
function loadSqlite() {
  sqliteInit();
  const audits = auditMotor();
  const { rows, audit } = snapshot(kvdb, () => ({
    rows: kvdb.prepare('SELECT key, val, ver, deleted FROM kv').all(), audit: audits.snapshots()
  }));
  if (!rows.length && !audit.length) return null;
  const data = {};
  for (const r of rows) {
    toegepast.set(r.key, r.ver);
    if (r.deleted) continue;
    const j = uitStore(r.val); data[r.key] = JSON.parse(j); laatsteJson.set(r.key, j);
  }
  return audits.laad(data, audit);
}
// De statements zijn per verbinding altijd dezelfde: één keer voorbereiden
// in plaats van bij elke save opnieuw (SQLite hoeft dan niet te hercompileren).
let stmt = null;
function statements() {
  if (stmt) return stmt;
  stmt = {
    bump: kvdb.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'"),
    huidig: kvdb.prepare("SELECT v FROM meta WHERE k = 'ver'"),
    lees: kvdb.prepare('SELECT val, ver, deleted FROM kv WHERE key = ?'),
    versies: kvdb.prepare('SELECT key, ver FROM kv'),
    up: kvdb.prepare('INSERT INTO kv(key,val,ver,deleted) VALUES(?,?,?,0) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver, deleted=0'),
    weg: kvdb.prepare('INSERT INTO kv(key,val,ver,deleted) VALUES(?,NULL,?,1) ON CONFLICT(key) DO UPDATE SET val=NULL, ver=excluded.ver, deleted=1')
  };
  return stmt;
}
// Plan, transactie en publicatie na de commit: ./sqlite-save.js.
const saveSqlite = require('./sqlite-save')({ db, verbinding: () => { sqliteInit(); return kvdb; },
  statements, auditMotor, mutaties, voorcheck, merge3, uitStore, naarStore, laatsteJson, toegepast,
  vouwWal: () => vouwWalSqlite() });

// Haal de collecties op die een ANDER proces sinds onze laatste versie schreef,
// en zet ze in db.data. Zo blijven losse domeinprocessen bij elkaar in de pas.
const pollSqlite = require('./sqlite-poll')({
  lees: () => kvdb && externeCollecties(kvdb, statements(), toegepast, auditMotor().snapshots),
  publiceerAudit: lijst => auditMotor().publiceerSnapshots(lijst),
  toegepast, laatsteJson, db, uitStore, merge3, voorcheck, mutaties, externCb: state.getExternCb });
let pollTimer = null;
// Start de kruisproces-synchronisatie (alleen bij de SQLite-opslag).
function startSqliteSync() {
  if (STORE !== 'sqlite' || pollTimer) return;
  sqliteInit();
  pollTimer = setInterval(pollSqlite, Number(process.env.RTG_POLL_MS || 750));
  if (pollTimer.unref) pollTimer.unref();
}

/* Alleen de duurzame schrijver heeft al geflusht. Backup en afsluiten houden
   hun eigen volledige flush; de WAL-grens staat naast de transactielaag. Bij
   afsluiten vervalt de geplande vangrail: de laatste save is zelf volledig. */
const wal = require('./sqlite-checkpoint')({ verbinding: () => kvdb, saveSqlite });
const { checkpointSqlite, vouwWalSqlite } = wal;
function afrondSqlite() { saveSqlite.stopVangrail(); wal.afrondSqlite(); }

const persistentieStandSqlite = require('./sqlite-persistentie')({
  init: sqliteInit,
  huidig: () => statements().huidig.get()
});

const bewerkCollectieSqlite = require('./collectie-sqlite')({
  db, verbinding: () => { sqliteInit(); return kvdb; }, statements, uitStore, naarStore,
  laatsteJson, toegepast, voorcheck, mutaties
});
const economischeBoekingSqlite = require('./economische-boeking-sqlite')({ db,
  verbinding: () => { sqliteInit(); return kvdb; }, statements, merge3, uitStore, naarStore, laatsteJson, toegepast, voorcheck });

module.exports = { loadSqlite, saveSqlite, auditMotor, bewerkCollectieSqlite, economischeBoekingSqlite, startSqliteSync, afrondSqlite, checkpointSqlite, vouwWalSqlite,
  persistentieStandSqlite };
