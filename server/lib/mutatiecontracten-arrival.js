/* Nagekeken contracten van de Arrival Pass (livingos.invisible_arrival_pass,
   server/kern/arrivalpas.js). De houder van de pass is de enige die hem kan
   roteren of intrekken; de pass zelf is dus het object waar de toegang aan
   hangt. Roteren is met opzet nooit dezelfde uitkomst, intrekken is een stand
   die een tweede keer niets meer verandert. */
'use strict';
const OBJECT = { klasse: 'OBJECT_SCOPED', objectVeld: 'pass',
  uitleg: 'de 128-bit pass uit het lijf wijst de aankomst aan; zonder geldige pass 401, ingetrokken of verlopen 410' };
const AF = { door: 'Claude, arrivalpaskern en beide routes gelezen en beproefd', op: '2026-09-27' };
const CONTRACTEN = {
  'POST /api/arrival/pass/roteer': {
    mutatieId: 'arrival.pass.roteren', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: OBJECT,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Roteren maakt elke keer een nieuwe 128-bit pass en trekt de vorige in. Een herhaling die de vorige teruggaf zou een geheim uit een cache heronthullen; daarom staat de route ook in lib/eenmalig-geheim-routes.js.',
    bewijs: { gemeten: 'test/arrivalpas.test.js 5 en 8: na een rotatie opent de oude pass niets meer (401) en de nieuwe wel', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/arrival/pass/intrek': {
    mutatieId: 'arrival.pass.intrekken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: OBJECT, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/arrivalpas.test.js 5 en 8: intrekken zet ingetrokken_at eenmaal; daarna geeft de pass 410', op: '2026-09-27' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
