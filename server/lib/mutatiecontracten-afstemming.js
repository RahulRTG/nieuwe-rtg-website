/* ============================================================================
   MUTATIECONTRACTEN -- DE AFSTEMMING VAN EEN ONBEKENDE UITBETALING (MONEY-012).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. Een route, en hij heeft dezelfde vorm als de twee aanvragen in
   ./mutatiecontracten-tweedehand.js: hij MAAKT een aanvraag en verandert zelf
   niets aan het geld. Het effect -- afwikkelen of terugboeken -- zit achter de
   bevestiging door een tweede mens, en die is eenmalig.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/office/bank/opdrachten/afstemming': {
    mutatieId: 'bank.afstemming.aanvragen',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een tweede aanroep maakt een TWEEDE aanvraag, en dat is onschadelijk: de aanvraag ' +
      'verandert niets aan het geld. Wordt de eerste afgetekend, dan staat de opdracht niet meer ' +
      'op ONBEKEND en weigert kern/betaalopdracht/afstemming.js de tweede met 409 -- er kan dus ' +
      'hooguit een keer worden afgewikkeld of teruggeboekt. Het gevaar dat idempotentie zou ' +
      'afdekken zit achter de bevestiging, en die is eenmalig.',
    bewijs: {
      gemeten: 'test/bank.test.js "de afstemmingsroute weigert wat niet ONBEKEND is": geen aanvraag ' +
        'bij een weigering; test/money012.test.js "afstemming NIET_UITGEVOERD": een tweede uitspraak ' +
        'geeft 409 en boekt niet opnieuw terug. Mutaties op beide gezakt.',
      op: '2026-09-24'
    },
    afgetekend: {
      door: 'Claude, op grond van de bron van kern/betaalopdracht/afstemming.js en de toetsen ' +
        'hierboven; niet door een mens nagelezen',
      op: '2026-09-24'
    }
  }
};

module.exports = { CONTRACTEN };
