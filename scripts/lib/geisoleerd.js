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
      (boot-smoke, grens-sweep, zaakdoos, vloot).

      VLOOT KWAM ER OP 25 AUGUSTUS 2026 BIJ, en de reden dat hij er niet stond
      is leerzaam: er werd geteld hoe vaak een toets startServer() aanroept, en
      daar zijn er tweeentwintig met drie of meer. Maar die starten er een NA de
      ander. vloot.test.js zegt op regel 37 wat hem anders maakt -- "Deze toets
      start er VIER tegelijk" -- en dat is de eigenschap die telt: hoeveel
      servers er GELIJKTIJDIG leven, niet hoe vaak er een wordt gestart.

      Hij zakte in de dekkingsronde twee keer op "komt op binnen 360s; laatste
      stand per groep: {leden:502, kantoor:200, rtf:200}" -- twee groepen op, de
      derde niet -- en slaagde daarna los in een keer. Dat verschil IS de
      diagnose: contentie, geen defect. Boot-smoke stond er al op omdat hij EEN
      hele server start; vier plus een poortwachter hoort daar dan zeker bij.

   test/bronmutanten.test.js houdt tegen dat er een van soort 1 bijkomt die hier
   niet staat. Soort 2 blijft mensenwerk. */
'use strict';

const GEISOLEERD = [
  'boot-smoke.test.js',    // start een hele server op een eigen poort
  'grens-sweep.test.js',   // loopt alle endpoints af; parallel is dat een storm
  'klok.test.js',          // verzet de klok in subprocessen
  'zaakdoos.test.js',      // zwaar, met een eigen datamap
  'vloot.test.js',         // start VIER servers tegelijk (poortwachter + drie groepen)
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
