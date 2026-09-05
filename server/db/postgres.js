/* Opslag, deel "postgres": de write-behind koppeling met PostgreSQL. Deze module beheert de flush-pacing, de
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

let pg = null, pgKlaar = false, pgBasisKlaar = false, pgOpstart = false;
let pgVuil = false, pgFlushBezig = false, pgFlushTimer = null, pgPoll = null, pgVeilig = null;
const metOpslagSlot = require('./opslag-slot')();
const pgLog = { warn: (m, v) => console.warn('[pg]', m, v || '') };
const grafsteen = require('./grafsteen');
const verzoeken = require('./postgres-verzoeken')({
  store: STORE, db, state, motor: () => pg, slot: metOpslagSlot,
  topUp: () => tx.vensterTopUp(pgLog), extern: () => state.getExternCb(), basisKlaar: () => pgKlaar
});

/* Snelle geldstrook; selectie/reden staan bij VOORRANG in pg/sync.js. */
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
  snelBelofte = metOpslagSlot(() => pg.flushVoorrang(state.getRuweData()));
  try { await snelBelofte; }
  catch (e) { snelVuil = true; verzoeken.ongezond(e, 'voorrang-flush'); console.warn('[pg] voorrang-flush mislukt:', e.message); }
  finally { snelBezig = false; snelBelofte = null; if (snelVuil && pgKlaar) planSnel(); }
}
/* Wacht tot de voorrangsstrook leeg is; buiten PostgreSQL een no-op. */
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
/* save() buiten een request (timer/achtergrondtaak) krijgt geen vals antwoord:
   de verkeerspoort sluit meteen en deze mutatie landt via herstel atomair. Vóór
   de PG-start blijft de bestaande startflush gelden. */
function planSave() { if (!verzoeken.achtergrondSave()) planFlush(); }

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
    await metOpslagSlot(() => pg.flush(state.getRuweData()));
    // grote collecties die door de flush-pacing zijn uitgesteld: vuil blijven,
    // zodat de her-geplande flush ze na de pauze alsnog wegschrijft
    if (pg.heeftUitgesteld && pg.heeftUitgesteld()) pgVuil = true;
    snapshotAlsHetMag();
  }
  catch (e) { pgVuil = true; verzoeken.ongezond(e, 'flush'); console.warn('[pg] flush mislukt:', e.message); }
  finally { pgFlushBezig = false; if (pgVuil && pgKlaar) planFlush(); }
}

/* Start de Postgres-koppeling: schema klaarzetten, de gidsen en het tx-grootboek
   installeren, de gedeelde data ophalen (Postgres wint bij het opstarten), het
   RAM-venster uit het grootboek aanvullen, en daarna live meeluisteren op
   wijzigingen van andere instances (LISTEN/NOTIFY) met een poll als vangnet. */
async function startPostgres(voorGereed) {
  if (STORE !== 'postgres') return false;
  pgKlaar = false; pgBasisKlaar = false; pgOpstart = true;
  const opstartPg = require('../pg').maakPg({ merge3, kluis, log: pgLog, url: DATABASE_URL,
    onFout: (e, bron) => verzoeken.ongezond(e, bron) });
  pg = opstartPg;
  try {
    await pg.schema();
    await gidsen.init(pg.pool, pgLog);
    await tx.initLedger(pg.pool, pgLog);
    const pgData = await pg.laadAlles();
    if (pgData) {
      /* Postgres wint; seeded defaults vullen alleen nog ontbrekende collecties
         op een verse database aan terwijl een tweede schrijver aan het vullen is. */
      state.setRuweData(grafsteen.samenvoegen(state.getRuweData(), pgData, pgLog).dbData);
      if (state.getRuweData().__schema == null) state.getRuweData().__schema = 1;
      schrijfLokaleSnapshotStil();
      const ext = state.getExternCb(); if (ext) ext();
    } else if (db.writable) await pg.flush(state.getRuweData(), true);
    await tx.vensterTopUp(pgLog);
    pgBasisKlaar = true;
    /* Migraties schrijven transactioneel; verkeer en timers blijven nog dicht. */
    if (typeof voorGereed === 'function') await voorGereed();
    await pg.luister(() => {
      metOpslagSlot(() => pg.haalNieuwer(state.getRuweData(), state.getExternCb()))
        .then(aantal => { if (aantal) snapshotAlsHetMag(); })
        .catch(e => verzoeken.ongezond(e, 'listen-sync'));
    });
    pgKlaar = true; pgOpstart = false; verzoeken.gestart();
    pgPoll = setInterval(() => metOpslagSlot(() => pg.haalNieuwer(state.getRuweData(), state.getExternCb()))
      .catch(e => verzoeken.ongezond(e, 'poll')), Number(process.env.RTG_POLL_MS || 2000));
    if (pgPoll.unref) pgPoll.unref();
    pgVeilig = setInterval(() => { if (pgVuil) flushNu(); }, 1000);
    if (pgVeilig.unref) pgVeilig.unref();
    if (pgVuil) planFlush();
    console.log('[db] PostgreSQL-opslag actief, rol:', db.writable ? 'schrijver' : 'lezer');
    return true;
  } catch (e) {
    pgKlaar = false; pgBasisKlaar = false; pgOpstart = false;
    if (pg === opstartPg) pg = null;
    try { await opstartPg.sluit(); } catch (x) {}
    throw e;
  }
}
// De pg-only laatste flush bij het afsluiten (de snapshot doet index erbovenop).
async function flushBijAfsluiten() {
  if (STORE !== 'postgres' || !pg || !db.writable) return;
  /* EERST DE GELD-SLEUTELS. De gewone flush slaat de voorrang-sleutels over
     (die rijden hun eigen strook), dus zonder deze regel zou een afsluiting ze
     juist NIET wegschrijven -- precies de bug die deze strook moest oplossen.
     En ze gaan vooraan omdat een afsluit-flush op mega-schaal door het
     grace-venster kan worden afgekapt: wat als eerste weg is, is veilig. */
  try { if (pg.flushVoorrang) await metOpslagSlot(() => pg.flushVoorrang(state.getRuweData())); } catch (e) {}
  try { await metOpslagSlot(() => pg.flush(state.getRuweData(), true)); } catch (e) {} // force: ook de door pacing uitgestelde grote collecties
}

// Ping de database voor de gezondheidscheck; geeft de antwoordtijd in ms.
async function pgPing() {
  if (STORE !== 'postgres' || !pg) throw new Error('PostgreSQL is niet actief.');
  const t = Date.now();
  try { await pg.pool.query('SELECT 1'); }
  catch (e) { verzoeken.ongezond(e, 'ping'); throw e; }
  return Date.now() - t;
}
// Pool-verzadiging (alleen in Postgres-modus) voor de health/ready-checks.
function pgPoolStatus() { return (pg && pg.poolStatus) ? pg.poolStatus() : null; }
function klaar() { return pgKlaar && verzoeken.klaar(); }
const { bewerkCollectiePostgres, economischeBoekingPostgres } = require('./postgres-poorten')({
  store: STORE, db, motor: () => pg,
  klaar: () => pgBasisKlaar && (pgOpstart || (pgKlaar && verzoeken.klaar())), slot: metOpslagSlot,
  onFout: verzoeken.ongezond
});

module.exports = { planFlush, planSave, flushVoorrangDirect, bewerkCollectiePostgres, economischeBoekingPostgres,
  startPostgres, flushBijAfsluiten, pgPing, pgPoolStatus, klaar,
  verzoekMiddleware: verzoeken.middleware, schrijfStand: verzoeken.stand, herstelNu: verzoeken.herstelNu };
