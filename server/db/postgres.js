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

/* De snelle rijstrook. De idempotentie-boeken van RTG Pay en RTG Bank hebben
   geen rij-voor-rij grootboek achter zich (anders dan orders en boekingen) en
   bestaan alleen als kv-blob. Wachten ze achter de grote blobs, dan is een
   herstart binnen dat venster een DUBBELE BOEKING voor wie het opnieuw probeert;
   op 100M leden gemeten liep dat op tot ~35 seconden. Ze krijgen daarom een
   eigen, korte flush die niet achter de grote schrijfronde aansluit. Eigen
   bezig-vlag, zodat de trage ronde deze niet blokkeert; de schrijfkant werkt per
   collectie met een advisory lock, dus twee flushes over verschillende sleutels
   zitten elkaar niet in de weg. Zie server/pg/sync.js (VOORRANG). */
let snelVuil = false, snelBezig = false, snelTimer = null;
function planSnel() {
  snelVuil = true;
  if (snelTimer || !pgKlaar) return;
  snelTimer = setTimeout(snelNu, Number(process.env.PG_SNEL_MS || 60));
  if (snelTimer.unref) snelTimer.unref();
}
let snelBelofte = null;
async function snelNu() {
  snelTimer = null;
  if (!pg || !pgKlaar || snelBezig || !db.writable || !snelVuil || !pg.flushVoorrang) return;
  snelVuil = false; snelBezig = true;
  snelBelofte = pg.flushVoorrang(db.data);
  try { await snelBelofte; }
  catch (e) { snelVuil = true; console.warn('[pg] voorrang-flush mislukt:', e.message); }
  finally { snelBezig = false; snelBelofte = null; if (snelVuil && pgKlaar) planSnel(); }
}
/* Wachtend op de rijstrook: voor geld dat pas "gelukt" mag zeggen als het er
   ECHT staat. De rijstrook zelf bestond al (planSnel, 60 ms), maar een timer
   is een venster, en de crashproef (kill -9 onder schrijflast) mat er
   tweeentwintig BEVESTIGDE overdrachten in die na de herstart weg waren. Wie
   hier wacht, weet dat de eigen mutatie in Postgres staat: een lopende flush
   die haar mogelijk miste wordt afgewacht, en zolang er vuil ligt draait er
   nog een ronde. In elke andere opslagstand is dit een no-op. */
async function flushVoorrangDirect() {
  if (STORE !== 'postgres' || !pg || !pgKlaar || !db.writable || !pg.flushVoorrang) return;
  while (snelBezig) await (snelBelofte || new Promise(r => setTimeout(r, 5)));
  if (snelVuil) {
    if (snelTimer) { clearTimeout(snelTimer); snelTimer = null; }
    await snelNu();
  }
}

function planFlush() {
  pgVuil = true;
  planSnel();               // de geld-sleutels gaan meteen, los van de grote ronde
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

/* DE REM ZAT MAAR OP EEN VAN DE TWEE PADEN, EN OP HET DRUKSTE NIET.

   Het commentaar hierboven belooft "ten hoogste eens per PG_SNAP_MS", en in
   flushNu stond die controle ook. Maar de LISTEN/NOTIFY-luisteraar hieronder
   deed `.then(schrijfLokaleSnapshotStil)` -- onvoorwaardelijk, bij elke
   melding, zonder enige rem. En meldingen komen per weggeschreven collectie
   per flush-ronde (elke 150 ms, voor de geld-sleutels elke 60), ook van je
   eigen instance: de luisteraar hangt aan een aparte verbinding en hoort dus
   zijn eigen NOTIFY's.

   Wat er dan gebeurt is precies wat het commentaar zegt te voorkomen: een
   volledige JSON.stringify van de HELE datastore, versleuteld, met een fsync
   op bestand en map -- synchroon, op de event-loop, meerdere keren per seconde
   in plaats van eens per vijf minuten. De p99 van elk verzoek hangt daaraan,
   inloggen en betalen inbegrepen.

   Dat het poll-vangnet een regel lager (pgPoll) hetzelfde leeswerk doet ZONDER
   snapshot, is het bewijs dat die .then de uitzondering was en niet het
   ontwerp.

   Nu een gedeelde poort: beide paden vragen hem, beide respecteren dezelfde
   teller. En alleen als er echt iets is toegepast -- haalNieuwer geeft het
   aantal rijen terug, en nul rijen is geen reden om de hele kast weg te
   schrijven. */
function snapshotAlsHetMag() {
  if (Date.now() - laatsteLokaleSnap < PG_SNAP_MS) return false;
  laatsteLokaleSnap = Date.now();
  schrijfLokaleSnapshotStil();
  return true;
}
async function flushNu() {
  pgFlushTimer = null;
  if (!pg || !pgKlaar || pgFlushBezig || !db.writable || !pgVuil) return;
  pgVuil = false; pgFlushBezig = true;
  try {
    await pg.flush(db.data);
    // grote collecties die door de flush-pacing zijn uitgesteld: vuil blijven,
    // zodat de her-geplande flush ze na de pauze alsnog wegschrijft
    if (pg.heeftUitgesteld && pg.heeftUitgesteld()) pgVuil = true;
    snapshotAlsHetMag();
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
  await pg.luister(() => {
    pg.haalNieuwer(db.data, state.getExternCb())
      .then(aantal => { if (aantal) snapshotAlsHetMag(); })   // gerembd, en alleen bij echte wijzigingen
      .catch(() => {});
  });
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
  /* EERST DE GELD-SLEUTELS. De gewone flush slaat de voorrang-sleutels over
     (die rijden hun eigen strook), dus zonder deze regel zou een afsluiting ze
     juist NIET wegschrijven -- precies de bug die deze strook moest oplossen.
     En ze gaan vooraan omdat een afsluit-flush op mega-schaal door het
     grace-venster kan worden afgekapt: wat als eerste weg is, is veilig. */
  try { if (pg.flushVoorrang) await pg.flushVoorrang(db.data); } catch (e) {}
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

module.exports = { planFlush, flushVoorrangDirect, startPostgres, flushBijAfsluiten, pgPing, pgPoolStatus, klaar };
