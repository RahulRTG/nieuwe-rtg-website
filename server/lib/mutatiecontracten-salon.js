/* Nagekeken contracten van de Salon-claimcredential en ledenmedia. */
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
  'POST /api/salon/media': {
    mutatieId: 'salon.media.upload', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: AUTH,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een tweede rauwe upload is een tweede gekozen bestand, ook als de bytes gelijk zijn; elk krijgt een eigen tijdelijk upload-id en verlaten uploads verlopen vanzelf.',
    bewijs: { gemeten: 'test/salon-app.test.js uploadt afzonderlijke foto- en videobestanden en ontvangt voor elk een eigen upload-id', op: '2026-09-19' },
    afgetekend: { door: 'Codex, Salon-mediaflow gelezen en beproefd', op: '2026-09-19' }
  },
  'POST /api/salon/ondertitels': {
    mutatieId: 'salon.media.ondertitels', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' }, toegang: AUTH, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/salon-app.test.js bewaart tijdregels bij één sessiegebonden upload en blokkeert een andere uploader', op: '2026-09-19' },
    afgetekend: { door: 'Codex, Salon-media- en ondertitelflow gelezen en beproefd', op: '2026-09-19' }
  },
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
