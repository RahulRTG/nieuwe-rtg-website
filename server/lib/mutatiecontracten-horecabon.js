/* Nagekeken contracten van de horecabon en de polsband als credential
   (CODECREDENTIALS.json, deur `horeca.bon_en_polsbandsaldo`,
   kern/horeca/bon*.js). Alleen de twee routes die de migratie toevoegde
   (intrekken, roteren); uitgeven, opwaarderen, afboeken en het koppelen door
   de gast (/api/gast/band) houden hun afgeleide indeling. */
'use strict';
const AUTH = { klasse: 'AUTHENTICATED' };
const AF = { door: 'Claude, horecabonkern en routes gelezen en beproefd', op: '2026-09-27' };
const BEWIJS = 'test/horecabon-routes.test.js en test/horecabon-credential.test.js: ';
const CONTRACTEN = {
  'POST /api/supplier/horeca/bon/roteer': {
    mutatieId: 'supplier.horeca.bon.roteren', herkomst: 'mens', semantiek: { klasse: 'sleutelVereist' },
    toegang: AUTH, stand: 'PROTECTED',
    bewijs: { gemeten: BEWIJS + 'is van de manager, roteert een bon van deze zaak een keer en geeft op dezelfde sleutel 409 zonder code', op: '2026-09-27' },
    afgetekend: AF
  },
  'POST /api/supplier/horeca/bon/intrek': {
    mutatieId: 'supplier.horeca.bon.intrekken', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: AUTH, stand: 'PROTECTED',
    bewijs: { gemeten: BEWIJS + 'intrekken zet ingetrokken_at eenmaal; een tweede keer laat de stand gelijk en het saldo blijft staan', op: '2026-09-27' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
