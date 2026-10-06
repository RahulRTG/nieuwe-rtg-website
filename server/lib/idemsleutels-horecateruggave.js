/* DE TERUGGAVE AAN TAFEL (routes/supplier/horeca/teruggave.js) -- wat is hier
   "hetzelfde verzoek"?

   De route eist zelf een idem-sleutel in het lijf en kern/horeca/teruggave.js
   herkent een herhaling op correctie + sleutel: hij geeft dezelfde
   terugbetaling terug, en vraagt bij een providerterugbetaling de stand na.
   Een antwoordcache van de poort ervoor zou juist dat navragen opslokken en een
   oude stand tonen. Daarom staat het pad ook in middleware/idempotentie-eigen.js. */
'use strict';
const SLEUTELS = {
  'POST /api/supplier/horeca/teruggave': { nietIdempotent: true,
    waarom: 'de kern dedupliceert zelf op correctie en idem-sleutel en vraagt bij een herhaling de providerstand na; een poortcache zou een oude stand tonen' }
};
module.exports = { SLEUTELS };
