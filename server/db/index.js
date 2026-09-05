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
const verraad = require('../lib/verraad');
const effectmeter = require('../effectmeter');
const state = require('./state');
const db = state.db;
/* De werkvormen hangen aan db: db.capsVan(zaak) zegt wat een zaak mag
   gebruiken, afgeleid uit wat zij is en wat zij doet (een zzp'er die
   ritten rijdt krijgt de vervoerstools en de zzp-tools). Hier aangehaakt
   zodat elke ingang (server, trio, noodserver, tests) hem heeft. */
require('../kern/werkvormen').haakAan(db);
const { merge3 } = require('./merge');
const opslag = require('./opslag');
const snapshot = require('./snapshot');
const sqlite = require('./sqlite');
const geheugen = require('./geheugen');
const postgres = require('./postgres');
const verzoekcontext = require('./verzoekcontext');
const gidsen = require('./gidsen');
const tx = require('./tx');
const redis = require('./redis');
const { STORE } = opslag;

/* DE VIER DEELBESTANDEN. Dit bestand stond op 23911 byte, ruim twee keer de
   grens uit keuringsregel 13, en is langs vier naden geknipt: ./starten.js (de
   opslag opstarten), ./bijeen.js (een commit voor wat bij elkaar hoort),
   ./duurzaam.js (wegschrijven dat een crash overleeft) en ./afsluiten.js (netjes
   stoppen). Elk zegt in zijn eigen kop waarom hij daar staat; hier staat alleen
   de volgorde, want die is gedrag: duurzaam heeft save nodig, bijeen heeft save
   EN saveDuurzaam. Alle drie krijgen ze save MEE en maken hem niet na -- een
   tweede schrijfweg is er een die het verraad niet kent. */
const { saveDuurzaam, CONTROL_DUURZAAM, persistentieStand } = require('./duurzaam')({ save });
const { bijeen, inBundel, bundelDoos } = require('./bijeen')({ save, saveDuurzaam });
const economischeBoekingEenmaal = require('./economische-boeking')({
  db, store: STORE, postgres, sqlite, bijeen, save
});
const { load, startSqliteSync } = require('./starten')({ save });
const { flushBijAfsluiten, opslagKlaar } = require('./afsluiten');
const { planSnapshot } = snapshot;

