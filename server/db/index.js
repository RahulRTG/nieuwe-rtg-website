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
   3-weg samenvoeging), ./opslag (bestandslaag), ./snapshot (het write-behind
   volledige-snapshot-schrijven), ./sqlite en ./postgres (de motoren), ./gidsen
   (grootboek van zaken + ledengids) en ./tx (transactie-index + grootboek).
   Hier de load/save-orchestratie, het aanzetten van de opslag en het samenstellen
   van de publieke API. */
const fs = require('fs');
const rtgjson = require('../lib/rtgjson');
const seed = require('../seed');
const kluis = require('../kluis'); // versleuteling-at-rest (met RTG_ENC_KEY)
const state = require('./state');
const db = state.db;
const { merge3 } = require('./merge');
const opslag = require('./opslag');
const snapshot = require('./snapshot');
const sqlite = require('./sqlite');
const geheugen = require('./geheugen');
const postgres = require('./postgres');
const gidsen = require('./gidsen');
const tx = require('./tx');
const redis = require('./redis');
const { DB_FILE, STORE, laadUitBackup, leesLokaleSnapshot } = opslag;
const { schrijfSnapshotNu, planSnapshot, snapshotVuil } = snapshot;

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
  } else if (STORE === 'geheugen') {
    // De volledig in-memory runtime-engine: versleutelde, incrementele brokken.
    db.data = geheugen.laadGeheugen();
    if (!db.data) {
      // migratiepad: een bestaande db.json neemt zijn data mee de GEHEUGEN-opslag in
      const oud = leesLokaleSnapshot();
      if (oud) console.log('[db] bestaande db.json overgenomen in de GEHEUGEN-opslag.');
      db.data = oud || seed();
      save();
    }
  } else if (fs.existsSync(DB_FILE)) {
    const ruw = fs.readFileSync(DB_FILE, 'utf8');
    let tekst;
    try { tekst = kluis.ontsleutel(ruw); }
    catch (e) { throw new Error('db.json kan niet ontsleuteld worden; klopt RTG_ENC_KEY? (' + e.message + ')'); }
    try {
      db.data = rtgjson.parse(tekst, { maxDiepte: 512 });
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
  } else if (STORE === 'geheugen') {
    // GEHEUGEN: versleutelde, incrementele brok-per-collectie-opslag (write-behind).
    geheugen.saveGeheugen();
  } else {
    planSnapshot();
  }
}
// De tx-veegronde vraagt na een venster-verhuis een snapshot: injecteer save().
tx.wire(save);

// De kern zet hier een functie neer die na een externe wijziging draait.
function onExternalChange(cb) { state.setExternCb(cb); }

/* Start de SQLite-opslag: de kruisproces-sync EN het transactie-grootboek.
   Dat grootboek bestond al, maar alleen voor Postgres -- juist de standaardopslag
   hield daardoor de laatste O(alles)-serialisatie: `orders` is een enkele rij en
   werd bij elke nieuwe order in zijn geheel opnieuw geserialiseerd en
   weggeschreven (gemeten 460 KB na 1050 orders, lineair groeiend). Met het
   grootboek houdt het RAM een venster van de recentste items en staat de rest als
   geindexeerde rij in grootboek.db.
   Uit te zetten met TX_LEDGER_SQLITE=0; dan werkt alles als voorheen. */
const dbLog = { warn: (m) => console.warn('[db]', m) };
function startSqliteSync() {
  sqlite.startSqliteSync();
  if (STORE !== 'sqlite' || process.env.TX_LEDGER_SQLITE === '0') return;
  tx.initLedgerSqlite(opslag, dbLog)
    .then(() => tx.vensterTopUp(dbLog))
    .catch(e => console.warn('[db] tx-grootboek (sqlite) start mislukt:', e.message));
}

// Laatste flush bij het afsluiten, zodat niets in de write-behind blijft hangen.
async function flushBijAfsluiten() {
  if (db.writable && snapshotVuil()) { try { schrijfSnapshotNu(); } catch (e) {} }
  geheugen.flushGeheugen();   // no-op buiten de geheugen-modus
  // SQLite commit elke save al synchroon, maar de goedkope voorcheck kan een
  // GROTE collectie met een gelijk aantal items even hebben overgeslagen. Bij
  // het afsluiten kijkt afrondSqlite() daarom alles na en vouwt daarna de WAL
  // dicht, zodat een nette stop nooit een wijziging-op-zijn-plaats achterlaat.
  if (db.writable && STORE === 'sqlite') { try { sqlite.afrondSqlite(); } catch (e) {} }
  try { tx.afrondLedger(); } catch (e) {}   // WAL van grootboek.db dichtvouwen
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
  db, load, save, DATA_DIR: opslag.DATA_DIR, STORE, startGedeeld: redis.startGedeeld, startSqliteSync,
  startPostgres: postgres.startPostgres, flushBijAfsluiten, pgPing: postgres.pgPing,
  opslagKlaar, pgPoolStatus: postgres.pgPoolStatus, onExternalChange, merge3, schrijfDuurzaam: opslag.schrijfDuurzaam,
  grootSupplierSync: gidsen.grootSupplierSync, grootAantal: gidsen.grootAantal,
  ledenGidsActief: gidsen.ledenGidsActief, ledenGidsHaal: gidsen.ledenGidsHaal, ledenGidsAantal: gidsen.ledenGidsAantal,
  ledenGidsZet: gidsen.ledenGidsZet, ledenGidsExact: gidsen.ledenGidsExact, ledenGidsZoek: gidsen.ledenGidsZoek,
  orderMetRef: tx.orderMetRef, ordersVanKlant: tx.ordersVanKlant, ordersVanZaak: tx.ordersVanZaak, ordersVoegToe: tx.ordersVoegToe,
  boekingMetRef: tx.boekingMetRef, boekingenVanKlant: tx.boekingenVanKlant, boekingenVanZaak: tx.boekingenVanZaak, boekingenVoegToe: tx.boekingenVoegToe,
  txStaartNa: tx.txStaartNa, txVerwijder: tx.txVerwijder,
  txLedgerActief: tx.txLedgerActief, txLedgerVanKlant: tx.txLedgerVanKlant, txLedgerVanZaak: tx.txLedgerVanZaak,
  txLedgerTel: tx.txLedgerTel, txLedgerAantal: tx.txLedgerAantal, txVeegNu: tx.txVeegNu
};
