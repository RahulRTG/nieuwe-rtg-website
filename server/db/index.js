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
const verraad = require('../lib/verraad');
const rtgjson = require('../lib/rtgjson');
const seed = require('../seed');
const kluis = require('../kluis'); // versleuteling-at-rest (met RTG_ENC_KEY)
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

/* EEN COMMIT VOOR WAT BIJ ELKAAR HOORT (bijeen). Gevonden met kill -9 onder
   schrijflast: in de sqlite-stand flusht save() synchroon, en een overdracht
   flusht TWEE keer -- eerst het geld (pasToe), dan pas de idem-sleutel
   (metIdem). Een crash daartussen plus de retry waar idem-sleutels voor
   bestaan, boekte echt dubbel (137 centen). bijeen(fn) stelt de saves uit de
   EIGEN async-context uit (AsyncLocalStorage) en flusht aan het eind een
   keer. Context-gebonden is de veiligheid zelf: wacht fn op echte I/O, dan
   flushen andere verzoeken gewoon meteen (hun 200 blijft waar), en zelf
   hebben we voor de laatste await nog niets gemuteerd -- er bestaat dus geen
   halve toestand die een omstander kan vastleggen. */
const { AsyncLocalStorage } = require('async_hooks');
const bijeenContext = new AsyncLocalStorage();
/* `opties.duurzaam` maakt van de gebundelde commit een DUURZAME: hij gaat via
   saveDuurzaam() en keert pas terug als de opslag heeft bevestigd.

   WAAROM DIT HIER HOORT EN NIET IN DE ROUTE. De bundel is precies wat duurzaam
   moet zijn: boeking en idem-sleutel samen. Zou de route na afloop nog een
   losse saveDuurzaam() doen, dan bestaat er alsnog een moment waarop de een
   vaststaat en de ander niet -- de toestand waar de dubbele boeking van 137
   centen uit voortkwam. Eén bundel, één duurzame commit.

   Alleen de geldcommit zet hem aan; check.js regel 47 bewaakt dat
   saveDuurzaam() niet elders opduikt, en hier is de aanroep bewust de enige
   plek waar een aanroeper er indirect bij kan. */
async function bijeen(fn, opties) {
  const duurzaam = !!(opties && opties.duurzaam);
  const doos = { open: true, nodig: false, duurzaam };
  try { return await bijeenContext.run(doos, fn); }
  finally {
    /* Dicht voordat er geflusht wordt: een timer die binnen fn is gezet erft
       deze context, en zijn latere save() moet ECHT flushen in plaats van een
       vlag zetten waar niemand meer naar kijkt. */
    doos.open = false;
    if (doos.nodig) {
      if (duurzaam) {
        const uit = saveDuurzaam();
        /* DE BUNDEL FAALT ALS HIJ NIET BEVESTIGD KON WORDEN, en alleen daar waar
           bevestigen mogelijk is. Zonder dit gooien meldt saveDuurzaam netjes
           dat het misging en gaat de route toch met 200 verder -- precies de
           valse bevestiging waar deze hele ronde over ging. En met een
           onvoorwaardelijk gooien zou een opslag die niet kan tellen elke
           transactie laten mislukken; dat brak eerder vier geldtoetsen. */
        if (uit.bevestigbaar && !uit.duurzaam) {
          throw new Error('[duurzaam] de commit is niet vastgelegd: ' + uit.reden);
        }
      } else save();
      /* Postgres is write-behind: zonder dit wachten zegt de route "gelukt"
         terwijl het geld nog in een 60ms-timer hangt -- de crashproef mat daar
         echt verlies in. Elders (sqlite synchroon; json/geheugen bewust
         write-behind en in productie geblokkeerd) is dit een no-op. */
      await postgres.flushVoorrangDirect();
    }
  }
}

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
  const doos = bijeenContext.getStore();
  if (doos && doos.open) { doos.nodig = true; return; } // binnen bijeen: aan het eind, in een commit
  if (verraad.sla('schrijf-faalt')) throw new Error('[verraad] de schrijfactie mislukte (schrijf-faalt)');
  if (verraad.sla('schrijf-verloren')) return;
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
  /* Alleen de sqlite-stand start hier een grootboek (postgres doet dat in
     ./postgres). Of die stand er een DRAAGT, vraagt hij aan dezelfde functie die
     de productiekeuring gebruikt -- anders kan de keuring iets goedkeuren wat
     hier niet gebeurt, en dat is precies de vorm die je nooit ziet. */
  if (STORE !== 'sqlite' || !opslag.heeftGrootboek(process.env, STORE)) return;
  tx.initLedgerSqlite(opslag, dbLog)
    .then(() => tx.vensterTopUp(dbLog))
    .catch(e => console.warn('[db] tx-grootboek (sqlite) start mislukt:', e.message));
}

