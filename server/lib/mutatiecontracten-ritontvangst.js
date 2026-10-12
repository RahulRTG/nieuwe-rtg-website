/* ============================================================================
   MUTATIECONTRACT -- WAT DE REIZIGER ZELF OVER ZIJN RIT ZEGT.

   Deel van ./mutatiecontracten.js. De twee routes van server/routes/mobiliteit.js
   op kern/mobiliteit/ontvangst.js. Bevestigen houdt de eerste tijd vast en een
   tweede keer verandert niets; een probleem van dezelfde soort staat er een
   keer. Beide zijn een TOESTANDSCONTROLE en geen duplicaatlaag.
   ========================================================================== */
'use strict';

const OP = '2026-10-12';
const AFGETEKEND = { door: 'Claude, op grond van de gelezen handler en test/mob-ontvangst.test.js; niet door een mens nagelezen', op: OP };
const zet = (route, mutatieId, gemeten) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur: 'auth' },
  stand: 'PROTECTED',
  bewijs: { gemeten, op: OP },
  nagekeken: 'handler gelezen in server/kern/mobiliteit/ontvangst.js: alleen de reiziger van deze rit; ' +
    'de stand hangt af van wat er al staat en niet van het aantal oproepen; de rit beweegt er niet van',
  afgetekend: AFGETEKEND
}];

module.exports = Object.fromEntries([
  zet('POST /api/mob/ontvangst', 'mob.ontvangst.bevestig',
    'toets 2: een tweede bevestiging gaf gewijzigd:false en de eerste tijd bleef staan'),
  zet('POST /api/mob/ontvangst/probleem', 'mob.ontvangst.probleem',
    'toets 3: dezelfde soort nog eens melden gaf gewijzigd:false; de rit bleef op aangekomen')
]);
