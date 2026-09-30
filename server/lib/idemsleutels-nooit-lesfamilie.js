/* DE LESCREDENTIALS VAN RTFOUNDATION-ONDERWIJS (29 september 2026,
   RELEASEKANDIDAAT.md B17) bij ./idemsleutels-nooit-routes.js. Elk antwoord hier
   draagt een kale lescode of lessleutel die maar een keer bestaat, of beslist in
   de collectietransactie van foundation/onderwijs/toegang.js over de actuele
   stand ervan. Een generieke antwoordcache mag daar niets van herhalen. Eigen
   bestand, zodat parallelle migraties elkaars lijst niet raken. */
'use strict';

const STAND = 'leest de actuele stand van de les in de collectietransactie; een tweede keer is een ' +
  'toestandscontrole en geen gecachet antwoord';

module.exports = Object.freeze({
  'POST /api/foundation/les/maak':
    'maken toont de 128-bit lescode en de leraarssleutel eenmaal; een herhaling met dezelfde idem krijgt 409 zonder codes, en een antwoordcache zou ze heronthullen',
  'POST /api/foundation/les/join':
    'meedoen is de atomaire claim op de lescode en toont de leerlingsleutel eenmaal; een tweede keer met dezelfde naam is 409 en nooit de sleutel van een ander',
  'POST /api/foundation/les/code/roteer':
    'roteren geeft een nieuwe lescode en trekt de vorige in; een herhaald antwoord zou een ingetrokken code tonen',
  'POST /api/foundation/les/code/intrekken': STAND,
  'POST /api/foundation/les/leerling/intrekken': STAND,
  'POST /api/foundation/les/sluit': STAND
});
