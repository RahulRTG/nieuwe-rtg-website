/* HET SPIEGELBEELD: EEN CAPABILITY DIE NIEMAND HEEFT GEKOCHT.

   ../handhaving.js meet regel 2 van CONTROLPLANE.md -- geen capability zonder
   caller. Dit bestand meet de andere kant, en die is even hard: RTG mag geen
   afdwingbaar onderdeel hebben dat op geen enkele trede staat.

   Zo'n capability is een SPOOK. Hij houdt mensen tegen -- de code vraagt hem, de
   poort weigert -- maar er is geen product waar hij bij hoort, dus niemand heeft
   hem gekocht en niemand kan hem krijgen. Dat is geen dode code die je opruimt
   als je toevallig langsloopt; het is een deur die dicht zit zonder dat iemand
   er een sleutel voor heeft laten maken.

   HET IS DE GOEDKOOPSTE CONTROLE VAN ALLEMAAL, want ../capaciteiten.js weet het
   antwoord al: staat een capability op geen enkele trede, dan hoort hij niet
   afgedwongen te worden. Er is vandaag geen enkel spook -- en juist daarom hoort
   deze meting te bestaan, want de dag dat er een komt, komt hij stil.

   Een eigen bestand omdat het een ANDERE vraag is: de meter hiernaast telt wie
   er vraagt, deze kijkt of er iemand kan kopen. */
'use strict';

/* HET SPIEGELBEELD: EEN CAPABILITY DIE NIEMAND HEEFT GEKOCHT.

   Regel 2 van CONTROLPLANE.md zegt "geen capability zonder caller", en `poort()`
   hierboven meet dat. De andere kant is even hard en werd nergens gesteld: RTG
   mag geen afdwingbaar onderdeel hebben dat op geen enkele trede staat.

   Zo'n capability is een SPOOK. Hij houdt mensen tegen -- de code vraagt hem, de
   poort weigert -- maar er is geen product waar hij bij hoort, dus niemand heeft
   hem gekocht en niemand kan hem krijgen. Dat is geen dode code die je opruimt
   als je toevallig langsloopt; het is een deur die dicht zit zonder dat iemand
   er een sleutel voor heeft laten maken.

   HET IS DE GOEDKOOPSTE CONTROLE VAN ALLEMAAL, want `capaciteiten.PROFIEL` weet
   het antwoord al: staat een capability op geen enkele trede, dan hoort hij niet
   afgedwongen te worden. Er is vandaag geen enkel spook -- en juist daarom hoort
   deze meting te bestaan, want de dag dat er een komt, komt hij stil. */
function maakSpoken(meet) {
  return function spoken(bestanden) {
  const m = meet(bestanden);
  const uit = [];
  for (const r of m.rijen) {
    if (r.treden.length) continue;                       // hij hoort bij een product
    const afgedwongen = r.poorten.length + r.routes.length;
    if (!afgedwongen) continue;                          // niet gekocht en niet afgedwongen: alleen een naam
    uit.push({ cap: r.cap, uitleg: r.uitleg, afgedwongen,
      waar: [...r.poorten.map(p => p.pad + ':' + p.regel), ...r.routes.map(x => x.pad)].slice(0, 5) });
  }
  return { aantal: uit.length, spoken: uit,
    problemen: uit.map(x => x.cap + ' wordt op ' + x.afgedwongen + ' plek(ken) afgedwongen maar staat op ' +
      'geen enkele trede: niemand kan hem kopen, en toch houdt hij mensen tegen.') };
  };
}

module.exports = { maakSpoken };
