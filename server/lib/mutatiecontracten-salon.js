/* Menselijk nagekeken contract van de Salon-claimcredential. */
'use strict';
const AUTH = { klasse: 'AUTHENTICATED' };
const AF = { door: 'Codex, Salon-credentialkern en routeflow gelezen en beproefd', op: '2026-09-05' };
const contract = (id, bewijs) => ({
  mutatieId: id, herkomst: 'mens', semantiek: { klasse: 'sleutelVereist' },
  toegang: AUTH, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/salon-claimcode.test.js ' + bewijs, op: '2026-09-05' },
  afgetekend: AF
});
const CONTRACTEN = {
  'POST /api/salon/deal/claim': contract('salon.deal.claim',
    'geeft één 128-bit code uit en herhaalt haar niet'),
  'POST /api/salon/deal/claim/roteer': contract('salon.deal.claim.roteren',
    'trekt de oude code in en heronthult een rotatieretry niet'),
  'POST /api/salon/deal/claim/intrek': contract('salon.deal.claim.intrekken',
    'trekt de bearer server-side in en houdt herhaling zonder tweede effect veilig'),
  'POST /api/supplier/salon/deal/redeem': contract('supplier.salon.deal.verzilveren',
    'bindt partner, actor, codehash en sleutel en consumeert precies eenmaal')
};
module.exports = { CONTRACTEN };
