/* DE SESSIESTROOM (6 oktober 2026, kern/sessiestroom.js) bij
   ./idemsleutels-nooit-routes.js. Het antwoord draagt een kaal ticket van 128
   bits dat een live-stroom of video opent zonder sessie in het adres. Een
   antwoordcache die het herhaalt, geeft een ticket dat al gebruikt kan zijn --
   of een ticket dat een ander nog moest gebruiken. Eigen bestand, zodat
   parallelle migraties elkaars lijst niet raken. */
'use strict';

module.exports = Object.freeze({
  'POST /api/stroom/ticket':
    'elke oproep geeft een NIEUW kortlevend stroomticket; een herhaling hoort een vers ticket te krijgen ' +
    'en een antwoordcache zou een al geclaimd of nog te claimen ticket heronthullen',
  'POST /api/foundation/school/belkanaal/ticket':
    'elke oproep geeft een NIEUW eenmalig ticket voor het belkanaal van een klas; een antwoordcache zou ' +
    'een al geclaimd ticket heronthullen'
});
