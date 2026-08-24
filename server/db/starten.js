/* DE OPSLAG OPSTARTEN: de werkkopie vullen en de kruisproces-sync aanzetten.

   Twee dingen die maar EEN keer per proces gebeuren, aan het begin: load() haalt
   de gegevens uit de gekozen opslag (of uit een backup, of uit de seed) en
   startSqliteSync() zet de sync en het transactie-grootboek aan.

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js stond op 23911 byte, ruim twee
   keer de grens uit keuringsregel 13. Dit is ook een naad in het onderwerp:
   alles wat in index.js overblijft draait TIJDENS de rit -- lezen, schrijven,
   een collectie bewerken. Wat hier staat is de rit beginnen, en dat is een keer.

   WAT ER BINNENKOMT. Alleen save(). Dat is met opzet: load() schrijft aan het
   eind van een herstel of een seed terug, en die schrijfactie hoort door
   hetzelfde ene punt te gaan als elke andere -- inclusief het verraad dat daar
   op zit (server/lib/verraad.js).
   ========================================================================== */
'use strict';
const fs = require('fs');
const state = require('./state');
const db = state.db;
const rtgjson = require('../lib/rtgjson');
const seed = require('../seed');
const kluis = require('../kluis');
const opslag = require('./opslag');
const sqlite = require('./sqlite');
const geheugen = require('./geheugen');
const postgres = require('./postgres');
const tx = require('./tx');
// DB_FILE per lezing (opslag.DB_FILE): een destructurering hier bevriest de map
// bij het laden. Zie de kop van server/db/snapshot.js.
const { STORE, laadUitBackup, leesLokaleSnapshot } = opslag;

const dbLog = { warn: (m) => console.warn('[db]', m) };

module.exports = ({ save }) => {
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
    } else if (fs.existsSync(opslag.DB_FILE)) {
      const ruw = fs.readFileSync(opslag.DB_FILE, 'utf8');
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
    /* Alleen de sqlite-stand start hier een grootboek (postgres doet dat in
       ./postgres). Of die stand er een DRAAGT, vraagt hij aan dezelfde functie die
       de productiekeuring gebruikt -- anders kan de keuring iets goedkeuren wat
       hier niet gebeurt, en dat is precies de vorm die je nooit ziet. */
    if (STORE !== 'sqlite' || !opslag.heeftGrootboek(process.env, STORE)) return;
    tx.initLedgerSqlite(opslag, dbLog)
      .then(() => tx.vensterTopUp(dbLog))
      .catch(e => console.warn('[db] tx-grootboek (sqlite) start mislukt:', e.message));
  }

  return { load, startSqliteSync };
};
