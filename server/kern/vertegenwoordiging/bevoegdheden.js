/* ============================================================================
   WAT EEN VERTEGENWOORDIGER KAN MOGEN -- de gesloten lijst, met per stuk een
   grond.

   DE VORM KOMT UIT kern/bevoegdheid/lijst.js en is met opzet overgenomen: een
   lijst die een bestuurder of een jurist kan lezen zonder een regel code te
   begrijpen. Wijzigt hier iets, dan verandert wat een mens namens een ander mag
   -- dat is een besluit en geen implementatiedetail.

   WAAROM DE LIJST GESLOTEN IS. Een vrij tekstveld ("mag onderhandelen over
   sponsordeals") leest prettig en is niet af te dwingen: er staat geen enkele
   controle achter, en twee mensen lezen er twee dingen in. Wat er niet in deze
   lijst staat, bestaat niet als bevoegdheid -- dat is de enige manier waarop de
   cliënt kan WETEN wat hij weggeeft.

   KLAARZETTEN IS EEN EIGENSCHAP EN GEEN BELEEFDHEID. LIFE.md par. 4: alles wat
   een TWEEDE persoon bereikt (een uitnodiging, een bericht, een boeking, een
   betaling) wordt nooit automatisch. Een bevoegdheid met `klaarzetten: true`
   mag dus voorbereiden en nooit versturen of vastleggen; de cliënt drukt.
   Daarmee is "mag onderhandelen" hier iets anders dan "mag tekenen", en dat
   verschil is precies waar een carrière op stukloopt.

   EN DE NOOIT-LIJST IS DE HELFT DIE ERTOE DOET. Zij staat hier niet als
   waarschuwing maar als GEGEVEN, want ./simulatie.js toont hem aan de cliënt
   vóór hij aanvaardt. Een machtigingsscherm dat alleen zegt wat er opengaat, is
   de helft van het verhaal -- en het is de helft die niemand mist.
   ========================================================================== */
'use strict';

/* Elke bevoegdheid draagt:
     naam        wat de cliënt op zijn scherm leest
     grond       waarom deze bevoegdheid mag bestaan. Valt de grond weg, dan
                 hoort de bevoegdheid te wijzigen.
     klaarzetten mag dit alleen voorbereiden? (zie de kop)
     raakt       welk deel van het leven van de cliënt dit opent, in gewone taal */
const BEVOEGDHEDEN = Object.freeze({
  'aanbod.ontvangen': {
    naam: 'Aanbiedingen ontvangen',
    raakt: 'Voorstellen die aan u gericht zijn',
    klaarzetten: false,
    grond: 'Een vertegenwoordiger die niet mag horen wat er binnenkomt, kan niets doen. ' +
      'Ontvangen verandert niets aan uw kant en is daarmee de lichtste die er is.'
  },
  'aanbod.bespreken': {
    naam: 'Over een aanbod onderhandelen',
    raakt: 'Het gesprek over een voorstel, tot uw plafond',
    klaarzetten: true,
    grond: 'Onderhandelen is voorbereiden. Het eindigt bij een voorstel dat u leest; ' +
      'vastleggen is een andere handeling en die staat in NOOIT.'
  },
  'beschikbaarheid.delen': {
    naam: 'Uw beschikbaarheid delen',
    raakt: 'Wanneer u kunt, en niet wat u dan doet',
    klaarzetten: false,
    grond: 'Een venster delen is iets anders dan uw agenda openen. Wat er in dat venster ' +
      'staat, blijft van u.'
  },
  'agenda.voorbereiden': {
    naam: 'Afspraken klaarzetten in uw agenda',
    raakt: 'Voorstellen in uw agenda, die u bevestigt',
    klaarzetten: true,
    grond: 'Een afspraak raakt een tweede mens zodra hij vaststaat. Klaarzetten mag, ' +
      'bevestigen doet u (LIFE.md par. 4).'
  },
  'reis.voorbereiden': {
    naam: 'Reizen klaarzetten',
    raakt: 'Vluchten, verblijf en vervoer als voornemen',
    klaarzetten: true,
    grond: 'Het Travel OS kent een voornemen naast een boeking (REIZEN.md). Een ' +
      'vertegenwoordiger vult het voornemen; de boeking is geld en dus van u.'
  },
  'contract.lezen': {
    naam: 'Contracten lezen die aan u gericht zijn',
    raakt: 'Stukken die u zijn toegestuurd',
    klaarzetten: false,
    grond: 'Wie namens u onderhandelt zonder het stuk te mogen lezen, onderhandelt blind. ' +
      'Dit opent wat AAN u gericht is en niet uw dossier.'
  },
  'contract.opstellen': {
    naam: 'Een concept opstellen',
    raakt: 'Een conceptstuk in uw dossier',
    klaarzetten: true,
    grond: 'Een concept is een voorstel op papier. Het bindt niemand tot u tekent, ' +
      'en tekenen staat in NOOIT.'
  },
  'factuur.voorbereiden': {
    naam: 'Facturen klaarzetten',
    raakt: 'Uitgaande facturen als concept',
    klaarzetten: true,
    grond: 'Een factuur klaarzetten is administratie; hem versturen is een handeling ' +
      'richting een derde en blijft van u.'
  },
  'loopbaan.lezen': {
    naam: 'Uw loopbaanboek lezen',
    raakt: 'Wat u heeft gedaan en aantoonbaar heeft bereikt',
    klaarzetten: false,
    grond: 'Het loopbaanboek is wat u zelf naar buiten laat zien. Het bevat met opzet ' +
      'geen gezondheid en geen privé -- die staan in NOOIT en niet in een instelling.'
  }
});

