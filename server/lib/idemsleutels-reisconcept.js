/* HET REISCONCEPT OP HET SCHERM (kern/fluister/reis/reisconcept.js, EDGE.md par.
   14.6) -- wat is hier "hetzelfde verzoek"?

   Een woordelijk gelijk verzoek (zelfde id, versie en waarden) is een dubbeltik:
   binnen het venster krijgt het het eerste antwoord terug. De route is er zelf
   ook tegen bestand -- dezelfde waarden geven geen nieuwe versie, en andere
   waarden op een oude versie geven 409 -- dus daarbuiten blijft het concept na
   twee aanroepen wat het na een was (test/concept-live.test.js 3 en 4). */
'use strict';
const SLEUTELS = {
  'POST /api/fluister/concept': { zelfdeVerzoek: true }
};
module.exports = { SLEUTELS };
