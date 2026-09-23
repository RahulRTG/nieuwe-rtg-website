'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { CONTRACTEN, versie, policyDigest, afdruk } = require('../server/kern/document-contracten');
const factory = require('../server/kern/document-capability');
function fixture() {
  const item = { id: 'synthetic', naam: 'private.txt', ref: 'blob', weg: false, versies: [], gedeeldMet: ['other'] };
  const all = { 'lid:owner': { items: [item] } };
  const execute = factory({ store: 'sqlite', bewerkCollectie: (_, fn) => fn(all), leesBytes: () => Buffer.from('bytes'), nu: () => '2026-09-22T00:00:00Z' });
  const input = (cap = 'documents.trash') => ({ capability: cap, contractVersion: 1, id: item.id, expectedVersion: versie(item), operationId: randomUUID() });
  return { all, item, execute, input };
}
test('versioned contracts are complete, immutable and content-addressed', () => {
  const required = ['intent','actor','resource','input','output','preconditions','authorization','state_before','state_transition','state_after','invariants','idempotency','concurrency_semantics','failure_semantics','recovery_semantics','audit_requirements','privacy_requirements','interface_requirements'];
  assert.deepEqual(Object.keys(CONTRACTEN), ['documents.trash','documents.restore']);
  for (const c of Object.values(CONTRACTEN)) {
    for (const key of required) assert.ok(c[key], c.id + ':' + key);
    assert.equal(c.capability_id, c.id + '@1');
    const { digest, ...meaning } = c; assert.equal(digest, afdruk(meaning));
    assert.throws(() => { c.authorization.policy = 'anyone'; }, TypeError);
  }
});
test('model sequences preserve owner, lifecycle, replay, stale and audit invariants', async () => {
  // Exhaustive bounded sequences, not random happy paths; the model is independent of the handler.
  const actions = ['trash','restore','unauthorized','stale','replay'];
  let sequences = [[]];
  for (let i = 0; i < 4; i++) sequences = sequences.flatMap(seq => actions.map(a => seq.concat(a)));
  for (const sequence of sequences) {
    const f = fixture(); let active = true, revision = 0, operations = 0, previous;
    for (const action of sequence) {
      const before = JSON.stringify(f.all), cap = action === 'restore' ? 'documents.restore' : 'documents.trash';
      const b = action === 'replay' && previous ? previous : f.input(cap);
      if (action === 'stale') b.expectedVersion = '0'.repeat(64);
      const r = await f.execute(action === 'unauthorized' ? 'other' : 'owner', b, () => true);
      if (action === 'unauthorized' || action === 'stale' || (action === 'restore' && active)) {
        assert.equal(r.code, action === 'unauthorized' ? 'not_found' : action === 'stale' ? 'version_conflict' : 'invalid_state');
        assert.equal(JSON.stringify(f.all), before);
      } else if (action === 'replay' && previous) {
        assert.equal(r.herhaald, true); assert.equal(JSON.stringify(f.all), before);
        assert.equal(r.resource.state, active ? 'active' : 'trashed');
      } else {
        assert.equal(r.ok, true); assert.equal(r.policy.digest, policyDigest);
        const next = cap === 'documents.restore'; if (next !== active) revision++;
        assert.equal(r.effect.changed, next !== active); active = next; operations++; previous = b;
        assert.equal(r.contractDigest, CONTRACTEN[cap].digest);
      }
      assert.equal(f.item.weg, !active); assert.equal(f.item.documentRevision || 0, revision);
      assert.equal(Object.keys(f.all['lid:owner'].documentOperations || {}).length, operations);
      assert.deepEqual(f.item.gedeeldMet, ['other']); assert.equal(f.item.ref, 'blob');
    }
  }
});
test('authorization is required inside the transaction, including revocation while queued', async () => {
  const f = fixture(); let allowed = true, release;
  const execute = factory({ store: 'postgres', bewerkCollectie: (_, fn) => new Promise(resolve => { release = () => resolve(fn(f.all)); }), leesBytes: () => true, nu: () => 'time' });
  const pending = execute('owner', f.input(), () => allowed);
  allowed = false; release();
  assert.equal((await pending).code, 'authority_revoked'); assert.equal(f.item.weg, false);
  assert.equal((await f.execute('owner', f.input())).code, 'authority_revoked');
  assert.equal(f.all['lid:owner'].documentOperations, undefined);
  const unavailable = factory({ store: 'unsupported' });
  const failed = await unavailable('owner', f.input());
  assert.equal(failed.status, 503);
  assert.equal(failed.policy.decision, 'NOT_EVALUATED', 'a check never performed must not attest ALLOW');
});
test('browser transport retains operation identity across failed/delayed delivery and protects newer projections', async () => {
  const w = { crypto: { randomUUID } }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/document-capability.js'), 'utf8'), { window: w });
  const file = { id: 'synthetic', documentVersion: 'a'.repeat(64), weg: false }, sent = [];
  const retry = async (_, body) => { sent.push(JSON.parse(JSON.stringify(body))); return { status: 503, body: {} }; };
  await w.RTGDocumentCapability(retry, 'documents.trash', file);
  await w.RTGDocumentCapability(retry, 'documents.trash', file);
  assert.equal(sent[0].operationId, sent[1].operationId);
  let done; const delayed = w.RTGDocumentCapability((_, body) => { sent.push(body); return new Promise(resolve => { done = resolve; }); }, 'documents.trash', file);
  file.documentVersion = 'b'.repeat(64); file.weg = false;
  done({ status: 200, body: { ok: true, resource: { version: 'c'.repeat(64), state: 'trashed' } } }); await delayed;
  assert.equal(file.documentVersion, 'b'.repeat(64)); assert.equal(file.weg, false);
  assert.equal(sent[2].operationId, sent[0].operationId);
});
test('Edge completion waits for the operation; rejected effects are never announced as completed', async () => {
  for (const success of [false, true]) {
    let resolve, reject; const notifications = [];
    const pending = new Promise((a, b) => { resolve = a; reject = b; });
    const w = { RTGGrammatica: require('../public/shared/adaptief/grammatica.js'), RTGAdaptief: { doe: () => pending }, RTGRail: { meld: x => notifications.push(x.tekst) } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/adaptief/gewicht.js'), 'utf8'), { window: w, document: {} });
    assert.equal(w.RTGGewicht.voer({ id: 'documents.trash', naam: 'Trash', gewicht: 'terug', ongedaan() {} }), true);
    assert.deepEqual(notifications, []);
    if (success) resolve(); else reject(Error('isolated failure'));
    await new Promise(done => setImmediate(done));
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0], success ? 'Trash gedaan' : 'De handeling is niet bevestigd. Controleer de actuele toestand.');
  }
});