/* WAT GEEN ENKELE MACHTIGING GEEFT. Niet omdat het gevaarlijk klinkt, maar
   omdat het besluit eronder ergens anders is genomen -- precies de vorm van
   NOOIT_AUTONOOM in kern/stuur/mandaat.js. Elk item zegt WAAR die grens woont,
   zodat wie hem wil verzetten weet bij wie hij moet zijn. */
const NOOIT = Object.freeze([
  { wat: 'Geld verplaatsen of een betaling doen',
    waar: 'GELD.md: geld verlaat het huis nooit vanzelf, en een machtiging verandert dat niet.' },
  { wat: 'Definitief tekenen namens u',
    waar: 'Een handtekening IS de instemming. Wie hem mag zetten, vertegenwoordigt u niet maar vervangt u.' },
  { wat: 'Uw bankrekening of betaalgegevens wijzigen',
    waar: 'De klassieke fraudestap, en de enige handeling waarmee een vertegenwoordiger de ' +
      'geldstroom naar zichzelf kan verleggen.' },
  { wat: 'Uw gezondheidsgegevens inzien',
    waar: 'CARRIERE.md grens: de betaler leest de gezondheid nooit; kern/zorgniveau.js trekt dezelfde lijn.' },
  { wat: 'Uw privéberichten lezen',
    waar: 'Een berichtenbak is geen dossier. Wat aan u persoonlijk is geschreven, blijft van u.' },
  { wat: 'Iemand anders namens u machtigen',
    waar: 'Geen delegatie. Een machtiging die zichzelf kan doorgeven, is geen machtiging maar een sleutel.' },
  { wat: 'Uw pas, account of toegang tot RTG wijzigen',
    waar: 'CLAUDE.md: toegang tot een pas is mensenwerk, en die mens bent u.' }
]);

/* De hoedanigheid zegt in welke ROL iemand naast u staat. Hij verandert niets
   aan wat mag -- dat doen de bevoegdheden -- en hij staat er omdat "wie is dit"
   en "wat mag hij" twee vragen zijn die een machtigingsscherm allebei hoort te
   beantwoorden. */
const HOEDANIGHEDEN = Object.freeze(['zaakwaarnemer', 'manager', 'boekhouder', 'advocaat',
  'coach', 'assistent', 'ouder']);

const SLEUTELS = Object.freeze(Object.keys(BEVOEGDHEDEN));
const bestaat = (k) => Object.prototype.hasOwnProperty.call(BEVOEGDHEDEN, String(k || ''));

module.exports = { BEVOEGDHEDEN, NOOIT, HOEDANIGHEDEN, SLEUTELS, bestaat };