// Laatste flush bij het afsluiten, zodat niets in de write-behind blijft hangen.
/* ============================================================================
   saveDuurzaam() -- BEWUST ZWAAR, EN BEWUST SCHAARS.

   WAAROM DIT GEEN "VEILIGE SAVE" IS. De gewone save() is write-behind: hij
   plant een schrijfactie en keert meteen terug. Dat is voor vrijwel alles het
   juiste gedrag. Deze variant slaat dat plannen over en schrijft SYNCHROON,
   met een fsync eronder, en keert pas terug als de opslag het heeft bevestigd.

   Dat kost latentie, en dat is precies waarom hij niet mag rondslingeren.
   Zodra iemand hem leest als "de veilige save", staat hij binnen een half jaar
   onder een profielwijziging en een like -- en dan is het prestatieprofiel van
   het hele platform veranderd zonder dat er ooit een beslissing over is
   genomen. Dat is geen hypothetisch risico; zo ontspoort elke goedbedoelde
   primitive.

   DAAROM EEN LIJST MET AANROEPPLEKKEN, en niet een afspraak. Dezelfde vorm als
   PUBLIEK in de poortwacht en MAG in de klokschuld: elke regel noemt zijn
   reden, en een aanroep die er niet op staat is een HARDE fout in
   `npm run check` -- geen waarschuwing. Zie GELDLAT.md voor het contract
   waarvoor hij bestaat.

   WAT HIJ TERUGGEEFT, en waarom dat geen boolean is. `{ duurzaam, stand }`:
   `duurzaam` is alleen true als de opslag het ook echt kon BEVESTIGEN. Op een
   opslagsoort zonder teller is dat niet vast te stellen, en dan staat er false
   met stand null -- niet stilzwijgend true. Een aanroeper die dat verschil
   negeert, bouwt precies de valse bevestiging waar dit voor is gemaakt.

   WIE ERAAN HANGT. De geldcommit (kern/pay via lib/idem) en het werk van een lid
   (kern/notities via lib/duurzaam), allebei via de duurzame bundel hieronder en
   allebei met een reden op de lijst van check.js regel 47. De reikwijdte staat in
   GELDLAT.md; wat er nog niet aan hangt -- agenda, bestanden, berichten -- staat
   daar ook, en de prestatiemeting van stap 6 is nog open.
   ========================================================================== */
function saveDuurzaam() {
  if (!db.writable) return { duurzaam: false, stand: null, reden: 'de opslag staat niet open' };

  /* HET VERRAAD GELDT OOK HIER, en dat ontbrak in de eerste versie.

     Deze functie riep sqlite.saveSqlite() rechtstreeks aan en liep daarmee om
     het injectiepunt in save() heen. Uitkomst: onder `schrijf-verloren` meldde
     hij vrolijk `duurzaam: true`. Een duurzame schrijfactie die NIET te
     saboteren is, is precies de weg waarlangs de geldketen straks "bewezen"
     zou heten zonder ooit onder een liegende opslag te zijn gehouden. De eigen
     toets viel erover voordat er iets op aangesloten was. */
  if (verraad.sla('schrijf-faalt')) throw new Error('[verraad] de duurzame schrijfactie mislukte (schrijf-faalt)');
  if (verraad.sla('schrijf-verloren')) {
    const stand = persistentieStand();
    return { duurzaam: false, bevestigbaar: stand !== null, stand,
      reden: 'de opslag bevestigde de schrijfactie niet' };
  }

  const voor = persistentieStand();
  if (STORE === 'sqlite') {
    /* force: sla de goedkope voorcheck over, die kan een gelijk gebleven
       collectiegrootte overslaan. Daarna de WAL dichtvouwen, zodat de
       wijziging niet alleen in het journaal staat. */
    sqlite.saveSqlite(true);
    sqlite.checkpointSqlite();
  } else if (STORE === 'json') {
    schrijfSnapshotNu();               // schrijft via schrijfDuurzaam(): fsync + rename
  } else {
    save();                            // postgres/geheugen: geen synchrone weg hier
  }
  const na = persistentieStand();
  /* `bevestigbaar` en `duurzaam` zijn twee verschillende dingen, en dat verschil
     is het hele verschil. Bevestigbaar: deze opslag KAN het aantonen. Duurzaam:
     hij heeft het ook aangetoond. Een opslag die niet kan tellen mag geen
     transactie laten mislukken -- dat brak eerder vier geldtoetsen -- maar mag
     evenmin doorgaan voor bewijs. */
  const bevestigbaar = voor !== null && na !== null;
  const bevestigd = bevestigbaar && na > voor;

  /* STERF-NA-COMMIT. Het gemeenste moment dat er bestaat, en het is hier
     eenduidig aan te wijzen: de schrijfactie is duurzaam, de aanroeper heeft
     nog niets gehoord.

     De klant weet dus niet dat zijn opdracht is gelukt en probeert het opnieuw.
     Herkent RTG die herhaling niet, dan is lost-write opgelost en double-write
     gebouwd -- zie GELDLAT.md. Dit verraad maakt dat scenario stelbaar; het
     beantwoordt het niet.

     SIGKILL en geen process.exit: een nette afsluiting laat afsluithaken lopen
     en bewijst daarmee iets over een pad dat bij een echte crash niet bestaat. */
  if (bevestigd && verraad.sla('sterf-na-commit')) {
    try { process.kill(process.pid, 'SIGKILL'); } catch (e) { process.abort(); }
  }
  return { duurzaam: bevestigd, bevestigbaar, stand: na,
    reden: bevestigd ? null
      : (!bevestigbaar ? 'deze opslag kan duurzaamheid niet bevestigen'
        : 'de persistentiestand liep niet op') };
}

