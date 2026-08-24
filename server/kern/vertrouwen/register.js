/* ============================================================================
   DE HANDELINGENREGISTER van de Trust Fabric: wat telt er mee, en waarin.

   Dit is bewust DATA en geen code, net als `kern/antivirus/definities.js`. Een
   handeling erbij is een regel erbij; de meter eronder verandert niet mee. Dat
   houdt de meetlogica klein en toetsbaar, en het maakt zichtbaar WELKE
   handelingen dit huis zwaar vindt -- die lijst is zelf een uitspraak.

   DE BELANGRIJKSTE EIGENSCHAP: WAT HIER NIET STAAT, KRIJGT GEEN NUL.

   De verleiding is een onbekende handeling als "licht" te behandelen, want dan
   werkt alles meteen overal. Dat is precies verkeerd om: een handeling die
   niemand heeft gewogen is niet licht, hij is ONGEWOGEN, en het verschil
   daartussen is het hele punt van deze laag (VERTROUWEN.md par. 3.1). Een
   soort die hier ontbreekt levert dus `gemeten: false` met de reden, en de
   step-up-laag erboven mag daar zelf een besluit over nemen -- maar dan wel
   een besluit, en niet een stilte die als groen leest.

   De tabel zelf staat in ./soorten.js; de regels waar hij aan moet voldoen
   staan hieronder.
   ========================================================================== */
'use strict';

/* De tabel zelf staat in ./soorten.js -- zie de kop daar voor waarom. */
const { SOORTEN } = require('./soorten');

/* De banden op volgorde, zodat een ondergrens te vergelijken is met een
   berekende zwaarte. Staat hier en niet in de meter: het is een eigenschap van
   de schaal en niet van de berekening. */
const BANDEN = ['licht', 'zwaar', 'uitzonderlijk'];

/* ELKE SOORT NOEMT ZIJN DEUR. Hier gold ooit "elke regel hoort bij iets wat
   ECHT bestaat", en dat was bedoeld en niet afdwingbaar -- niemand controleerde
   het. Bij het aansluiten van de rolpoort bleek wat dat kost: twee van de zes
   soorten beschreven een handeling die niet bestaat, en de simulatie van laag 7
   rekende `mens.gevoelig.inzage` mee als CATASTROFAAL PAD terwijl er geen deur
   is om doorheen te gaan. Een vals rood kost net zoveel geloofwaardigheid als
   een vals groen: wie twee keer een alarm naspeurt dat nergens over gaat, kijkt
   de derde keer niet meer.

   DRIE STANDEN, EN ZE HOREN NIET OP EEN HOOP.

     gepoort              er is een deur en die houdt tegen
     gemeten              er is een deur, die meet en laat door -- met de reden
     zonderHandeling      er is geen deur; dit is een besluit, geen pad

   De Trust State telt de tweede en noemt de derde apart; de simulatie van laag
   7 rekent alleen met soorten die een deur hebben. Een soort die hier ontbreekt
   levert nog steeds `gemeten: false` bij de meter -- ongewogen is niet licht. */
const heeftHandeling = (s) => !!(s && s.waar);
function stand(s) {
  if (!s) return null;
  if (!s.waar) return 'zonderHandeling';
  return s.poort ? 'gepoort' : 'gemeten';
}
/* Alleen soorten met een deur. Wie hier de hele lijst zou gebruiken, laat de
   simulatie paden melden waar geen route achter zit -- een vals rood, en dat
   kost net zoveel geloofwaardigheid als een vals groen. */
const METDEUR = () => SOORTEN.filter(heeftHandeling);

/* Wat deze meter NIET meeweegt, met naam. Dezelfde regel als `nietGerekend` in
   bedrijf/gevolg.js: een meting die zwijgt over haar randen leest als een
   volledige risicoanalyse. */
const NIET_GEREKEND = [
  { wat: 'geld', reden: 'Er hangt hier nog geen bedrag aan een handeling; de betaalkant heeft een eigen grens (GELD.md par. 3) en die staat los van deze meter.' },
  { wat: 'de ontvanger', reden: 'Wie de uitvoer daarna krijgt is niet te zien vanaf de server. Een uitvoer naar de eigen laptop en een naar een onbekende telt hier hetzelfde.' },
  { wat: 'samenloop', reden: 'Twee handelingen die elk binnen de grens blijven maar samen niet, worden los gewogen. De blast radius van laag 6 is de plek waar dat wel samenkomt.' }
];

const BIJ_ID = new Map(SOORTEN.map(s => [s.id, s]));

/* Opzoeken levert NOOIT een verzonnen standaard. De aanroeper krijgt undefined
   en moet daar iets mee, en dat is de bedoeling. */
function soort(id) { return BIJ_ID.get(String(id || '')) || null; }

module.exports = { SOORTEN, NIET_GEREKEND, BANDEN, soort, stand, heeftHandeling, METDEUR };
