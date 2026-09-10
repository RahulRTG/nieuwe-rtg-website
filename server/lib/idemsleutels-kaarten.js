/* DE KAARTKEUZE VAN EEN LID: drie routes, en ze zijn met opzet niet gelijk.

   `/api/nav/gebieden` LEEST. Hij zet de catalogus naast de keuze van dit lid en
   verandert niets. `leest: true` en niet `zelfdeVerzoek`, om dezelfde reden als
   bij RTG Move: een tweede vraag hoort het antwoord van NU te krijgen. Bij deze
   route is dat concreet -- er kan tussen twee vragen een pakket gebouwd zijn, en
   dan staat er `gebouwd` waar eerst `aangeboden` stond (de catalogus hangt aan
   de mtime van de pakketmap, zie kern/navigatie/gebieden.js).

   `kies` en `weg` SCHRIJVEN, en ze zijn idempotent in de sterkste zin die er is:
   de keuze is een VERZAMELING en geen teller. Twee keer hetzelfde gebied kiezen
   geeft een keuze, twee keer weghalen laat hem weg. Dat is een eigenschap van de
   handeling en geen venster van vijf seconden, en juist daarom staat er
   `zelfdeVerzoek: true` en geen `nietIdempotent`.

   WAAROM DE DUBBELING TOCH ERGENS TELT, want dat is niet vanzelfsprekend: het
   BEELD bouwt een Set en ziet een dubbele rij dus niet, maar
   `navKaartVraag()` telt per lid zijn eigen lijst af. Een lid dat twee keer in
   zijn eigen rij staat, zou als twee leden tellen die deze kaart willen -- en
   daar hangt aan wat RTG gaat bouwen. De kern houdt dat tegen (`includes`
   voordat er iets bij komt) en test/navigatiemijnkaarten.test.js toets 6 is de
   grendel; de poort hier is de tweede laag en niet de enige.

   Volgorde: eerst de verklaring, dan de route -- zie de kop van
   ./idemsleutels.js. */
'use strict';
const SLEUTELS = {
  'POST /api/nav/gebieden': { leest: true },
  'POST /api/nav/gebied/kies': { zelfdeVerzoek: true },
  'POST /api/nav/gebied/weg': { zelfdeVerzoek: true }
};
module.exports = { SLEUTELS };
