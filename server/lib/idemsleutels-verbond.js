/* HET IDEM-REGISTER, deel het verbond (B2, kern/verbond/) -- via
   ./idemsleutels-gemeenschap.js.

   Gemeten in test/verbond-server.test.js toets 5: elke route twee keer met
   hetzelfde lijf tegen een echte server, en niets erbij na de tweede keer. De
   vier schrijfroutes staan met opzet NIET hier maar in
   ./idemsleutels-nooit-verbond.js: ze herkennen een herhaling zelf. */
'use strict';

const SLEUTELS = {
  'POST /api/verbond/mijn': { leest: true },
  'POST /api/verbond/lees': { leest: true }
};

module.exports = { SLEUTELS };
