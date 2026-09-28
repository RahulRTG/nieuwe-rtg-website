/* Nagekeken contracten van de tegoedbon als credential (CODECREDENTIALS.json,
   deur `pay.tegoedbon`). Alleen de twee rotatieroutes zijn nieuw; de andere
   zeven stonden er al en houden hun eerdere indeling. */
'use strict';
const AUTH = { klasse: 'AUTHENTICATED' };
const AF = { door: 'Claude, tegoedbonkern en routes gelezen en beproefd', op: '2026-09-27' };
const contract = (id, bewijs) => ({
  mutatieId: id, herkomst: 'mens', semantiek: { klasse: 'sleutelVereist' },
  toegang: AUTH, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/tegoedbon-routes.test.js ' + bewijs, op: '2026-09-27' },
  afgetekend: AF
});
const CONTRACTEN = {
  'POST /api/pay/tegoed/roteer': contract('pay.tegoed.roteren',
    'weigert zonder sleutel, roteert een keer en geeft op dezelfde sleutel 409 zonder code'),
  'POST /api/supplier/pay/tegoed/roteer': contract('supplier.pay.tegoed.roteren',
    'is van de manager, roteert een keer en heronthult geen code')
};
module.exports = { CONTRACTEN };
