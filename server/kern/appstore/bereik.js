/* ============================================================================
   HET BEREIK VAN EEN APP -- hoe ver hij komt, AFGELEID en nooit ingevuld.

   WAAROM DIT BESTAND BESTAAT. Een keurmerk is de duurste vorm van LAT-regel 6:
   een lid dat "ZERO REACH" leest, gedraagt zich ernaar. Als dat woord ergens
   wordt GEZET -- door een uitgever, door een kantoor, door een veld in het
   manifest -- dan is het een bewering, en een bewering die zich afgedwongen
   noemt zonder toets komt er in dit huis niet door (COMMERCIE.md, claims.poort).
   Daarom wordt het hier GEREKEND uit de machtigingen die er werkelijk zijn, en
   is er geen manier om het te zetten.

   DE FOUT DIE HIERMEE WORDT VOORKOMEN, EN DIE BIJNA IS GEMAAKT: "Zero Reach"
   als vlag PER APP. Netwerk is in dit kanaal geen eigenschap van een app maar
   van de UITVOERING -- connect-src 'none' staat op de celroute en geldt voor
   alle apps tegelijk (./dossier-grenzen.js, WAT_HET_NOOIT_KRIJGT). Een badge
   die op de ene app wel en op de andere niet staat, zegt dus iets wat niet waar
   is: hij suggereert dat er apps zijn die het internet WEL kunnen bereiken. Wat
   per app verschilt is niet het netwerk maar het aantal BRUGGEN, en dat is dan
   ook wat hier wordt geklasseerd. Het kanaalfeit staat er apart bij, met de
   plek waar het wordt afgedwongen.

   VIER KLASSEN, EN ZE LOPEN VAN GEEN NAAR MEEST. De volgorde is die van
   ./machtigingen.js: opslag blijft binnen de app, profiel haalt iets van het
   lid op, en het bakje is de enige die BUITEN de app iets achterlaat waar het
   lid later tegenaan loopt. Dat is ook de enige met risico 'midden'.

   WAT DEZE KLASSE NIET IS: een oordeel over kwaliteit. Een app met drie bruggen
   is niet slechter dan een zonder; hij doet iets anders. Er komt hier dus geen
   cijfer, geen score en geen ranglijst (CLAUDE.md, en ./etalage.js zegt het al
   voor de winkel als geheel).
   ========================================================================== */
'use strict';

const { machtiging } = require('./machtigingen');

/* De klassen. `sleutel` is wat de code gebruikt, `label` wat een lid leest, en
   `betekent` de zin die eronder hoort te staan -- niet in een scherm getypt,
   want dan staat er over een half jaar op twee plekken iets anders. */
const KLASSEN = [
  { sleutel: 'zonder-bereik', rang: 0, label: 'Zonder bereik',
    betekent: 'Deze app vraagt niets van u en bewaart niets bij RTG. Wat u erin doet, blijft in het scherm.' },
  { sleutel: 'eigen-potje', rang: 1, label: 'Eigen potje',
    betekent: 'Deze app bewaart alleen haar eigen instellingen en voortgang, in een potje dat alleen zij kan lezen.' },
  { sleutel: 'met-identiteit', rang: 2, label: 'Kent uw codenaam',
    betekent: 'Deze app leest uw codenaam, uw taal en uw pas. Uw echte naam kan er niet uit komen.' },
  { sleutel: 'met-bakje', rang: 3, label: 'Kan een bericht klaarzetten',
    betekent: 'Deze app kan een bericht voor u neerleggen in de App Store. Zij kan u niet onderbreken: geen push, geen e-mail, geen sms.' }
];

const OP_SLEUTEL = new Map(KLASSEN.map(k => [k.sleutel, k]));

/* Welke machtiging tot welke klasse leidt. Dit is met opzet een MAP en geen
   reeks if-jes: een machtiging erbij die hier niet in staat, valt door de bodem
   naar de zwaarste klasse in plaats van stilzwijgend als 'geen bereik' te
   tellen. Een onbekende bevoegdheid die als de veiligste wordt geteld, is
   precies het gat waar zo'n classificatie doorheen lekt. */
const KLASSE_VAN_MACHTIGING = {
  'opslag.eigen': 'eigen-potje',
  'profiel.basis': 'met-identiteit',
  'bericht.klaarzetten': 'met-bakje'
};
const ZWAARSTE = KLASSEN[KLASSEN.length - 1].sleutel;

/* WAT VOOR ELKE APP GELDT, met de plek waar het wordt afgedwongen. Dit hoort
   niet bij de klasse maar ernaast: het verandert niet mee met wat een app
   vraagt, en het is juist daarom het sterkste wat er over dit kanaal te zeggen
   valt. De bron staat erbij zodat een lezer het kan nakijken in plaats van
   aannemen; de bewijsregels zelf staan in ./dossier-grenzen.js en worden hier
   niet overgetypt. */
const KANAALFEITEN = [
  { feit: 'geen netwerk', waarde: '0 bestemmingen',
    hoe: "de CSP van de celroute zet connect-src op 'none'", bron: 'server/routes/appstore/cel.js' },
  { feit: 'geen sensoren', waarde: 'camera en microfoon onmogelijk',
    hoe: 'het kader draagt een leeg allow', bron: 'public/apps/appcel.html' },
  { feit: 'geen andere app', waarde: 'eigen potje per app per lid',
    hoe: 'de brug leest alleen onder de sleutel van de aanroepende app', bron: 'server/kern/appstore/brug.js' }
];

/* De klasse van een stel machtigingen. Geeft altijd een klasse terug -- een lege
   lijst is 'zonder-bereik' en dat is een uitkomst en geen ontbrekende waarde. */
function klasseVan(ids) {
  let hoogste = KLASSEN[0];
  for (const id of (Array.isArray(ids) ? ids : [])) {
    const s = Object.prototype.hasOwnProperty.call(KLASSE_VAN_MACHTIGING, String(id))
      ? KLASSE_VAN_MACHTIGING[String(id)] : ZWAARSTE;
    const k = OP_SLEUTEL.get(s);
    if (k && k.rang > hoogste.rang) hoogste = k;
  }
  return hoogste;
}

/* Wat een scherm toont. `bruggen` is het GETAL dat naast de klasse hoort: de
   klasse zegt hoe ver het reikt, het getal hoeveel er openstaan -- twee apps met
   dezelfde klasse hoeven niet evenveel te vragen.

   `machtigingen` mag hier zowel wat een manifest VRAAGT als wat een lid heeft
   VERLEEND zijn; het is dezelfde rekensom over twee verschillende vragen, en de
   aanroeper zegt met de veldnaam welke van de twee hij toont. Die twee door
   elkaar halen is grens 4 van APPSTORE.md, dus dit bestand kiest er nooit zelf
   een. */
function bereik(ids) {
  const lijst = (Array.isArray(ids) ? ids : []).filter(id => !!machtiging(id));
  const k = klasseVan(lijst);
  return { klasse: k.sleutel, label: k.label, betekent: k.betekent, rang: k.rang,
    bruggen: lijst.length, kanaal: KANAALFEITEN };
}

module.exports = { bereik, klasseVan, KLASSEN, KANAALFEITEN, KLASSE_VAN_MACHTIGING };
