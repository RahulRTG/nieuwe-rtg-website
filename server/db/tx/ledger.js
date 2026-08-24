/* Transactie-grootboek (tx_ledger). Orders en boekingen staan als GEINDEXEERDE
   RIJEN buiten het procesgeheugen (soort+ref als sleutel, klant/zaak/at
   geindexeerd). Het werkgeheugen houdt alleen een VENSTER van de recentste items
   (TX_RAM_*); alles daarbuiten leeft in het grootboek en is via de gepagineerde
   lezers bereikbaar. Zo blijft de kv-blob klein (goedkope flush) en verdwijnt de
   laatste O(alles)-serialisatie.

   Deze module kent de opslag niet: hij bouwt rijen en vraagt bladzijden op bij een
   ACHTERKANT (./pgachter of ./sqliteachter). Daardoor werkt dezelfde veeg- en
   vensterlogica in de Postgres-stand en in de SQLite-stand -- die laatste is de
   standaardopslag, en daar hield een groeiende `orders` tot nu toe de laatste
   O(alles)-serialisatie in stand.

   Verlies-vrij per constructie: de veegronde schrijft de staart EERST (upsert,
   idempotent) naar het grootboek en haalt hem pas daarna uit het RAM. Nieuwe
   items gaan bij aanmaak direct (best-effort) mee; statuswissels van recente
   items neemt de veegronde mee via de hete kop. Zonder achterkant is dit inert.
   Afgesplitst uit tx/index.js; het RAM-venster (txStaartNa/txVerwijder) en save()
   komen via wire() binnen. */
const state = require('../state');
const db = state.db;

// welke collecties er zijn en hoe ze eruitzien: ./collecties (een plek)
const { COLLECTIES, NAMEN, TX_SOORT, sleutelVan } = require('./collecties');
/* Hoe een item een grootboekrij wordt (en terug): ./rij. Daar staat ook waarom
   het tijdstip genormaliseerd wordt -- zonder dat komt payBoekingen in
   Postgres-stand nergens, en zonder enige melding. */
const { txDedup, tijdstipVan, rijVan, lees } = require('./rij');

// het RAM-venster + de snapshot-trigger komen uit tx/index (injectie voorkomt
// een circulaire require: index gebruikt onze zet(), wij gebruiken hun venster)
let venster = { txStaartNa: () => [], txVerwijder: () => {}, save: () => {} };
function wire(v) { venster = Object.assign(venster, v); }

let achter = null;
const TX_VEEG_MS = Number(process.env.TX_VEEG_MS || 30000);
const TX_KAP = Number(process.env.TX_KAP || 20000);      // max staart-items per veegronde (tegen event-loop-stalls)
const TX_KOP = Number(process.env.TX_KOP || 500);        // hete kop die elke ronde opnieuw meegaat (statuswissels)
const txBekend = Object.fromEntries(NAMEN.map(n => [n, new Set()])); // refs waarvan we weten dat ze in het grootboek staan
let txVeegTimer = null, txVeegBezig = false;
function txLedgerActief() { return !!achter; }
// de WAL van het grootboek platslaan voor een backup; zonder achterkant inert
function checkpointGrootboek() { try { return !!(achter && achter.checkpoint && achter.checkpoint()); } catch (e) { return false; } }

async function txLedgerZet(naam, t) {
  if (!achter || !t || sleutelVan(naam, t) == null) return;
  try {
    await achter.upsert([rijVan(naam, t)]);
    txBekend[naam].add(sleutelVan(naam, t));
  } catch (e) { /* eventueel-consistent: de veegronde (backfill/kop) probeert het opnieuw */ }
}
async function txLedgerBulk(naam, items) {
  if (!achter) return false;
  const schoonItems = txDedup(naam, items);
  if (!schoonItems.length) return true;
  await achter.upsert(schoonItems.map(t => rijVan(naam, t)));
  for (const t of schoonItems) txBekend[naam].add(sleutelVan(naam, t));
  return true;
}
// Gepagineerde lezers: geindexeerd op (soort, klant/zaak, at), nooit een scan.
async function txLedgerVanKlant(naam, klant, limit, offset) {
  if (!achter) return [];
  try { return lees(await achter.vanSleutel(TX_SOORT[naam], 'klant', klant, Math.min(200, limit || 25), Math.max(0, offset || 0))); }
  catch (e) { return []; }
}
async function txLedgerVanZaak(naam, zaak, limit, offset) {
  if (!achter) return [];
  try { return lees(await achter.vanSleutel(TX_SOORT[naam], 'zaak', zaak, Math.min(200, limit || 25), Math.max(0, offset || 0))); }
  catch (e) { return []; }
}
async function txLedgerTel(naam, klant) {
  if (!achter) return 0;
  try { return await achter.tel(TX_SOORT[naam], klant != null ? klant : null); }
  catch (e) { return 0; }
}
// Synchrone, gecachete totalen (zelfde patroon als ledenGidsAantal): de
// KPI-lezers blijven synchroon en krijgen een teller die hooguit ~10 s achterloopt.
const txN = Object.fromEntries(NAMEN.map(n => [n, 0]));
let txNAt = 0;
function txLedgerAantal(naam) {
  if (achter && Date.now() - txNAt > 10000) {
    txNAt = Date.now();
    (async () => { try { for (const n of NAMEN) txN[n] = await txLedgerTel(n); } catch (e) {} })();
  }
  return txN[naam] || 0;
}
/* De veegronde: (1) backfill wat het grootboek nog niet kent (na een boot met
   een bestaande kv), (2) de hete kop opnieuw (statuswissels), (3) de staart
   voorbij het venster veilig wegschrijven en dan pas uit het RAM halen.
   Gepaced (TX_KAP per ronde) zodat een grote achterstand nooit de event-loop
   blokkeert maar in rustige stappen wegloopt. */
