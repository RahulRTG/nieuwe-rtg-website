'use strict';
const assert = require('node:assert/strict');
const make = require('../../server/kern/library');
const M = require('../../server/kern/library/model');
function fixture() {
  const db = { data: { academy: { untouched: true }, foundation: { untouched: true }, pay: { untouched: true }, talent: { untouched: true } } };
  let fail = '', now = '2026-10-03T10:00:00.000Z', authority = true, tail = Promise.resolve();
  const organizations = { 'entiteit:ent_abcd': 'user-1' };
  const identities = { exists: ref => ['user-1', 'user-2', 'user-3'].includes(ref) || Object.hasOwn(organizations, ref),
    represents: (actor, ref) => actor === ref || organizations[ref] === actor };
  const transaction = (name, fn) => {
    const p = tail.then(() => {
      const state = M.clone(db.data[name] || {}), result = fn(state);
      if (fail === 'before') throw new Error('before commit');
      db.data[name] = state;
      if (fail === 'after') throw new Error('after commit');
      return result;
    });
    tail = p.catch(() => {}); return p;
  };
  const library = make({ db, bewerkCollectie: transaction, store: 'sqlite', identities, now: () => now });
  const raw = (actor, action, input) => library.execute(actor, action, input, () => authority);
  const query = (actor, kind, input) => library.query(actor, kind, input, () => authority);
  return { db, library, raw, query, organizations, identities, transaction,
    fail: x => { fail = x; }, authority: x => { authority = x; }, clock: x => { now = x; } };
}
const terms = (A, B) => ({ parties: [A, B], governance: 'Partijen behouden hun rechten; geen overdracht aan Foundation.',
  decisionRule: 'all-listed-approvers', amendmentRule: 'all-current-and-proposed-parties', departureRule: 'successor-agreement',
  editors: [A], publisher: A, requiredApprovers: [A, B], rightsHolders: [A, B] });
const grant = (workId, from, to, extra = {}) => ({ grantor: from, grantee: to,
  authorityBasis: { kind: 'rights-holder-declaration', statement: 'Ik verklaar bevoegd te zijn voor mijn bijdrage volgens de afspraak.' },
  scope: { type: 'work', id: workId }, actions: ['publish'], purpose: 'publication', languages: ['nl'], territories: ['WORLD'],
  startsAt: '2026-01-01T00:00:00.000Z', endsAt: null, conditions: { attributionRequired: false }, ...extra });
