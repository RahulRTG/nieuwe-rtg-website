/* HET IDEM-REGISTER, deel DemocratieOS fase B (kern/democratie/) -- zelfde
   register, eigen bestand.

   Drie lezers en drie schrijvers die bij een woordelijk gelijk verzoek hetzelfde
   antwoord horen te geven. De drie routes die met een TOESTANDSCONTROLE weigeren
   (eindstand, heropen, intrek) staan hier met opzet NIET: die staan in
   ./idemsleutels-nooit-democratie.js, want een afgespeeld succes zou verbergen
   dat een ander de ronde al had afgesloten. */
'use strict';

const SLEUTELS = {
  'POST /api/member/democratie/kwestie/mijn': { leest: true },
  'POST /api/office/democratie/kwestie/lijst': { leest: true },
  'POST /api/office/democratie/meter': { leest: true },
  /* Een dubbeltik is een kwestie, niet twee. Na een verloren antwoord kan de
     inbrenger het opnieuw doen; dan kan er wel een tweede ontstaan, en die is
     niet kwijt -- hij is samen te voegen. */
  'POST /api/member/democratie/kwestie/inbreng': { zelfdeVerzoek: true },
  /* Een trede gaat nooit terug; nog eens openen verandert niets. */
  'POST /api/member/democratie/kwestie/gezien': { zelfdeVerzoek: true },
  /* Dezelfde stand nog eens zetten is een herhaling en schrijft niets. */
  'POST /api/office/democratie/kwestie/behandel': { zelfdeVerzoek: true },
  /* Haalt alleen wekken in die nog niet uitgingen; een tweede ronde vindt er geen. */
  'POST /api/office/democratie/kwestie/herbezorg': { zelfdeVerzoek: true }
};

module.exports = { SLEUTELS };
