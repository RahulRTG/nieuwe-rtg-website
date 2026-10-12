/* ============================================================================
   MUTATIECONTRACT -- DE RECHTEN VAN DE WERKRUIMTE.

   Deel van ./mutatiecontracten.js. POST /api/ik/workspace/rechten
   (kern/workspace-rechten.js) rekent uit welke werkruimtepermissies de sessie
   heeft en schrijft niets: geen collectie, geen teller, geen spoor.
   ========================================================================== */
'use strict';

const OP = '2026-10-12';

module.exports = {
  'POST /api/ik/workspace/rechten': {
    mutatieId: 'ik.workspace.rechten', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'auth' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/workspace-rechten.test.js toets 3 vraagt de route herhaald met dezelfde sessie en krijgt hetzelfde antwoord', op: OP },
    nagekeken: 'handler gelezen in server/kern/workspace-rechten.js: rechtenVoor() leest alleen de sessie en een ' +
      'lijst namen uit het verzoek -- schrijft niets',
    afgetekend: { door: 'Claude, op grond van de gelezen handler en de toets; niet door een mens nagelezen', op: OP }
  }
};
