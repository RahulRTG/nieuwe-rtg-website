/* Opslag, deel "postgres": de write-behind koppeling met PostgreSQL (zie
   server/pg). Postgres is de gedeelde, duurzame waarheid; het geheugen (db.data)
   blijft de werkkopie en een lokale snapshot (DB_FILE) dient als warme cache en
   fallback als Postgres even wegvalt. Deze module beheert de flush-pacing, de
   koppeling bij het opstarten (gidsen + tx-grootboek klaarzetten, gedeelde data
   ophalen, live meeluisteren via LISTEN/NOTIFY met een poll als vangnet) en de
   gezondheidschecks. */
const kluis = require('../kluis');
const state = require('./state');
const { merge3 } = require('./merge');
const opslag = require('./opslag');
const gidsen = require('./gidsen');
const tx = require('./tx');
const db = state.db;
const { STORE, DATABASE_URL, schrijfLokaleSnapshotStil } = opslag;

let pg = null, pgKlaar = false, pgVuil = false, pgFlushBezig = false, pgFlushTimer = null, pgPoll = null, pgVeilig = null;
const pgLog = { warn: (m, v) => console.warn('[pg]', m, v || '') };

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

/* Start de Postgres-koppeling: schema klaarzetten, de gidsen en het tx-grootboek
   installeren, de gedeelde data ophalen (Postgres wint bij het opstarten), het
   RAM-venster uit het grootboek aanvullen, en daarna live meeluisteren op
   wijzigingen van andere instances (LISTEN/NOTIFY) met een poll als vangnet. */
async function startPostgres() {
  if (STORE !== 'postgres') return false;
  pg = require('../pg').maakPg({ merge3, kluis, log: pgLog, url: DATABASE_URL });
  await pg.schema();
  // de grootboeken (bulk-zaken + ledengids) en het transactie-grootboek
  await gidsen.init(pg.pool, pgLog);
  await tx.initLedger(pg.pool, pgLog);
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
    const ext = state.getExternCb(); if (ext) ext();
  } else if (db.writable) {
    await pg.flush(db.data, true); // lege database: onze seed/snapshot erin (alles, ook grote collecties)
  }
  // Venster-top-up uit het grootboek: items die al als rij in het grootboek staan
  // maar nog niet in de blob, komen hier terug in het venster.
  await tx.vensterTopUp(pgLog);
  pgKlaar = true;
  await pg.luister(() => { pg.haalNieuwer(db.data, state.getExternCb()).then(schrijfLokaleSnapshotStil).catch(() => {}); });
  pgPoll = setInterval(() => pg.haalNieuwer(db.data, state.getExternCb()).catch(() => {}), Number(process.env.RTG_POLL_MS || 2000));
  if (pgPoll.unref) pgPoll.unref();
  pgVeilig = setInterval(() => { if (pgVuil) flushNu(); }, 1000);
  if (pgVeilig.unref) pgVeilig.unref();
  if (pgVuil) planFlush();
  console.log('[db] PostgreSQL-opslag actief, rol:', db.writable ? 'schrijver' : 'lezer');
  return true;
}
// De pg-only laatste flush bij het afsluiten (de snapshot doet index erbovenop).
async function flushBijAfsluiten() {
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
// Pool-verzadiging (alleen in Postgres-modus) voor de health/ready-checks.
function pgPoolStatus() { return (pg && pg.poolStatus) ? pg.poolStatus() : null; }
function klaar() { return pgKlaar; }

module.exports = { planFlush, startPostgres, flushBijAfsluiten, pgPing, pgPoolStatus, klaar };
