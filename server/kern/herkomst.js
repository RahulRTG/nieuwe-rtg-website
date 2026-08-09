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

   BESCHIKBAAR is bewust kort. Alleen wat er echt is, staat aan; de andere drie
   staan er met naam bij zodat zichtbaar blijft wat er nog niet is, in plaats van
   dat ze pas bestaan als iemand ze verzint. */

const SOORTEN = {
  zelf: { label: 'zelf ingevuld', beschikbaar: true },
  apparaat: { label: 'door een apparaat gemeten', beschikbaar: false },
  behandelaar: { label: 'door een behandelaar vastgelegd', beschikbaar: false },
  afgeleid: { label: 'door RTG afgeleid', beschikbaar: true }
};

const BESCHIKBAAR = Object.keys(SOORTEN).filter(k => SOORTEN[k].beschikbaar);

/* Een herkomst die niet beschikbaar is, wordt geweigerd en valt NIET stil terug
   op 'zelf'. Stil terugvallen zou betekenen dat een apparaatmeting die nog niet
   bestaat, straks als eigen woord van het lid in de boeken staat. */
const magHerkomst = b => BESCHIKBAAR.includes(String(b || ''));
const labelVan = b => (SOORTEN[b] || {}).label || b;

module.exports = { SOORTEN, BESCHIKBAAR, magHerkomst, labelVan };
