/* Salon claimt en verzilvert binnen de eigen posts-transactie. Uitgifte en
   rotatie staan in idemsleutels-nooit omdat hun kale antwoord niet cachebaar
   is; deze twee mutaties moeten eveneens altijd het actuele domeinoordeel
   krijgen in plaats van een generiek oud antwoord. */
'use strict';
const SLEUTELS = {
  'POST /api/salon/deal/claim/intrek': { nietIdempotent: true,
    waarom: 'de Salon-kern bindt lid, claim en expliciete sleutel duurzaam en moet de actuele ingetrokken stand beoordelen' },
  'POST /api/supplier/salon/deal/redeem': { nietIdempotent: true,
    waarom: 'verzilvering consumeert de bearer eenmalig; alleen de Salon-kern kan een exacte retry van een tweede poging onderscheiden' }
};
module.exports = { SLEUTELS };