async function txVeegNu() {
  if (!achter || txVeegBezig || !db.writable) return;
  txVeegBezig = true;
  try {
    for (const naam of NAMEN) {
      const arr = db.data[naam] || [];
      const onbekend = arr.filter(t => t && sleutelVan(naam, t) != null && !txBekend[naam].has(sleutelVan(naam, t))).slice(0, TX_KAP);
      if (onbekend.length) await txLedgerBulk(naam, onbekend);
      if (arr.length) await txLedgerBulk(naam, arr.slice(0, TX_KOP));
      if (arr.length > COLLECTIES[naam].ramMax) {
        const staart = venster.txStaartNa(naam, COLLECTIES[naam].ramMax).slice(-TX_KAP).filter(t => t && sleutelVan(naam, t) != null);
        if (staart.length) {
          await txLedgerBulk(naam, staart);   // eerst duurzaam in het grootboek...
          venster.txVerwijder(naam, staart);  // ...dan pas uit het venster
          venster.save();
          console.log('[tx] ' + staart.length + ' ' + naam + ' voorbij het venster naar het grootboek verhuisd; ' + (db.data[naam] || []).length + ' in het RAM.');
        }
      }
    }
  } catch (e) { console.warn('[tx] veegronde mislukt:', e.message); }
  finally { txVeegBezig = false; }
}

/* Installeer een achterkant: schema klaarzetten, hem bewaren en de veegronde
   starten. Mislukt het schema, dan blijft het grootboek inert en werkt alles als
   voorheen -- de kv-blob is dan de waarheid. */
async function start(nieuw, log) {
  const warn = m => { if (log && log.warn) log.warn(m); };
  try {
    await nieuw.schema();
    achter = nieuw;
    txVeegTimer = setInterval(() => { txVeegNu().catch(() => {}); }, TX_VEEG_MS);
    if (txVeegTimer.unref) txVeegTimer.unref();
    const eersteVeeg = setTimeout(() => { txVeegNu().catch(() => {}); }, 3000);
    if (eersteVeeg.unref) eersteVeeg.unref();
  } catch (e) { achter = null; warn('[db] tx-grootboek (' + nieuw.naam + ') init mislukt: ' + e.message); }
}
// Aangeroepen door de Postgres-start (met de pool) en door de SQLite-start.
const initLedger = (pool, log) => start(require('./pgachter')(pool), log);
const initLedgerSqlite = (opslag, log) => start(require('./sqliteachter')(opslag), log);
// Netjes afronden bij het afsluiten (alleen de SQLite-achterkant heeft werk).
function afrondLedger() { if (achter && achter.afronden) achter.afronden(); }

/* De omgekeerde beweging van de veegronde hierboven: bij het OPSTARTEN het
   venster aanvullen met wat al als rij in het grootboek staat maar niet meer in
   de blob. Staat in ./topup.js, met de reden erbij waarom het geen enkele
   bladzijde van vijfhonderd meer is. De achterkant gaat als FUNCTIE mee: hij
   wordt pas gezet als het grootboek start. */
const vensterTopUp = require('./topup')({
  db, achter: () => achter, COLLECTIES, NAMEN, TX_SOORT, sleutelVan, lees
});
module.exports = { checkpointGrootboek,
  /* Welke collecties een rij-voor-rij grootboek achter zich hebben. Dit is de
     ENIGE plek waar dat staat; de opslaglaag leidt er zijn afsluit-volgorde uit
     af (server/pg/sync.js). Zou die er een eigen lijstje van maken, dan lopen
     de twee vroeg of laat uit elkaar -- en dat is precies hoe de uitstelregel
     ooit collecties is gaan dekken die er nooit in stonden. */
  TX_SOORT, COLLECTIES,
  tijdstipVan,   // doorgegeven uit ./rij om hem te kunnen toetsen
  wire, actief: txLedgerActief, zet: txLedgerZet,
  txLedgerActief, txLedgerVanKlant, txLedgerVanZaak, txLedgerTel, txLedgerAantal, txVeegNu,
  initLedger, initLedgerSqlite, afrondLedger, vensterTopUp
};
