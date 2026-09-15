'use strict';

/* ============================================================================
   HET BESLUIT -- de doorsnede plus wat een aanroeper eruit mag concluderen.

   WAAROM DIT NAAST `doorsnede()` STAAT EN NIET ERIN. `doorsnede()` MEET: hij
   geeft de uitkomst plus de staat van zijn vier bronnen, en oordeelt niet. Dat
   is bruikbaar voor een aanroeper die zelf wil beslissen, en het is precies de
   vorm die een schaduwronde nodig heeft. Maar een aanroeper die er echt
   bevoegdheid op baseert, mag die staat niet MOGEN negeren -- en vandaag kan
   dat: `onbekendeBronnen` is een veld dat je niet hoeft te lezen.

   DE REGEL DIE HIJ AFDWINGT: een bron die niet is vast te stellen levert een
   VERKLAARDE WEIGERING en geen lege uitkomst. Dat verschil is niet cosmetisch.
   Een lege uitkomst leest als "deze gever mag niets" -- een plausibel,
   stilzwijgend en volstrekt verkeerd antwoord wanneer de waarheid is dat er
   niemand heeft gekeken. Dat is dezelfde faalvorm als een wachter zonder bron
   die doet alsof hij kijkt (REIZEN.md) en als `noteer()` die succes meldt over
   een weggegooide array (MENSNETWERK.md par. 0.6).

   `ONBEKEND` EN `STUK` WORDEN APART GEMELD, en dat is regel 2 uit de kop van
   ./versmalling.js, doorgetrokken tot in het besluit: het eerste is een gat in de
   BEDRADING (niemand heeft deze bron aangesloten), het tweede een fout in de
   AANROEP (er kwam iets langs dat geen verzameling is). Ze weigeren allebei,
   maar ze worden door een andere mens gerepareerd.

   HIJ HEET GEEN `versmal`, en dat is met opzet. Die naam woont al in
   kern/stuur/isolatiefilter.js (op PADEN) en in kern/commercie/bevoegdheid.js
   (op GRENZEN). Een derde `versmal` die op BEVOEGDHEIDSSLEUTELS werkt is exact
   de kostenpost die SEMANTIEK.json meet -- en dezelfde reden waarom
   ./projectie.js zijn vormer `projecteerNamens` noemt.
   ========================================================================== */
function maakBesluit({ doorsnede }) {
  function versmalNamens(invoer) {
    const r = doorsnede(invoer);
    if (r.stukkeBronnen.length || r.onbekendeBronnen.length) {
      return {
        ok: false,
        effectief: [],
        weigering: {
          code: 'RTG_VERSMALLING_ONBEPAALBAAR',
          onbekend: r.onbekendeBronnen,
          stuk: r.stukkeBronnen,
          reden: 'De versmalling is niet vast te stellen, dus er wordt niets verleend. ' +
            (r.onbekendeBronnen.length
              ? 'Niet aangesloten: ' + r.onbekendeBronnen.join(', ') + '. '
              : '') +
            (r.stukkeBronnen.length
              ? 'Geen verzameling: ' + r.stukkeBronnen.join(', ') + '. '
              : '') +
            'Dit is GEEN oordeel dat de gever niets mag -- er heeft niemand gekeken, en die twee ' +
            'mogen nooit hetzelfde antwoord opleveren.'
        },
        doorsnede: r
      };
    }
    return { ok: true, effectief: r.effectief, versmald: r.geweigerd, doorsnede: r };
  }

  return { versmalNamens };
}

module.exports = { maakBesluit };
