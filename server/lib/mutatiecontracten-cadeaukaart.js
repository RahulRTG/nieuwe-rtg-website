/* Nagekeken contracten van de cadeaukaart als credential (CODECREDENTIALS.json,
   deur `pay.giftcard_value_code`, kern/cadeaukaart.js). Alleen de drie routes
   die de migratie toevoegde staan hier; koop, verkoop, overzicht en
   inwisseling houden hun eerdere indeling. */
'use strict';
const AUTH = { klasse: 'AUTHENTICATED' };
const AF = { door: 'Claude, cadeaukaartkern en routes gelezen en beproefd', op: '2026-09-27' };
const BEWIJS = 'test/giftcard-routes.test.js en test/giftcard-credential.test.js 5: ';
const CONTRACTEN = {
  'POST /api/giftcard/roteer': {
    mutatieId: 'giftcard.roteren', herkomst: 'mens', semantiek: { klasse: 'sleutelVereist' },
    toegang: AUTH, stand: 'PROTECTED',
    bewijs: { gemeten: BEWIJS + 'weigert zonder sleutel, roteert alleen een eigen kaart een keer en geeft op dezelfde sleutel 409 zonder code', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/supplier/giftcard/roteer': {
    mutatieId: 'supplier.giftcard.roteren', herkomst: 'mens', semantiek: { klasse: 'sleutelVereist' },
    toegang: AUTH, stand: 'PROTECTED',
    bewijs: { gemeten: BEWIJS + 'is van de manager, roteert een kaart van deze zaak een keer en heronthult geen code', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/supplier/giftcard/intrek': {
    mutatieId: 'supplier.giftcard.intrekken', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: AUTH, stand: 'PROTECTED',
    bewijs: { gemeten: BEWIJS + 'intrekken zet ingetrokken_at eenmaal; een tweede keer laat de stand gelijk en het saldo blijft staan', op: '2026-09-27' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
