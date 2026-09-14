/* TWEE LEESROUTES DIE PAS IN DE BUNDEL ZICHTBAAR WERDEN (13 september 2026).

   Ze komen uit twee verschillende takken -- POST /api/rtf/knelpunt uit de
   Adam-keten, POST /api/supplier/activity uit de zaak-live-keten -- en geen van
   beide takken zag dat de andere er ook een toevoegde. `npm run idemschuld` telt
   over de HELE boom, dus deze twee verschijnen pas als de takken naast elkaar
   liggen. Vandaar een gedeeld zijbestand en niet twee regels in twee bestanden:
   ze horen bij elkaar door de manier waarop ze gevonden zijn.

   ALLEBEI `leest: true`, en dat is een BESLUIT en geen gat -- dezelfde redenering
   als in ./idemsleutels-move.js en ./idemsleutels-stage.js. Ze zijn POST omdat
   dit huis geen GET met een sessie kent, niet omdat ze iets veranderen, en hun
   contract staat op NOT_APPLICABLE met een uitgeschreven meting erbij
   (./mutatiecontracten-knelpunt.js en ./mutatiecontracten-leest-zaak.js). Een
   tweede aanroep hoort dus het antwoord van NU te krijgen: de idempotentiepoort
   doet hier niets, want er is niets om tegen te houden.

   WAAROM DAT VOOR EEN LEZER UITMAAKT: zou hier een sleutel staan, dan speelt de
   poort binnen het dubbeltikvenster het BEWAARDE antwoord terug. Bij een
   knelpuntberekening of een activiteitenspoor is dat precies verkeerd -- je
   vraagt ernaar omdat je de stand van nu wilt zien. */
'use strict';
const SLEUTELS = {
  'POST /api/rtf/knelpunt': { leest: true },
  'POST /api/supplier/activity': { leest: true }
};
module.exports = { SLEUTELS };
