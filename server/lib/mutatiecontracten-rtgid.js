/* Menselijk nagekeken contract van de RTG-iD-koppelcredential. */
'use strict';
const PUBLIEK = { klasse: 'PUBLIC', waarom: 'een 128-bit doelgebonden statuscredential is de beperkte autoriteit van de vragende dienst' };
const LID = { klasse: 'AUTHENTICATED' };
const AF = { door: 'Codex, RTG-iD lifecycle en passkeyflow gelezen en beproefd', op: '2026-09-05' };
const contract = (id, klasse, toegang, bewijs, stand = 'PROTECTED', waarom) => ({
  mutatieId: id, herkomst: 'mens', semantiek: { klasse }, toegang, stand,
  ...(waarom ? { waarom } : {}),
  bewijs: { gemeten: 'test/rtgid-credential.test.js ' + bewijs, op: '2026-09-05' },
  afgetekend: AF
});
const CONTRACTEN = {
  'POST /api/rtgid/start': contract('rtgid.start', 'sleutelVereist', PUBLIEK,
    'bindt één vraag aan één sleutel en herhaalt geen van beide kale credentials'),
  'POST /api/rtgid/status': contract('rtgid.status', 'nietHerhaalbaar', PUBLIEK,
    'levert het id-tokenlabel eenmaal en telt iedere geldige poll', 'INTENTIONALLY_NON_IDEMPOTENT',
    'statuspolls zijn echte credentialgebruiken; alleen de eerste bevestigde poll markeert aflevering'),
  'POST /api/rtgid/roteer': contract('rtgid.roteren', 'sleutelVereist', PUBLIEK,
    'vervangt code en statuscredential atomair en heronthult ze niet bij retry'),
  'POST /api/rtgid/annuleer': contract('rtgid.annuleren', 'sleutelVereist', PUBLIEK,
    'trekt beide credentials server-side in; retry heeft dezelfde gesloten uitkomst'),
  'POST /api/rtgid/wie': contract('rtgid.wie', 'nietHerhaalbaar', PUBLIEK,
    'telt iedere gegevensophaling en schrijft vanaf de tweede één inzagespoor', 'INTENTIONALLY_NON_IDEMPOTENT',
    'iedere ophaling is een echte inzage en moet voor het lid meetellen'),
  'POST /api/rtgid/koppel': contract('rtgid.koppel', 'idempotent', LID,
    'registreert hoogstens één kijkerhash en deelt nog geen identiteit'),
  'POST /api/rtgid/bevestig': contract('rtgid.bevestigen', 'idempotent', LID,
    'vereist passkey en laat bij gelijktijdige bevestiging exact één statusovergang toe'),
  'POST /api/rtgid/weiger': contract('rtgid.weigeren', 'idempotent', LID,
    'sluit de koppelcode eenmalig en geeft daarna geen toegang')
};
module.exports = { CONTRACTEN };
