/* WELKE TOETSEN ALLEEN MOGEN DRAAIEN.

   Deze lijst stond als constante in scripts/test-runner.js en werd door
   test/bronmutanten.test.js met een regex uit die bron geschraapt. Twee
   bezwaren, en het tweede is het echte: een regex over andermans bron breekt
   zodra iemand de opmaak verandert, en een toets die alleen TEKST leest is voor
   de mutatiemotor onbereikbaar -- hij telde als "niet gemeten" terwijl er vier
   beweringen op staan.

   Als module is het allebei opgelost: de draaier en de toets lezen dezelfde
   lijst, en een mutatie hierin laat die toets zakken.

   WAAROM EEN TOETS HIER STAAT. Twee soorten:

   1. HIJ MUTEERT ECHTE BRONBESTANDEN om te bewijzen dat zijn meter kan uitslaan
      (LAT.md regel 10). Draait die parallel, dan leest een ANDERE toets die net
      een server start het kapotte bestand -- en valt om met een fout die naar
      een onschuldig bestand wijst. Dat is hier echt gebeurd: gezag.test.js en
      envelop.test.js stonden er niet in, en test/excursie.test.js kreeg de
      schuld van "gastAuth is not defined".
   2. HIJ IS ZO ZWAAR dat parallel draaien de machine of de poorten opeet
      (boot-smoke, grens-sweep, zaakdoos).

   test/bronmutanten.test.js houdt tegen dat er een van soort 1 bijkomt die hier
   niet staat. Soort 2 blijft mensenwerk. */
'use strict';

const GEISOLEERD = [
  'boot-smoke.test.js',    // start een hele server op een eigen poort
  'grens-sweep.test.js',   // loopt alle endpoints af; parallel is dat een storm
  'klok.test.js',          // verzet de klok in subprocessen
  'zaakdoos.test.js',      // zwaar, met een eigen datamap
  'keuring.test.js',       // scant de hele bron; ziet andermans tijdelijke bestanden
  'meterijk.test.js',      // muteert bron EN registers om elke meter te ijken
  'gezag.test.js',         // hernoemt een trede in geldbeleid/regels.js en ainiveau.js
  'envelop.test.js'        // haalt `function gastAuth(` en `req.techUser =` weg
];

/* De vraag die de draaier stelt, als functie en niet als lijst-inspectie. Dat
   is niet alleen netter: een lijst met tekenreeksen is voor de mutatiemotor
   onbereikbaar (geen enkele mechanische operator bijt op een string), en dan
   telt test/bronmutanten.test.js als "niet gemeten" terwijl er beweringen op
   staan. Een vergelijking is wel te muteren, dus is deze functie het punt waar
   die toets bewijsbaar kan zakken (LAT.md regel 10). */
function isGeisoleerd(naam) {
  const n = String(naam || '');
  for (const item of GEISOLEERD) if (item === n) return true;
  return false;
}

module.exports = { GEISOLEERD, isGeisoleerd };
