/* DUURZAAM WEGSCHRIJVEN: de schrijfactie die een crash overleeft, en het bewijs
   dat hij dat doet.

   Drie dingen die bij elkaar horen: saveDuurzaam() zelf, de persistentiestand
   waarmee je kunt ZIEN dat er werkelijk is geschreven (saveDuurzaam leest hem
   voor en na), en de control die TOEZICHT.md eruit haalt.

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js stond op 23911 byte, ruim twee
   keer de grens uit keuringsregel 13. Dit is de grootste aaneengesloten naad die
   er zit, en het is er ook een in het onderwerp: index.js gaat over de werkkopie
   en de gewone, write-behind save(). Hier staat wat er gebeurt als "later" niet
   goed genoeg is.

   DE LIJST MET AANROEPPLEKKEN BLIJFT WAAR HIJ IS. saveDuurzaam mag maar op een
   handvol plekken worden aangeroepen en scripts/check.js regel 47 bewaakt dat.
   Die regel kijkt naar de AANROEPERS, niet naar de plek van de definitie, dus
   verhuizen verandert daar niets aan -- en dat is ook de bedoeling: de schaarste
   is het punt, niet het adres.

   WAT ER BINNENKOMT. Alleen save(). Alles wat hieronder wordt aangeraakt (de
   opslagsoorten, het verraad) zijn modules die dit bestand zelf ophaalt; save()
   niet, want die staat in index.js en is daar het ENE punt waar elke
   schrijfactie doorheen gaat.
   ========================================================================== */
'use strict';
const state = require('./state');
const db = state.db;
const verraad = require('../lib/verraad');
const opslag = require('./opslag');
const snapshot = require('./snapshot');
const sqlite = require('./sqlite');
const geheugen = require('./geheugen');
const postgres = require('./postgres');
const { STORE } = opslag;
const { schrijfSnapshotNu } = snapshot;

module.exports = ({ save }) => {
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
    let alGelijk = false;
    if (STORE === 'sqlite') {
      /* force: sla de goedkope voorcheck over, die kan een gelijk gebleven
         collectiegrootte overslaan. Daarna de WAL dichtvouwen, zodat de
         wijziging niet alleen in het journaal staat. */
      const uit = sqlite.saveSqlite(true);
      alGelijk = !!(uit && uit.alGelijk);
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
    /* `alGelijk` is de derde stand naast opgelopen en blijven staan: de opslag
       had niets te schrijven omdat wat in het geheugen staat er al stond. Dat
       IS duurzaam -- geheugen en schijf zijn gelijk -- maar het laat de teller
       staan en las daardoor als verlies. Een weigering die eerst iets vastzette
       en het weer losliet, kwam zo als 500 terug in plaats van als haar eigen
       402. Alleen de opslag zelf mag dit zeggen; afleiden uit een gelijke
       teller zou echt verlies meedekken. */
    const bevestigd = bevestigbaar && (na > voor || alGelijk);

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

  return { saveDuurzaam, CONTROL_DUURZAAM, persistentieStand };
};
