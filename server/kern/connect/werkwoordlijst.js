/* ============================================================================
   DE ACHT WERKWOORDEN VAN DE LUS -- de lijst zelf, en waarom hij een LIJST is.

   Foundation Connect belooft dat vrijwel iedere functie in dezelfde lus
   terechtkomt: ontdek -> begrijp -> doe -> maak -> deel -> verbind -> help ->
   groei -> ontdek. De verleiding is daar een INTERFACE van te maken: een
   `Ontdekking` met acht verplichte methodes, waar elk domein zich naar voegt.

   DAT IS GEMETEN EN HET MAG NIET. CONNECTLUS.json, over 23 ontdekkingsdomeinen:

     0 van 8 werkwoorden staan in ALLE domeinen -- ook `maak` niet (21/23).
     2 van 23 domeinen maken de lus rond, en dat zijn precies de twee grootste
       (kern/spellen 92 bestanden, kern/rtfos 64). Ze halen de acht door hun
       OMVANG, niet door hun vorm -- dezelfde hub-vertekening waar
       MACHINEDEKKING.json een keer op is gezakt.
     22 verschillende combinaties over 23 domeinen. Vrijwel elk domein heeft
       zijn eigen stel.
     En de vorm eronder: 0 van 496 velden staan in alle domeinen, 0 in zelfs
       maar de helft, 87,9% in precies EEN domein. Platformbreed is dat 71%
       (OBJECTMODEL.json), dus de ontdekkingsdomeinen zijn MINDER verwant dan
       een willekeurige doorsnede van dit huis.

   Een protocol dat niemand volledig invult, is geen protocol maar een wens.
   Wat overleeft is de vorm die COMMERCE.md voor `Koopbaar` koos: een
   VERKLARING VAN WERKWOORDEN. Een bron zegt welke werkwoorden hij aanbiedt,
   deze lijst zegt wat elk werkwoord betekent en wat het NIET is, en ./lus.js
   rekent de afhankelijkheden erbij. Er komt geen basisklasse en geen tabel.

   HET GETAL DAT HET PRODUCT STUURT staat onderaan die meting: `begrijp` is het
   ZELDZAAMSTE werkwoord (5 van 23 domeinen). De stap waar de lus op draait --
   iemand drukt "waarom?" en krijgt uitleg op zijn niveau -- is precies de stap
   die dit huis vandaag bijna nergens heeft. Deze laag bouwt dus geen tweede
   feed; hij vult de naad die gemeten is.

   ============================ DRIE EIGENSCHAPPEN PER WERKWOORD ==============

   `grond`      waarom dit werkwoord bestaat. Geen sfeer: een zin waar een
                bouwer een besluit op kan nemen.
   `nietDit`    wat het NIET is. Dit veld is de helft van de waarde van de
                lijst -- `deel` dat stilletjes `verbind` gaat betekenen, is hoe
                een ontdeklaag in een sociaal netwerk verandert zonder dat
                iemand dat heeft besloten.
   `vereist`    welk werkwoord er structureel onder ligt. Geen volgorde van de
                REIS (die is een cyclus en dus geen graaf) maar van de
                MOGELIJKHEID: je kunt niets uitleggen wat niet getoond is.

   EN EEN VIERDE DIE ZWAARDER WEEGT DAN DE ANDERE DRIE:

   `raaktEenAnder`  bereikt dit werkwoord een TWEEDE MENS? Bij `deel`, `verbind`
                en `help` is dat zo, en dan geldt het werkwoord van LIFE.md
                onverkort: samenstellen en klaarzetten mag, bevestigen doet de
                mens. Deze vlag is geen documentatie -- ./lus.js geeft hem door
                en de routes mogen zo'n werkwoord nooit zelfstandig uitvoeren.
                Zonder die vlag is het verschil tussen "Rahul stelt voor dat je
                Sara vraagt" en "Rahul vraagt Sara" een kwestie van wie er
                toevallig de route schreef.

   WAT ER BEWUST NIET IN DE LIJST STAAT, en dat is `NIET_GEBOUWD` onderaan: een
   bron die `beoordeel`, `rangschik` of `beloon` aanmeldt, hoort te HOREN dat
   dat woord hier niet bestaat -- niet een lijst waar het stil is uitgevallen
   (LAT-regel 5). Die drie ontbreken niet per ongeluk; ze botsen met de grens
   dat de meeteenheid nooit de mens is.
   ========================================================================== */
'use strict';