function save() {
  if (!db.writable) return;
  /* DE VERRAADSMOTOR, op het ene punt waar alle schrijfacties doorheen gaan.

     Zonder RTG_VERRAAD staat hier niets aan en kost het niets (twee
     kaartopzoekingen op een Map die leeg is). Met `schrijf-verloren` keert deze
     functie NORMAAL terug zonder iets te bewaren: de aanroeper krijgt zijn 200
     en gelooft dat het vaststaat. Met `schrijf-faalt` gooit hij, zoals een
     schijf die ruimte meldt en de schrijfactie alsnog laat mislukken -- een
     aanroeper die dat stil wegvangt, meldt succes over niets.

     Waarom hier en niet in een wikkel eromheen: een tweede opstartpad dat
     alleen bij een proef wordt gebruikt, is een pad dat niemand draait. Zie
     server/lib/verraad.js. */
  /* EERST DE BUNDEL-BOEKHOUDING, DAN PAS HET VERRAAD, en die volgorde is met
     een rode toets geleerd. Andersom keert save() onder `schrijf-verloren`
     terug VOORDAT hij de bundel markeert als "moet nog flushen" -- en dan
     draait de duurzame commit aan het eind van bijeen() helemaal niet. Het
     verraad zette daarmee niet de opslag maar de MEETOPSTELLING uit, en dat is
     de ergste vorm: alles blijft groen omdat er niets meer gebeurt.

     Binnen een bundel hoort save() sowieso alleen een vlag te zetten; de echte
     schrijfactie gebeurt aan het eind, buiten deze context, en daar slaat het
     verraad gewoon toe. */
  /* DE EFFECTMETER (../effectmeter.js), boven de bundelcheck en het verraad.
     Eronder was fout: een save binnen bijeen() keert hier af met alleen een vlag
     en schrijft daarna via saveDuurzaam(), die save() niet in elke tak aanroept
     -- de kop meldde `geen` op een verzoek dat een heel account aanmaakte. Hij
     telt dus de POGING; een bundel van drie plus zijn commit telt vier. Bewust:
     de vraag is niet "hoeveel" maar "iets of niets", en die mag geen tak missen. */
  effectmeter.tel('opslag');
  const doos = bundelDoos();
  if (doos && doos.open) { doos.nodig = true; return; } // binnen bijeen: aan het eind, in een commit
  if (verraad.sla('schrijf-faalt')) throw new Error('[verraad] de schrijfactie mislukte (schrijf-faalt)');
  if (verraad.sla('schrijf-verloren')) return;
  if (STORE === 'postgres') {
    /* Een HTTP-request werkt in PostgreSQL-modus op een geisoleerde
       copy-on-write weergave. save() markeert daar alleen dat de responsepoort
       vóór het antwoord één autoritatieve multi-collectiecommit moet doen. */
    if (verzoekcontext.noteerSave()) return;
    // Postgres is de duurzame waarheid (write-behind via planFlush). De lokale
    // snapshot is enkel een warme cache en wordt binnen flushNu gethrotteld
    // geschreven; hem hier óók plannen zou de event-loop dubbel belasten.
    postgres.planSave();
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

const bewerkCollectie = require('./collectie-bewerken')({
  store: STORE, postgres, sqlite, db, save
});

// De tx-veegronde vraagt na een venster-verhuis een snapshot: injecteer save().
tx.wire(save);

// De kern zet hier een functie neer die na een externe wijziging draait.
function onExternalChange(cb) { state.setExternCb(cb); }

module.exports = {
  db, load, save, saveDuurzaam, bijeen, inBundel, bewerkCollectie, economischeBoekingEenmaal, persistentieStand, CONTROL: CONTROL_DUURZAAM, DATA_DIR: opslag.DATA_DIR, STORE, startGedeeld: redis.startGedeeld, startSqliteSync,
  startPostgres: postgres.startPostgres, flushBijAfsluiten, pgPing: postgres.pgPing,
  opslagKlaar, pgPoolStatus: postgres.pgPoolStatus, postgresSchrijfStand: postgres.schrijfStand,
  postgresVerzoekMiddleware: postgres.verzoekMiddleware, onExternalChange, merge3, schrijfDuurzaam: opslag.schrijfDuurzaam,
  grootSupplierSync: gidsen.grootSupplierSync, grootAantal: gidsen.grootAantal,
  ledenGidsActief: gidsen.ledenGidsActief, ledenGidsHaal: gidsen.ledenGidsHaal, ledenGidsAantal: gidsen.ledenGidsAantal,
  ledenGidsZet: gidsen.ledenGidsZet, ledenGidsExact: gidsen.ledenGidsExact, ledenGidsZoek: gidsen.ledenGidsZoek,
  ledenGidsHaalWacht: gidsen.ledenGidsHaalWacht,
  /* ledenGidsWeg stond hier NIET, terwijl ledengids.js hem exporteert, gidsen.js
     hem doorreikt en server.js hem uit deze module haalt. Hij was dus undefined,
     en in kern/gids.js sloeg `if (ledenGidsWeg)` daar stilzwijgend op over --
     inclusief de `return` erachter, zodat OOK het lokale pad werd overgeslagen.
     Uitkomst: in Postgres-modus haalde het recht op vergetelheid (AVG art. 17)
     het lid nergens uit de gids, terwijl het commentaar boven gidsWeg letterlijk
     belooft dat het allebei de opslagvormen dekt. Een ontbrekende regel in een
     exportlijst, en niets dat erover klaagde. */
  ledenGidsWeg: gidsen.ledenGidsWeg,
  orderMetRef: tx.orderMetRef, ordersVanKlant: tx.ordersVanKlant, ordersVanZaak: tx.ordersVanZaak, ordersVoegToe: tx.ordersVoegToe,
  boekingMetRef: tx.boekingMetRef, boekingenVanKlant: tx.boekingenVanKlant, boekingenVanZaak: tx.boekingenVanZaak, boekingenVoegToe: tx.boekingenVoegToe,
  directBetalingMetRef: tx.directBetalingMetRef, directBetalingenVanKlant: tx.directBetalingenVanKlant,
  directBetalingenVanZaak: tx.directBetalingenVanZaak, directBetalingenVoegToe: tx.directBetalingenVoegToe,
  betaalVerzoekMetRef: tx.betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam: tx.betaalVerzoekenVoorCodenaam,
  betaalVerzoekenVanZaak: tx.betaalVerzoekenVanZaak, betaalVerzoekenVoegToe: tx.betaalVerzoekenVoegToe,
  payBoekingMetId: tx.payBoekingMetId, payBoekingenVoegToe: tx.payBoekingenVoegToe,
  txStaartNa: tx.txStaartNa, txVerwijder: tx.txVerwijder,
  txLedgerActief: tx.txLedgerActief, txLedgerVanKlant: tx.txLedgerVanKlant, txLedgerVanZaak: tx.txLedgerVanZaak,
  txLedgerTel: tx.txLedgerTel, txLedgerAantal: tx.txLedgerAantal, txVeegNu: tx.txVeegNu,
  checkpointGrootboek: tx.checkpointGrootboek,
  // de WAL in het hoofdbestand vouwen voor de backup kopieert
  checkpointSqlite: sqlite.checkpointSqlite
};
