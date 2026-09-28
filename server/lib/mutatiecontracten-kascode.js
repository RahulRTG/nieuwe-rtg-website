/* Nagekeken contracten van de kas- en tikcode als credential (CODECREDENTIALS.json,
   deuren pay.kascode_en_vooraf en pay.tikcode). Alleen de twee intrekroutes zijn
   nieuw; uitgeven blijft een code-maker (mutatiecontracten-tweedehandeling.js),
   en een retry met dezelfde sleutel krijgt daar sinds 27 september 2026 409
   zonder code in plaats van een kopie. */
'use strict';
const AUTH = { klasse: 'AUTHENTICATED' };
const AF = { door: 'Claude, kasbak en beide routes gelezen en beproefd', op: '2026-09-27' };
const contract = (id, bewijs) => ({
  mutatieId: id, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: AUTH, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/kascode-routes.test.js ' + bewijs, op: '2026-09-27' },
  afgetekend: AF
});
const CONTRACTEN = {
  'POST /api/pay/kascode/intrek': contract('pay.kascode.intrekken',
    'trekt de open code van de aanroeper in; een tweede oproep trekt niets meer in en de code opent daarna niets'),
  'POST /api/pay/tikcode/intrek': contract('pay.tikcode.intrekken',
    'trekt de open tik van de aanroeper in; een tweede oproep trekt niets meer in en de tik opent daarna niets')
};
module.exports = { CONTRACTEN };
