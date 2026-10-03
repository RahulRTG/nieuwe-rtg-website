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
const mutaties = require('./mutatietracker');
const db = state.db;
const maakSaveplan = require('./sqlite-saveplan');

let kvdb = null;
const toegepast = new Map();   // collectie -> versienummer dat dit proces al toegepast heeft
const laatsteJson = new Map(); // collectie -> laatst weggeschreven JSON (om ongewijzigde over te slaan)
/* Een periodieke volledige vangrail dekt toekomstige onbekende mutatievormen;
   geraakte collecties en geld gaan meteen. */
const VOLLEDIG_MS = Number(process.env.RTG_SQLITE_VOLLEDIG_MS || 2000);
let volledigTimer = null;
const saveplan = maakSaveplan({ db, mutaties, voorcheck });

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
  const rows = kvdb.prepare('SELECT key, val, ver, deleted FROM kv').all();
  if (!rows.length) return null;
  const data = {};
  for (const r of rows) {
    toegepast.set(r.key, r.ver);
    if (r.deleted) continue;
    const j = uitStore(r.val); data[r.key] = JSON.parse(j); laatsteJson.set(r.key, j);
  }
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
    lees: kvdb.prepare('SELECT val, ver, deleted FROM kv WHERE key = ?'),
    up: kvdb.prepare('INSERT INTO kv(key,val,ver,deleted) VALUES(?,?,?,0) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver, deleted=0'),
    weg: kvdb.prepare('INSERT INTO kv(key,val,ver,deleted) VALUES(?,NULL,?,1) ON CONFLICT(key) DO UPDATE SET val=NULL, ver=excluded.ver, deleted=1')
  };
  return stmt;
}
function planVolledig() {
  if (volledigTimer || !(VOLLEDIG_MS > 0)) return;
  volledigTimer = setTimeout(() => {
    volledigTimer = null;
    try { saveSqlite(false, true); } catch (e) { console.warn('[db] SQLite-vangrail mislukt:', e.message); }
  }, VOLLEDIG_MS);
  if (volledigTimer.unref) volledigTimer.unref();
}

function saveSqlite(force, vangrail) {
  sqliteInit();
  const { gewijzigd, verwijderd, nagekeken, uitgesteld } = saveplan(force, vangrail, laatsteJson);
  if (uitgesteld) voorcheck.planNaronde(saveSqlite);
  if (!force && !vangrail) planVolledig();
  /* Niets te schrijven is iets anders dan niet geschreven; beide gaven hier
     `undefined`, en de duurzame bundel las dat als verlies -- zie duurzaam.js.
     Alleen zonder uitgesteld werk is elke collectie ook echt nagekeken. */
  if (!gewijzigd.length && !verwijderd.length) {
    mutaties.bevestig(nagekeken);
    return { alGelijk: !uitgesteld };
  }
  const { bump, huidig, lees, up, weg } = statements();
  const overgenomenGrafstenen = [];
  kvdb.exec('BEGIN IMMEDIATE'); // pak meteen de schrijflock, zodat de versie en de merge kloppen
  try {
    for (const [k, jOns] of gewijzigd) {
      let j = jOns;
      const rij = lees.get(k);
      // Schreef een ander proces deze collectie ondertussen? Voeg per item samen
      // in plaats van hun wijzigingen te overschrijven.
      if (rij && rij.deleted) {
        /* Delete-wins ook wanneer DIT proces de grafsteen bij load() al heeft
           toegepast. Na een herstart zetten de vormdefaults ontbrekende
           collecties namelijk weer als lege container in RAM; de eerstvolgende
           gewone save mag dat niet lezen als een bewuste herschepping. Alleen
           bewerkCollectieSqlite mag onder hetzelfde DB-slot vanaf de lege basis
           en na een echte mutatie de grafsteen vervangen. */
        overgenomenGrafstenen.push({ k, ver: Number(rij.ver) });
        continue;
      }
      if (rij && rij.ver > (toegepast.get(k) || 0)) {
        const base = laatsteJson.has(k) ? JSON.parse(laatsteJson.get(k)) : undefined;
        const hun = JSON.parse(uitStore(rij.val));
        const samen = merge3(base, db.data[k], hun);
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
    for (const k of verwijderd) {
      bump.run();
      const v = huidig.get().v;
      weg.run(k, v);
      laatsteJson.delete(k);
      toegepast.set(k, v);
      voorcheck.vergeet(k);
    }
    kvdb.exec('COMMIT');
  } catch (e) { try { kvdb.exec('ROLLBACK'); } catch (x) {} throw e; }
  for (const x of overgenomenGrafstenen) {
    delete db.data[x.k];
    laatsteJson.delete(x.k);
    toegepast.set(x.k, x.ver);
    voorcheck.vergeet(x.k);
    mutaties.vergeet(x.k);
  }
  mutaties.bevestig(nagekeken);
  return { alGelijk: false };
}
const pollSqlite = require('./sqlite-poll')({ verbinding: () => kvdb, toegepast,
  laatsteJson, db, uitStore, merge3, voorcheck, mutaties, externCb: state.getExternCb });
let pollTimer = null;
// Start de kruisproces-synchronisatie (alleen bij de SQLite-opslag).
function startSqliteSync() {
  if (STORE !== 'sqlite' || pollTimer) return;
  sqliteInit();
  pollTimer = setInterval(pollSqlite, Number(process.env.RTG_POLL_MS || 750));
  if (pollTimer.unref) pollTimer.unref();
}

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
  if (volledigTimer) { clearTimeout(volledigTimer); volledigTimer = null; }
  try { saveSqlite(true); } catch (e) { console.warn('[db] laatste sqlite-save mislukt:', e.message); }
  try { kvdb.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* ander proces leest nog */ }
}

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
module.exports = { loadSqlite, saveSqlite, bewerkCollectieSqlite, economischeBoekingSqlite, startSqliteSync, afrondSqlite, checkpointSqlite,
  persistentieStandSqlite };
