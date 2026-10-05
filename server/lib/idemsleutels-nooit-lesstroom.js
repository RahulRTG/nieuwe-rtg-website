/* HET STROOMTICKET VAN RTFOUNDATION-ONDERWIJS (4 oktober 2026,
   RELEASEKANDIDAAT.md B25) bij ./idemsleutels-nooit-routes.js. Het antwoord
   draagt een kaal ticket van 128 bits dat een keer de live-stroom van een les
   opent (foundation/onderwijs/stroomticket.js). Een antwoordcache die het
   herhaalt, geeft een ticket dat al gebruikt kan zijn -- of een ticket dat een
   ander nog moest gebruiken. Eigen bestand, zodat parallelle migraties elkaars
   lijst niet raken. */
'use strict';

module.exports = Object.freeze({
  'POST /api/foundation/les/stroomticket':
    'elke oproep geeft een NIEUW eenmalig stroomticket van dertig seconden; een herhaling hoort een vers ticket te krijgen ' +
    'en een antwoordcache zou een al geclaimd of nog te claimen ticket heronthullen'
});
