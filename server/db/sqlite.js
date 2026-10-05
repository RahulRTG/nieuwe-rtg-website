/* SQLite/WAL: collecties hebben versies; de poll leest externe wijzigingen.
   Schrijvers delen dezelfde transactionele store.db. De twee auditjournalen
   hebben eigen rijen; db.data blijft de leesprojectie van dezelfde opslag. */
const path = require('path');
const kluis = require('../kluis');
const state = require('./state');
const { merge3 } = require('./merge');
const { DATA_DIR, STORE, besloten, beslotenMap } = require('./opslag');
// Begrensde veranderingsdetectie voor grote collecties; nooit voor geld.
const voorcheck = require('./voorcheck');
const externeCollecties = require('./sqlite-poll');
const { collectieSleutels } = require('../opzet/begroting');
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
  kvdb.exec('CREATE INDEX IF NOT EXISTS idx_kv_ver ON kv(ver)');
  kvdb.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER)');
  kvdb.exec("INSERT INTO meta(k,v) VALUES('ver',0) ON CONFLICT(k) DO NOTHING");
}
function loadSqlite() {
  sqliteInit();
  const audits = auditMotor();
  const { rows, audit } = externeCollecties.snapshot(kvdb, () => ({
    rows: kvdb.prepare('SELECT key, val, ver FROM kv').all(), audit: audits.snapshots()
  }));
  if (!rows.length && !audit.length) return null;
  const data = {};
  for (const r of rows) { const j = uitStore(r.val); data[r.key] = JSON.parse(j); laatsteJson.set(r.key, j); toegepast.set(r.key, r.ver); }
  return audits.laad(data, audit);
}
// Bereid de vaste statements eenmaal per verbinding voor.
let stmt = null;
function statements() {
  if (stmt) return stmt;
  stmt = {
    bump: kvdb.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'"),
    huidig: kvdb.prepare("SELECT v FROM meta WHERE k = 'ver'"),
    lees: kvdb.prepare('SELECT val, ver FROM kv WHERE key = ?'),
    versies: kvdb.prepare('SELECT key, ver FROM kv'),
    up: kvdb.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver')
  };
  return stmt;
}
function saveSqlite(force, sleutels, extraAudit = [], duurzaam = false) {
  if (sleutels !== undefined && (!Array.isArray(sleutels) || (!sleutels.length && !extraAudit.length) ||
      sleutels.some(k => typeof k !== 'string' || !Object.hasOwn(db.data, k))))
    throw new TypeError('Een gerichte save vereist bestaande collecties');
  sqliteInit();
  if (duurzaam) return require('./sqlite-duurzaam')(kvdb,
    () => saveSqlite(true, sleutels, extraAudit), vouwWalSqlite);
  const audits = auditMotor(), doos = audits.doos();
  const auditOps = [...audits.vervangingen(db.data), ...(doos?.auditOps || []), ...extraAudit];
  const auditSleutels = new Set(auditOps.map(op => op.naam));
  const gewijzigd = [];
  const nu = Date.now();
  let uitgesteld = false;
  for (const k of sleutels === undefined ? collectieSleutels(db.data) : [...new Set(sleutels)]) {
    if (auditSleutels.has(k) || audits.bezit(db.data, k)) continue;
    if (voorcheck.magOverslaan(k, db.data[k], force || sleutels !== undefined, nu)) { uitgesteld = true; continue; }
    const j = JSON.stringify(db.data[k]);
    voorcheck.onthoud(k, j.length, db.data[k], nu);
    if (laatsteJson.get(k) !== j) gewijzigd.push([k, j]);
  }
  if (uitgesteld) voorcheck.planNaronde(saveSqlite);
  /* Niets te schrijven is iets anders dan niet geschreven; beide gaven hier
     `undefined`, en de duurzame bundel las dat als verlies -- zie duurzaam.js.
     Alleen zonder uitgesteld werk is elke collectie ook echt nagekeken. */
  if (!gewijzigd.length && !auditOps.length) return { alGelijk: !uitgesteld };
  const { bump, huidig, lees, up } = statements();
  const vastgelegd = [];
  const auditResultaten = [];
  let auditSnapshots;
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
      vastgelegd.push([k, j, v]);
    }
    for (const op of auditOps) auditResultaten.push(audits.pasToe(op));
    auditSnapshots = audits.publicaties(auditResultaten);
    kvdb.exec('COMMIT');
  } catch (e) {
    try { kvdb.exec('ROLLBACK'); } catch (x) {}
    for (const [k] of gewijzigd) voorcheck.vergeet(k);
    throw e;
  }
  for (const [k, j, v] of vastgelegd) { laatsteJson.set(k, j); toegepast.set(k, v); }
  audits.naCommit(auditResultaten, doos, auditSnapshots);
  return { alGelijk: false, committed: true };
}
// Haal de collecties op die een ANDER proces sinds onze laatste versie schreef,
// en zet ze in db.data. Zo blijven losse domeinprocessen bij elkaar in de pas.
function pollSqlite() {
  if (!kvdb) return;
  try {
    // Vergelijk versies per collectie: een eigen hogere versie mag een eerdere
    // externe wijziging niet verbergen. Haal uitsluitend gewijzigde payloads.
    const audits = auditMotor();
    const { rows, audit } = externeCollecties(kvdb, statements(), toegepast, audits.snapshots);
    const voorbereid = [];
    let sessieGewijzigd = false;
    for (const r of rows) {
      const sleutel = r.key;
      const baseJson = laatsteJson.get(sleutel);
      const hunJson = uitStore(r.val);
      const lokaalOpenstaand = baseJson !== undefined && JSON.stringify(db.data[sleutel]) !== baseJson;
      const waarde = lokaalOpenstaand ? merge3(JSON.parse(baseJson), db.data[sleutel], JSON.parse(hunJson)) : JSON.parse(hunJson);
      voorbereid.push({ sleutel, waarde, hunJson, lokaalOpenstaand, ver: r.ver });
    }
    audits.publiceerSnapshots(audit);
    for (const { sleutel, waarde, hunJson, lokaalOpenstaand, ver } of voorbereid) {
      db.data[sleutel] = waarde;
      if (!lokaalOpenstaand) laatsteJson.set(sleutel, hunJson);
      toegepast.set(sleutel, ver);
      // De inhoud komt van BUITEN: wat de voorcheck van deze collectie meende te
      // weten, geldt niet meer. Vergeten, zodat de volgende save hem exact nakijkt.
      voorcheck.vergeet(sleutel);
      if (sleutel === 'sessions') sessieGewijzigd = true;
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

/* Alleen de duurzame schrijver heeft al geflusht. Backup en afsluiten houden
   hun eigen volledige flush; de WAL-grens staat naast de transactielaag. */
const { checkpointSqlite, vouwWalSqlite, afrondSqlite } = require('./sqlite-checkpoint')({
  verbinding: () => kvdb, saveSqlite
});

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
const economischeBoekingSqlite = require('./economische-boeking-sqlite')({ db,
  verbinding: () => { sqliteInit(); return kvdb; }, statements, merge3, uitStore, naarStore, laatsteJson, toegepast, voorcheck });

module.exports = { loadSqlite, saveSqlite, auditMotor, bewerkCollectieSqlite, economischeBoekingSqlite, startSqliteSync, afrondSqlite, checkpointSqlite, vouwWalSqlite,
  persistentieStandSqlite };
