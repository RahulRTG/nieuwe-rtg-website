'use strict';
// Source ownership, not a replacement for the candidate-bound pilot evidence bundle.
const actie = {
  mutatieId: 'document.lifecycle.v1', herkomst: 'mens', semantiek: { klasse: 'sleutelVereist' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  waarom: 'Only document.trash and document.restore; owner policy before durable replay; state and receipt in one collection transaction.',
  bewijs: { gemeten: 'test/document-capability.test.js and test/document-capability-storage.test.js: owner isolation, semantic conflicts, concurrent requests, SQL rejection and isolated restart. Candidate-bound run results remain in output/document-pilot.', op: '2026-09-22' },
  nagekeken: 'Codex, 2026-09-22; bounded personal-vault pilot, not a complete Documents or release gate.',
  afgetekend: { door: 'Codex, code and local tests; no human release attestation', op: '2026-09-22' }
};
module.exports = { CONTRACTEN: {
  'POST /api/bestanden/actie': actie,
  'POST /api/bestanden/wis': {
    mutatieId: 'bestanden.legacy-purge', herkomst: 'mens', semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'UNTESTABLE',
    waarom: 'Explicit extraction of the previous second /weg effect. Basic owner/state behavior is tested; blob/metadata interruption recovery and backup erasure are NOT proven. Never offered to Rahul.',
    nagekeken: 'Codex, 2026-09-22; intentionally excluded from proven trash/restore scope.',
    afgetekend: { door: 'Codex, legacy behavior separated; release authority pending', op: '2026-09-22' }
  }
} };