function driver(raw, query, A = 'user-1', B = 'user-2') {
  let workId, serial = 0;
  const key = () => 'library_operation_' + String(++serial).padStart(8, '0');
  const work = async () => { const r = await query(A, 'work', { workId }); assert.equal(r.ok, true, JSON.stringify(r)); return r.work; };
  async function input(action, data, operationId = key()) {
    return { operationId, ...(action === 'work.create' ? {} : { workId, expectedRevision: (await work()).revision }), data };
  }
  async function command(actor, action, data, operationId) {
    const body = await input(action, data, operationId), out = await raw(actor, action, body);
    assert.equal(out.ok, true, action + ': ' + JSON.stringify(out));
    if (action === 'work.create') workId = out.workId;
    return { ...out, input: body };
  }
  async function preview(id) { const r = await query(A, 'preview', { workId, editionId: id }); assert.equal(r.ok, true, JSON.stringify(r)); return r; }
  async function setup() {
    await command(A, 'work.create', { title: 'Geschiedenis van IJmuiden', description: 'Een gezamenlijk werk.', type: 'local-history', language: 'nl' });
    const c = await command(A, 'contribution.invite', { actorRef: B, role: 'illustrator', scope: ['work'], creditName: 'Illustrator B', visibility: 'public' });
    await command(B, 'contribution.accept', { contributionId: c.result.id });
    const a = await command(A, 'agreement.propose', terms(A, B));
    for (const who of [A, B]) await command(who, 'agreement.accept', { agreementId: a.result.id, termsHash: a.result.termsHash });
    const node = await command(A, 'revision.add', { kind: 'chapter', title: 'De haven', content: 'De herinnering zoals opgetekend.', changeSummary: 'Eerste vastlegging.' });
    const grants = [];
    for (const who of [A, B]) grants.push((await command(who, 'rights.grant', grant(workId, who, A))).result.id);
    return { workId, agreementId: a.result.id, nodeId: node.result.nodeId, grants };
  }
  async function edition(predecessorId) {
    const e = await command(A, 'edition.create', { language: 'nl', territory: 'WORLD', changeSummary: predecessorId ? 'Gecorrigeerde editie.' : 'Eerste editie.', ...(predecessorId ? { predecessorId } : {}) });
    await command(A, 'edition.freeze', { editionId: e.result.id }); return e.result.id;
  }
  async function consent(who, id) {
    const p = await preview(id);
    return command(who, 'publication.consent', { editionId: id, snapshotHash: p.snapshotHash, consentDigest: p.consentDigest });
  }
  async function release(id) {
    const p = await preview(id); return command(A, 'publication.confirm', { editionId: id, consentDigest: p.consentDigest });
  }
  return { A, B, raw, query, key, work, input, command, setup, edition, consent, release, preview, id: () => workId };
}
async function fullScenario(d) {
  const setup = await d.setup(), e1 = await d.edition();
  const p1 = await d.preview(e1); assert.deepEqual(p1.missingApprovals, [d.A, d.B]);
  await d.consent(d.A, e1);
  const refused = await d.raw(d.A, 'publication.confirm', await d.input('publication.confirm', { editionId: e1, consentDigest: p1.consentDigest }));
  assert.equal(refused.code, 'APPROVALS_MISSING');
  await d.consent(d.B, e1); const firstRelease = await d.release(e1);
  const old = (await d.query(d.A, 'edition', { workId: setup.workId, editionId: e1 })).edition;
  const bytes = JSON.stringify(old.snapshot);
  await d.command(d.A, 'revision.add', { nodeId: setup.nodeId, title: 'De haven', content: 'De herinnering met gecorrigeerde datum.', changeSummary: 'Datum verbeterd na feedback.' });
  assert.equal(JSON.stringify((await d.query(d.A, 'edition', { workId: setup.workId, editionId: e1 })).edition.snapshot), bytes);
  const e2 = await d.edition(e1), p2 = await d.preview(e2);
  assert.deepEqual(p2.missingApprovals, [d.A, d.B]);
  const stale = await d.raw(d.B, 'publication.consent', await d.input('publication.consent', { editionId: e2, snapshotHash: p1.snapshotHash, consentDigest: p1.consentDigest }));
  assert.equal(stale.code, 'CONSENT_STALE');
  for (const who of [d.A, d.B]) await d.consent(who, e2);
  const released = await d.release(e2);
  assert.equal((await d.raw(d.A, 'publication.confirm', released.input)).replay, true);
  const final = await d.work(); assert.equal(Object.keys(final.releases).length, 2);
  assert.equal(JSON.stringify(final.editions[e1].snapshot), bytes);
  assert.equal(final.editions[e1].contentHash, old.contentHash);
  assert.notEqual(final.editions[e2].contentHash, old.contentHash);
  assert.equal(final.nodes[setup.nodeId].revisions.length, 2);
  const proof = await d.query(d.A, 'proof', { workId: setup.workId }); assert.equal(proof.integrity, true);
  for (const name of ['library.work.created', 'library.contribution.accepted', 'library.agreement.accepted', 'library.edition.frozen', 'library.publication.released'])
    assert.ok(proof.events.some(e => e.type === name), name);
  assert.ok(proof.events.every(e => e.envelop.correlatie && e.envelop.classificatie === 'persoonsgegeven'));
  return { ...setup, e1, e2, bytes, firstRelease, released };
}
module.exports = { fixture, driver, fullScenario, terms, grant };
