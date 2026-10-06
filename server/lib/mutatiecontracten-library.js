'use strict';
// Library owns only its private kernel. These are source contracts, not a public release attestation.
const CONTRACTEN = {};
const reads = ['context', 'work/list', 'work/get', 'edition/get', 'publication/preview', 'studio/workspace',
  'feedback/list', 'education/get', 'reader/open', 'reader/state', 'reader/proof', 'reader/search', 'proof'];
const writes = ['work/create', 'revision/add', 'contribution/invite', 'contribution/accept',
  'agreement/propose', 'agreement/accept', 'agreement/conflict', 'rights/grant', 'rights/revoke',
  'structure/reorder', 'edition/create', 'edition/freeze', 'edition/withdraw', 'edition/warn',
  'publication/consent', 'publication/revoke-consent', 'publication/confirm',
  'feedback/create', 'feedback/decide', 'feedback/resolve', 'education/release', 'education/withdraw', 'reader/progress', 'reader/bookmark',
  'reader/bookmark/remove', 'reader/highlight', 'reader/highlight/remove', 'reader/note', 'reader/note/remove'];
for (const path of [...reads, ...writes]) {
  const reading = reads.includes(path);
  CONTRACTEN['POST /api/library/' + path] = {
    mutatieId: 'library.' + path.replace('/', '.'), herkomst: 'mens',
    semantiek: { klasse: reading ? 'idempotent' : 'sleutelVereist' }, toegang: { klasse: 'AUTHENTICATED' },
    stand: reading ? 'NOT_APPLICABLE' : 'PROTECTED',
    waarom: reading ? 'Alleen bevoegde deelnemers lezen de bestaande bron; preview schrijft niets.' :
      'Serveractor, Library-policy, verwachte werkrevisie, payloadgebonden operatie-ID en transactie met audit/event/receipt. Geen externe domeinmutatie.',
    nagekeken: 'Codex, LibraryOS-kernel, 2026-10-05; geen certificering van publieke distributie of juridische titel.',
    afgetekend: { door: 'Codex, implementatie en lokale tests op verzoek; geen productievrijgave', op: '2026-10-05' },
    bewijs: { gemeten: 'test/library-kernel.test.js, test/library-academy-release.test.js, test/library-http.test.js en test/library-sqlite.test.js: domeingrenzen, edition-bound release, authority, withdrawal, race, replay en herstel.', op: '2026-10-05' }
  };
}
module.exports = { CONTRACTEN };