const WERKWOORDEN = [
  { id: 'ontdek', naam: 'Ontdekken', vereist: [], raaktEenAnder: false,
    grond: 'Er is iets te zien dat deze mens nog niet kende. Dit is het enige werkwoord dat zonder de andere zeven bestaat, en daarom het enige dat nergens een voorwaarde heeft.',
    nietDit: 'Geen oneindige stroom. Een ontdekking heeft een einde, en het einde van een sessie is hier een geldige uitkomst (zie ./mixer.js).' },

  { id: 'begrijp', naam: 'Begrijpen', vereist: ['ontdek'], raaktEenAnder: false,
    grond: 'Hetzelfde onderwerp, uitgelegd op het niveau van wie het vraagt -- eenvoudiger, dieper, in een andere taal, of als vraag terug. CONNECTLUS.json meet dit als het zeldzaamste werkwoord van het huis (5/23); het is wat deze laag toevoegt.',
    nietDit: 'Geen tweede bron van waarheid. Uitleg verandert de VORM van wat er staat en nooit de bewering; wie de bewering betwist, gebruikt `klopt dit` en dat is een ander gereedschap.' },

  { id: 'doe', naam: 'Doen', vereist: ['ontdek'], raaktEenAnder: false,
    grond: 'Van kijken naar proberen: een proef, een opdracht, een spel, een vraag vooraf. Dit werkwoord is de reden dat de laag geen feed is.',
    nietDit: 'Geen huiswerk en geen verplichting. Een opdracht die niet af komt, laat niets achter dat tegen iemand werkt.' },

  { id: 'maak', naam: 'Maken', vereist: [], raaktEenAnder: false,
    grond: 'Iemand legt zelf iets vast -- een uitleg, een foto, een proefverslag. Hangt met opzet NIET aan `ontdek`: een vakmens die zijn werk laat zien, heeft hier niets voor hoeven kijken.',
    nietDit: 'Niet publiceren. Wat gemaakt is, staat in de kring `alleenIk` tot de maker iets anders kiest (./kring.js).' },

  { id: 'deel', naam: 'Delen', vereist: ['maak'], raaktEenAnder: true,
    grond: 'De maker zet zijn werk open voor een bepaalde kring. Vereist `maak`, want er is niets te delen dat niet bestaat.',
    nietDit: 'Geen bereik kopen en geen bereik beloven. Delen zegt WIE het mag zien; of iemand het ziet, beslist ./mixer.js en die kent de maker niet.' },

  { id: 'verbind', naam: 'Verbinden', vereist: [], raaktEenAnder: true,
    grond: 'Twee mensen die elkaar aanvullen, worden aan elkaar VOORGESTELD. Gedeelde nieuwsgierigheid is de ingang, en nooit leeftijd, afkomst of inkomen.',
    nietDit: 'Geen match-cijfer en geen rangorde van mensen. Een voorstel draagt de reden ("jullie werkten allebei aan dit"), niet een percentage.' },

  { id: 'help', naam: 'Helpen', vereist: ['verbind'], raaktEenAnder: true,
    grond: 'Iemand beantwoordt de vraag van een ander, leest iets na, geeft feedback. Vijf minuten mag; het hoeft geen mentorschap te zijn.',
    nietDit: 'Geen hulpverlening. Waar een vraag om een professional vraagt, wijst deze laag de weg en geeft zij de inhoud niet (kern/zorgniveau.js).' },

  { id: 'groei', naam: 'Groeien', vereist: [], raaktEenAnder: false,
    grond: 'Wat iemand heeft gedaan blijft staan, chronologisch en per regel aantoonbaar (./leerdossier.js). Hangt aan GEEN enkel werkwoord, want groei ontstaat uit alle zeven en uit geen ervan in het bijzonder.',
    nietDit: 'Geen niveau, geen score, geen ranglijst -- ook niet intern als sorteersleutel. De meeteenheid is de gebeurtenis en nooit de mens.' }
];

/* De namen die een bron WEL aanmeldt maar die hier niet bestaan, met de reden.
   Ze staan er niet omdat ze nog moeten worden gebouwd, maar omdat ze botsen. */
const NIET_GEBOUWD = {
  beoordeel: 'Dit werkwoord bestaat hier niet. Een oordeel over een mens is geen stap in de lus; wat iemand heeft gedaan is een feit, waar hij "staat" is een oordeel (LIFE.md par. 4).',
  rangschik: 'Dit werkwoord bestaat hier niet. Er komt geen ranglijst van mensen en geen sorteersleutel op een mens -- ook niet intern (HDI.md, ONTMOETEN.md, INT-04).',
  beloon:    'Dit werkwoord bestaat hier niet. Punten, niveaus en streaks zijn precies de engagement-patronen die CLAUDE.md verbiedt; wat er wel is, staat in ./leerdossier.js.',
  voorspel:  'Dit werkwoord bestaat hier niet. Deze laag zegt niet wat iemand kan worden; zij opent en determineert niet (FOUNDATION.md par. 5).',
  meet:      'Dit werkwoord bestaat hier niet onder deze naam -- `groei` legt vast wat er is gebeurd. Meten veronderstelt een meetlat, en die zou op de mens liggen.'
};

module.exports = { WERKWOORDEN, NIET_GEBOUWD };
