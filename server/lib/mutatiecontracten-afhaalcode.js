/* Nagekeken contracten van de afhaalcode van een bestelling (pay.order_pickup_code,
   server/kern/afhaalcode.js). Twee ledenroutes, en ze zijn met opzet elkaars
   tegenpool: tonen is ROTEREN en dus nooit dezelfde uitkomst, intrekken is een
   stand die een tweede keer niets meer verandert. */
'use strict';
const OBJECT = { klasse: 'OBJECT_SCOPED', objectVeld: 'ref',
  uitleg: 'de ref moet een bestelling van DEZE sessie zijn; een ref van een ander lid geeft 404' };
const AF = { door: 'Claude, afhaalcodekern en beide routes gelezen en beproefd', op: '2026-09-27' };
const CONTRACTEN = {
  'POST /api/order/afhaalcode': {
    mutatieId: 'order.afhaalcode.tonen', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: OBJECT,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Tonen is roteren: elke oproep maakt een nieuwe 128-bit code en trekt de vorige in. Een herhaling die de vorige code teruggaf zou het geheim uit een cache heronthullen; daarom staat de route ook in lib/eenmalig-geheim-routes.js.',
    bewijs: { gemeten: 'test/afhaalcode.test.js 1, 6 en 11: een tweede oproep geeft een andere code en de vorige opent daarna niets meer (409)', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/order/afhaalcode/intrek': {
    mutatieId: 'order.afhaalcode.intrekken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: OBJECT, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/afhaalcode.test.js 6 en 12: intrekken zet ingetrokken_at eenmaal; een tweede oproep laat de stand gelijk en zonder rij wordt niets geschreven', op: '2026-09-27' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