/* De control voor TOEZICHT.md. `bewijssoorten` staat er met opzet in: één woord
   PROVEN zou de handmatige stap onzichtbaar maken tussen automatisch bewezen
   controls, en dan leest een lezer meer zekerheid dan er is. */
const CONTROL_DUURZAAM = {
  control: 'GELD-DURABILITY',
  wat: 'er bestaat een schrijfactie die duurzaamheid BEVESTIGT voordat er iets wordt beloofd',
  eigenaar: 'Techniek',
  bewijs: ['test/saveduurzaam.test.js', 'test/persistentiestand.test.js'],
  bewijsstuk: 'db.saveDuurzaam() geeft { duurzaam, stand, reden } -- geen boolean',
  grens: 'scenario 1, 2 en 3 zijn bewezen: de gewone weg werkt, een mislukte duurzame write ' +
    'geeft geen succesresponse, en een crash na de commit levert bij de retry exact een boeking. ' +
    'Wat ONTBREEKT is de prestatiemeting (p95/p99, event-loop, voor en na) -- stap 6 van ' +
    'GELDLAT.md. Een duurzaamheidsgarantie die de latentie verdubbelt is een productbeslissing.',
  bewijssoorten: {
    primitive: 'PROVEN',
    'onder sabotage': 'PROVEN',
    poortbewijs: 'HANDMATIG GEREPRODUCEERD',
    'geldcommit aangesloten': 'PROVEN',
    'scenario 3 (crash + retry)': 'PROVEN',
    'prestatie p95/p99': 'ONGEMETEN'
  },
  dekking: { register: 'KETENS.json', beproefd: 'gemeten.geldProven',
    totaal: 'gemeten.geldScenarios', eenheid: 'geldscenario\'s met alle drie bewezen' }
};

/* De persistentiestand: een getal dat OPLOOPT zodra er werkelijk is
   weggeschreven. Alleen de SQLite-opslag houdt zo'n teller bij; bij de andere
   opslagsoorten geven we null terug, en dat betekent NIET VAST TE STELLEN. Een
   aanroeper die dat als "in orde" leest, bouwt precies de valse bevestiging waar
   deze functie tegen bestaat. */
function persistentieStand() {
  if (STORE !== 'sqlite') return null;
  return sqlite.persistentieStandSqlite();
}

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
  db, load, save, saveDuurzaam, bijeen, persistentieStand, CONTROL: CONTROL_DUURZAAM, DATA_DIR: opslag.DATA_DIR, STORE, startGedeeld: redis.startGedeeld, startSqliteSync,
  startPostgres: postgres.startPostgres, flushBijAfsluiten, pgPing: postgres.pgPing,
  opslagKlaar, pgPoolStatus: postgres.pgPoolStatus, onExternalChange, merge3, schrijfDuurzaam: opslag.schrijfDuurzaam,
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
  txStaartNa: tx.txStaartNa, txVerwijder: tx.txVerwijder,
  txLedgerActief: tx.txLedgerActief, txLedgerVanKlant: tx.txLedgerVanKlant, txLedgerVanZaak: tx.txLedgerVanZaak,
  txLedgerTel: tx.txLedgerTel, txLedgerAantal: tx.txLedgerAantal, txVeegNu: tx.txVeegNu,
  checkpointGrootboek: tx.checkpointGrootboek,
  // de WAL in het hoofdbestand vouwen voor de backup kopieert
  checkpointSqlite: sqlite.checkpointSqlite
};
