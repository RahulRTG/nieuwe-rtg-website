/* Datastore-laag voor de RTG-backend: de werkkopie in het geheugen (db.data) met
   drie inwisselbare opslagmotoren en een gedeelde-data-laag.

   - json     : één db.json-bestand (write-behind snapshot, optioneel Redis-mirror);
   - sqlite   : elke collectie een rij in store.db, kruisproces-sync via versies;
   - postgres : write-behind cache met Postgres als gedeelde, duurzame waarheid.

   De opslagkeuze (STORE) volgt uit de omgeving: Postgres bij een DATABASE_URL,
   anders een bestaande db.json (json) of een verse SQLite-installatie. De rest
   van de app praat alleen met db.data en de helpers hieronder; welke motor er
   onder draait merkt ze niet.

   Deze module is opgesplitst: ./state (de gedeelde levende staat), ./merge (de
   3-weg samenvoeging), ./opslag (bestandslaag + snapshot), ./sqlite en ./postgres
   (de motoren), ./gidsen (grootboek van zaken + ledengids) en ./tx (transactie-
   index + grootboek). Hier de load/save-orchestratie, de write-behind snapshot,
   de Redis-mirror en het samenstellen van de publieke API. */
const fs = require('fs');
const seed = require('../seed');
const kluis = require('../kluis'); // versleuteling-at-rest (met RTG_ENC_KEY)
const state = require('./state');
const db = state.db;
const { merge3 } = require('./merge');
const opslag = require('./opslag');
const sqlite = require('./sqlite');
const postgres = require('./postgres');
const gidsen = require('./gidsen');
const tx = require('./tx');
const redis = require('./redis');
const { DATA_DIR, DB_FILE, STORE,
  besloten, beslotenMap, schrijfDuurzaam, laadUitBackup, leesLokaleSnapshot } = opslag;

function load() {
  if (STORE === 'postgres') {
    // Warme cache / fallback; de echte gedeelde data komt via startPostgres().
    db.data = leesLokaleSnapshot() || seed();
  } else if (STORE === 'sqlite') {
    db.data = sqlite.loadSqlite();
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
    if (STORE !== 'postgres') redis.spiegelNaarRedis(); // alleen de JSON-opslag deelt via Redis
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
    postgres.planFlush();
  } else if (STORE === 'sqlite') {
    // SQLite: kruisproces-sync via versienummers en de poll (geen Redis-mirror).
    sqlite.saveSqlite();
  } else {
    planSnapshot();
  }
}
// De tx-veegronde vraagt na een venster-verhuis een snapshot: injecteer save().
tx.wire(save);

// De kern zet hier een functie neer die na een externe wijziging draait.
function onExternalChange(cb) { state.setExternCb(cb); }

// Laatste flush bij het afsluiten, zodat niets in de write-behind blijft hangen.
async function flushBijAfsluiten() {
  if (db.writable && saveVuil) { try { schrijfSnapshotNu(); } catch (e) {} }
  await postgres.flushBijAfsluiten();
}

// Is de duurzame opslag echt klaar om verkeer te dragen? json/sqlite laden
// synchroon bij de start; Postgres is pas klaar als de gedeelde data geladen is
// EN het RAM-venster (orders/boekingen) uit het grootboek is bijgewerkt (klaar()).
// De load balancer gebruikt dit (via /api/ready) om een koud-opstartende of nog
// warmdraaiende instance over te slaan i.p.v. er verkeer op te zetten.
function opslagKlaar() {
  if (!db.data || typeof db.data !== 'object') return false;
  if (STORE === 'postgres') return postgres.klaar();
  return true;
}

module.exports = {
  db, load, save, DATA_DIR, STORE, startGedeeld: redis.startGedeeld, startSqliteSync: sqlite.startSqliteSync,
  startPostgres: postgres.startPostgres, flushBijAfsluiten, pgPing: postgres.pgPing,
  opslagKlaar, pgPoolStatus: postgres.pgPoolStatus, onExternalChange, merge3, schrijfDuurzaam,
  grootSupplierSync: gidsen.grootSupplierSync, grootAantal: gidsen.grootAantal,
  ledenGidsActief: gidsen.ledenGidsActief, ledenGidsHaal: gidsen.ledenGidsHaal, ledenGidsAantal: gidsen.ledenGidsAantal,
  ledenGidsZet: gidsen.ledenGidsZet, ledenGidsKeyVanCodenaam: gidsen.ledenGidsKeyVanCodenaam, ledenGidsZoek: gidsen.ledenGidsZoek,
  orderMetRef: tx.orderMetRef, ordersVanKlant: tx.ordersVanKlant, ordersVanZaak: tx.ordersVanZaak, ordersVoegToe: tx.ordersVoegToe,
  boekingMetRef: tx.boekingMetRef, boekingenVanKlant: tx.boekingenVanKlant, boekingenVanZaak: tx.boekingenVanZaak, boekingenVoegToe: tx.boekingenVoegToe,
  txStaartNa: tx.txStaartNa, txVerwijder: tx.txVerwijder,
  txLedgerActief: tx.txLedgerActief, txLedgerVanKlant: tx.txLedgerVanKlant, txLedgerVanZaak: tx.txLedgerVanZaak,
  txLedgerTel: tx.txLedgerTel, txLedgerAantal: tx.txLedgerAantal, txVeegNu: tx.txVeegNu
};
