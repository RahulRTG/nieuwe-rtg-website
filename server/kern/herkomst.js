/* Waar komt een gegeven vandaan. Vier soorten, en ze mogen nooit door elkaar
   lopen -- dat staat als grens in docs/life.md en dit bestand is die grens in
   code. Het lid zei het zelf, een apparaat mat het, een behandelaar legde het
   vast, of RTG leidde het af: dat zijn vier verschillende dingen, en een
   afgeleide schatting die later als een meting wordt gelezen is precies de
   fout die achteraf niet meer te herstellen is.

   Waarom dit een eigen bestand is en geen lijstje in de module die het toevallig
   het eerst nodig had: de doelenmotor had er een, en de metingenlaag zou er een
   tweede krijgen. Twee lijstjes met dezelfde waarheid lopen uiteen, en meestal
   zonder dat iets klaagt (LAT.md regel 4).

   BESCHIKBAAR is bewust kort. Alleen wat er echt is, staat aan; de rest staat er
   met naam bij zodat zichtbaar blijft wat er nog niet is, in plaats van dat ze
   pas bestaan als iemand ze verzint. 'apparaat' staat sinds kern/toestellen.js
   aan, 'behandelaar' sinds kern/care/vastleggen.js -- en die laatste alleen als
   het lid die aanbieder er uitdrukkelijk toestemming voor heeft gegeven.

   EN DE HERKOMST KOMT UIT DE DEUR, NOOIT UIT HET VERZOEK. Wie zelf invult kan
   zijn schatting niet als apparaatmeting boeken, want de schrijver krijgt de
   herkomst van de route mee en leest hem niet uit de body. */

const SOORTEN = {
  zelf: { label: 'zelf ingevuld', beschikbaar: true },
  apparaat: { label: 'door een apparaat gemeten', beschikbaar: true },
  behandelaar: { label: 'door een behandelaar vastgelegd', beschikbaar: true },
  afgeleid: { label: 'door RTG afgeleid', beschikbaar: true }
};

const BESCHIKBAAR = Object.keys(SOORTEN).filter(k => SOORTEN[k].beschikbaar);

/* De rangorde als er meer dan een bron iets zegt over dezelfde dag. Wie heeft
   GEMETEN gaat voor wie heeft geschat, en een behandelaar met een geijkt
   apparaat in de hand gaat voor een horloge om een pols. Dit is een rangorde
   voor het TONEN van een getal; er wordt niets weggegooid, en wat niet is
   meegeteld blijft zichtbaar (zie kern/metingen.js). */
const RANG = { behandelaar: 3, apparaat: 2, zelf: 1, afgeleid: 0 };
const rangVan = b => RANG[b] || 0;

/* Een herkomst die niet beschikbaar is, wordt geweigerd en valt NIET stil terug
   op 'zelf'. Stil terugvallen zou betekenen dat een apparaatmeting die nog niet
   bestaat, straks als eigen woord van het lid in de boeken staat. */
const magHerkomst = b => BESCHIKBAAR.includes(String(b || ''));
const labelVan = b => (SOORTEN[b] || {}).label || b;

module.exports = { SOORTEN, BESCHIKBAAR, RANG, rangVan, magHerkomst, labelVan };
