/* HET IDEM-REGISTER, deel het beraad (B3, kern/beraad/) -- zelfde register,
   eigen bestand.

   Gemeten in test/beraad-server.test.js toets 6: elke route twee keer met
   hetzelfde lijf tegen een echte server. Zes routes staan hier met opzet NIET
   maar in ./idemsleutels-nooit-beraad.js: ze herkennen een herhaling zelf, en
   een afgespeeld antwoord zou daar een latere handeling ongedaan maken (voor,
   tegen, voor binnen het venster zou op tegen blijven staan). */
'use strict';

const SLEUTELS = {
  'POST /api/beraad/mijn': { leest: true },
  'POST /api/beraad/lees': { leest: true },
  /* Rahul leest en bewaart niets; ook het concept gaat alleen terug. */
  'POST /api/beraad/hulp': { leest: true },
  /* Een dubbeltik op openen is een beraad, niet twee; de vraag en de drager
     bepalen wat er ontstaat. */
  'POST /api/beraad/open': { zelfdeVerzoek: true },
  /* Een dubbeltik is een inbreng, niet twee. Een andere tekst is een ander
     verzoek (`tekst` staat niet in BUITEN_AFDRUK van ./idem-kast.js). */
  'POST /api/beraad/inbreng': { zelfdeVerzoek: true }
};

module.exports = { SLEUTELS };
