'use strict';
// Library owns only its private kernel. These are source contracts, not a public release attestation.
const CONTRACTEN = {};
const reads = ['work/get', 'edition/get', 'publication/preview', 'proof'];
const writes = ['work/create', 'revision/add', 'contribution/invite', 'contribution/accept',
  'agreement/propose', 'agreement/accept', 'agreement/conflict', 'rights/grant', 'rights/revoke',
  'edition/create', 'edition/freeze', 'edition/withdraw', 'edition/warn',
  'publication/consent', 'publication/revoke-consent', 'publication/confirm'];
for (const path of [...reads, ...writes]) {
  const reading = reads.includes(path);
  CONTRACTEN['POST /api/library/' + path] = {
    mutatieId: 'library.' + path.replace('/', '.'), herkomst: 'mens',
    semantiek: { klasse: reading ? 'idempotent' : 'sleutelVereist' }, toegang: { klasse: 'AUTHENTICATED' },
    stand: reading ? 'NOT_APPLICABLE' : 'PROTECTED',
    waarom: reading ? 'Alleen bevoegde deelnemers lezen de bestaande bron; preview schrijft niets.' :
      'Serveractor, Library-policy, verwachte werkrevisie, payloadgebonden operatie-ID en transactie met audit/event/receipt. Geen externe domeinmutatie.',
    nagekeken: 'Codex, LibraryOS-kernel, 2026-10-03; geen certificering van publieke distributie of juridische titel.',
    afgetekend: { door: 'Codex, implementatie en lokale tests op verzoek; geen productievrijgave', op: '2026-10-03' },
    bewijs: { gemeten: 'test/library-kernel.test.js, test/library-http.test.js en test/library-sqlite.test.js: domeingrenzen, editie-instemming, race, replay, herstel en echte routes.', op: '2026-10-03' }
  };
}
module.exports = { CONTRACTEN };
