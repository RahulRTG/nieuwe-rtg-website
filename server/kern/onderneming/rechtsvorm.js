/* DE RECHTSVORM-AS.

   `kern/werkvormen.js` weet wat een zaak DOET; deze module weet wat zij
   JURIDISCH IS. Dat zijn twee assen en niet een, want ze staan los van
   elkaar: een glazenwasser doet hetzelfde werk als eenmanszaak en als B.V.,
   maar de B.V. heeft aandeelhouders, een UBO-opgave, DGA-loon,
   vennootschapsbelasting en een jaarrekening, en de eenmanszaak heeft
   urencriterium en startersaftrek. Wie die twee op een hoop gooit, krijgt
   een stichting met een aandeelhoudersregister.

   ANDERS DAN EEN WERKVORM WORDT EEN RECHTSVORM NIET AFGELEID. Een werkvorm
   volgt uit gedrag (er staat een auto in de vloot, dus rittools), en dat mag
   afgeleid worden omdat het gedrag zelf de waarheid is. Een rechtsvorm is een
   juridisch feit dat bij de notaris en de KvK is vastgelegd; die kun je niet
   uit gedrag raden, en gokken zou hier betekenen dat iemand op de verkeerde
   belastingaangifte wordt gezet. Hij wordt dus opgegeven. Wat eruit VOLGT --
   de verplichtingen, het gereedschap en de oprichtingsstappen -- staat hier
   als data, zodat het maar op een plek staat.

   VERBODEN IS GEEN TWEEDE CAPSLIJST MAAR HET TEGENDEEL ERVAN, en hij bestaat
   apart omdat een verbod anders verliest van een andere as. Een stichting mag
   geen winst uitkeren. Zou 'winstuitkering' alleen ONTBREKEN in haar caps, dan
   zet de eerste as die hem wel meebrengt de knop er alsnog neer -- en dat is
   precies hoe een grendel stil verdwijnt. Daarom trekt capsSamen() de verboden
   er NA het samenvoegen af: wat verboden is, wint altijd.

   NEDERLAND EN DE REST STAAN IN EEN LIJST, en elke vorm draagt zijn LAND. De
   Nederlandse vormen houden hun kale id ('bv', 'stichting'): die staan in de
   opslag van bestaande ondernemingen, en een id hernoemen betekent dat een
   bestaand bedrijf ineens geen rechtsvorm meer heeft. Buitenlandse vormen
   dragen hun landcode in het id ('de-gmbh'), zodat de twee elkaar nooit in de
   weg zitten. De buitenlandse tabel staat in ./rechtsvorm-landen.js, met daar
   de reden waarom hij apart hoort.

   HET LAND IS GEEN VERSIERING. ./belasting.js rekent met Nederlandse regels;
   voor een vorm met een ander land weigert hij te rekenen in plaats van een
   Nederlands sommetje op een Duitse GmbH los te laten. Wie het land hier
   weghaalt, zet die grendel uit. */
'use strict';

const { NL } = require('./rechtsvorm-nl');

/* Alle rechtsvormen in EEN register: Nederland plus de landen uit
   ./rechtsvorm-landen.js. Het is bewust een levend object en geen kopie --
   ./rechtsvormwacht.js werkt hem in place bij, precies zoals de Regelwacht dat
   met de LANDEN-tabel doet, zodat elke lezer per direct de nieuwe stand heeft. */
const LAND = require('./rechtsvorm-landen');

const RECHTSVORMEN = Object.assign({}, NL);
for (const [cc, l] of Object.entries(LAND.LANDEN)) {
  for (const [id, v] of Object.entries(l.vormen)) {
    RECHTSVORMEN[id] = Object.assign({ land: cc }, v);
  }
}

/* De vocabulaire van caps die in dit huis bestaat. Alles wat een bron ooit mag
   aanzetten moet hierin staan: een cap die nergens voorkomt, kan geen scherm
   vullen maar wel een knop laten verschijnen die niemand heeft ontworpen. */
const CAPS_WOORDENBOEK = [...new Set(
  Object.values(RECHTSVORMEN).flatMap(v => v.caps.concat(v.verboden)).concat(LAND.EXTRA_CAPS)
)].sort();

const isRechtsvorm = (id) => Object.prototype.hasOwnProperty.call(RECHTSVORMEN, id);

/* De rechtsvormen van een land, of een expliciet "wij weten het niet". Niet een
   lege lijst: leeg leest als "dit land kent geen rechtsvormen", en dat is iets
   heel anders dan "wij hebben ze niet". Zie de kop van ./rechtsvorm-landen.js. */
function rechtsvormenVanLand(cc) {
  const code = String(cc || '').toUpperCase();
  const eigen = Object.entries(RECHTSVORMEN).filter(([, v]) => v.land === code);
  if (!eigen.length) {
    return { ok: false, land: code, vormen: [],
      reden: 'Wij kennen de rechtsvormen van dit land niet.',
      uitleg: 'Wij zetten er met opzet geen Nederlandse lijst neer die er ongeveer op lijkt: wie daarop afgaat, gaat naar de verkeerde instantie. Vraag dit na bij een adviseur ter plaatse.',
      landen: LANDEN_MET_VORMEN() };
  }
  const l = LAND.LANDEN[code];
  return { ok: true, land: code, naam: (l && l.naam) || 'Nederland',
    let: (l && l.let) || null,
    vormen: eigen.map(([id, v]) => Object.assign({ id }, v)) };
}

const LANDEN_MET_VORMEN = () => [...new Set(Object.values(RECHTSVORMEN).map(v => v.land))].sort();

/* De rechtsvorm of null. Null en niet een standaardwaarde: "ik weet nog niet
   wat ik word" is een echte stand in de ideefase, en die mag geen eenmanszaak
   worden genoemd omdat dat toevallig de meest voorkomende is. */
function rechtsvormVan(id) {
  return isRechtsvorm(id) ? Object.assign({ id }, RECHTSVORMEN[id]) : null;
}

const capsVanRechtsvorm = (id) => (isRechtsvorm(id) ? RECHTSVORMEN[id].caps.slice() : []);
const verbodenVanRechtsvorm = (id) => (isRechtsvorm(id) ? RECHTSVORMEN[id].verboden.slice() : []);

/* De samenvoeging van alle assen, met de verboden er NA afgetrokken.
   Geeft ook terug WAT er is weggehouden en waarom, zodat een scherm kan
   uitleggen waarom een knop er niet staat -- een functie die zonder uitleg
   ontbreekt, leest als een storing. */
function capsSamen(lijsten, verboden) {
  const uit = new Set();
  for (const l of lijsten) for (const c of (l || [])) uit.add(c);
  const weg = [];
  for (const v of (verboden || [])) if (uit.delete(v)) weg.push(v);
  return { caps: [...uit].sort(), geweerd: weg.sort() };
}

module.exports = { RECHTSVORMEN, NL, CAPS_WOORDENBOEK, isRechtsvorm, rechtsvormVan,
  rechtsvormenVanLand, LANDEN_MET_VORMEN, capsVanRechtsvorm, verbodenVanRechtsvorm, capsSamen };
