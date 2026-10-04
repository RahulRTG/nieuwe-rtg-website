'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const S = require('../scripts/lib/outputshards');
const B = require('../scripts/lib/outputbinding');
const { aggregate } = require('../scripts/lib/outputaggregate');
const { fixture } = require('./lib/outputshards-fixture');
const debt = require('../scripts/bewijsschuld').POSTEN;
const debtCount = (register, id) => debt.find(p => p.id === id).uit({ output: register });
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-outputshards-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
test('shards conserve every route exactly once, including single-route tests', () => {
  const rows = Array.from({ length: 31 }, (_, n) => ({ route: `GET /api/${n}`, toets: `${n % 7}.test.js` }));
  const parts = S.partition(rows, 8), actual = parts.flatMap(p => p.groups.flatMap(g => g.routes));
  S.exactRoutes(rows, actual);
  assert.equal(parts.reduce((n, p) => n + p.routes, 0), rows.length);
  const tests = parts.flatMap(p => p.groups.map(g => g.toets));
  assert.equal(new Set(tests).size, tests.length, 'only one shard may reuse a test baseline');
  assert.deepEqual(S.partition(rows, 8), parts, 'deterministic assignment');
  assert.throws(() => S.partition([...rows, rows[0]], 8), /Duplicate/);
  assert.throws(() => S.exactRoutes(rows, actual.slice(1)), /Missing/);
  assert.throws(() => S.exactRoutes(rows, [...actual, actual[0]]), /Duplicate/);
});
test('selection remeasures single-route inference and explicitly records instrument boundaries', t => {
  const dir = temporary(t); fs.mkdirSync(path.join(dir, 'test'));
  fs.writeFileSync(path.join(dir, 'test/a.test.js'), 'original candidate test');
  const k = { perRoute: new Map([
    ['GET /api/one', new Set(['a.test.js'])], ['GET /api/auth/me', new Set(['a.test.js'])],
    ['GET /apps/page.html', new Set(['a.test.js'])], ['GET /api/unknown', new Set(['unknown.e2e.js'])]
  ]), perToets: new Map([['a.test.js', new Set(['GET /api/one'])]]) };
  const picked = S.choose(k, new Set(['a.test.js']), ['/api/auth'], new Set(), dir);
  assert.equal(picked.rows.length, 1); assert.equal(picked.rows[0].width, 1);
  assert.equal(picked.rows[0].testSha256, S.hash('original candidate test'));
  assert.deepEqual(picked.excluded.map(r => r.reason).sort(),
    ['AUTHENTICATION_DOOR', 'NO_ATTRIBUTED_SENSITIVE_SERVER_TEST', 'OUTSIDE_MUTATOR'].sort());
});
test('seal refuses changed candidate, shard assignment or preserved evidence bytes', () => {
  const value = S.seal({ candidate: 'a'.repeat(40), rows: ['one'] });
  assert.equal(S.verifySeal(value), value);
  assert.throws(() => S.verifySeal({ ...value, candidate: 'b'.repeat(40) }), /identity/);
  assert.throws(() => S.verifySeal({ ...value, rows: ['two'] }), /identity/);
});
test('aggregate verifies preserved mutation/control and emits current proof separately from history', t => {
  const f = fixture(t), out = path.join(f.root, 'proof');
  assert.equal(aggregate({ candidate: f.candidate, B }, f.plan, f.shards, out), true);
  const proof = S.read(path.join(out, 'OUTPUTPROEF.json'));
  assert.equal(proof.gemeten.bewezen, 1);
  assert.equal(debtCount(proof, 'output-niet-toerekenbaar'), 0, 'a current caught mutation repays its route debt');
  assert.equal(B.outputCell(proof.perRoute[f.row.route], proof, f.row.route).staat, 'bewezen');
  assert.equal(S.read(path.join(f.candidate, 'OUTPUTPROEF.json')).perRoute[f.row.route].staat, 'onbeslist', 'source was not changed');
  assert.equal(S.read(path.join(out, 'STATUS.json')).releaseReadiness, 'NOT_EVALUATED');
});
test('failure, exclusion and missing attribution preserve existing debt in the actual consumer', t => {
  for (const kind of ['stoornis', 'excluded', 'unseen']) {
    const f = fixture(t), out = path.join(f.root, 'proof');
    if (kind === 'stoornis') {
      f.result.staat = 'stoornis'; f.result.merkt = false; f.result.reden = 'isolated worker interrupted';
      delete f.result.evidence; f.save();
    } else {
      const { id, ...body } = f.plan;
      Object.assign(f.plan, S.seal({ ...body, rows: [], shards: S.partition([], 1),
        excluded: kind === 'excluded' ? [{ route: f.row.route, reason: 'NO_ATTRIBUTED_SENSITIVE_SERVER_TEST', tests: [] }] : [],
        historicalUnseen: kind === 'unseen' ? [f.row.route] : [] }));
      const { id: shardId, ...shard } = S.read(path.join(f.dir, 'SHARD.json'));
      S.write(path.join(f.dir, 'SHARD.json'), S.seal({ ...shard, plan: f.plan.id, results: [] }));
    }
    aggregate({ candidate: f.candidate, B }, f.plan, f.shards, out);
    const proof = S.read(path.join(out, 'OUTPUTPROEF.json'));
    assert.equal(proof.perRoute[f.row.route].staat, 'onbeslist', kind);
    assert.equal(debtCount(proof, 'output-niet-toerekenbaar'), 1, kind + ' is not repayment');
    assert.equal(proof.gemeten.bewezen, 0);
    assert.equal(S.read(path.join(out, 'STATUS.json')).unresolved.retainedDebt, 1);
  }
});
test('an observed blind output transfers debt to the separate blind counter', t => {
  const f = fixture(t), out = path.join(f.root, 'proof');
  f.result.staat = 'blind'; f.result.merkt = false;
  const tap = 'ok 1 - does not detect changed output\n# tests 1\n# skipped 0\n';
  fs.writeFileSync(path.join(f.dir, f.prefix + '-mutation.tap'), tap);
  Object.assign(f.result.evidence.mutation, { status: 0, gezakt: 0, stdoutSha256: S.hash(tap) });
  f.save();
  assert.equal(aggregate({ candidate: f.candidate, B }, f.plan, f.shards, out), false);
  const proof = S.read(path.join(out, 'OUTPUTPROEF.json'));
  assert.equal(debtCount(proof, 'output-niet-toerekenbaar'), 0);
  assert.equal(debtCount(proof, 'output-blind'), 1, 'observed blindness remains engineering debt');
});
test('new unattributed routes remain explicit unmeasured gaps without claiming historical repayment', t => {
  const f = fixture(t), out = path.join(f.root, 'proof');
  const { id, ...body } = f.plan;
  Object.assign(f.plan, S.seal({ ...body,
    excluded: [{ route: 'GET /api/new', reason: 'NO_ATTRIBUTED_SENSITIVE_SERVER_TEST', tests: [] }] }));
  f.result.plan = f.plan.id; f.save();
  aggregate({ candidate: f.candidate, B }, f.plan, f.shards, out);
  const proof = S.read(path.join(out, 'OUTPUTPROEF.json'));
  assert.equal(proof.perRoute['GET /api/new'].staat, 'ongemeten');
  assert.equal(proof.perRoute['GET /api/new'].measurementState, 'EXCLUDED');
  assert.equal(proof.gemeten.ongemeten, 1);
  assert.equal(S.read(path.join(out, 'STATUS.json')).unresolved.otherUnmeasured, 1);
});
test('forged PASS counters cannot replace raw TAP and a real changed response', t => {
  const f = fixture(t);
  f.result.evidence.mutation.toetsen = 800;
  assert.throws(() => S.verifyResult(f.row, f.result, f.plan, f.dir, B), /counters/);
  f.result.evidence.mutation.toetsen = 1;
  f.result.evidence.changedResponses = 2;
  assert.throws(() => S.verifyResult(f.row, f.result, f.plan, f.dir, B), /hit mismatch/);
});
test('wrong candidate and modified artifact bytes are rejected even when state says merkt', t => {
  const f = fixture(t);
  assert.throws(() => S.verifyResult(f.row, { ...f.result, evidenceCommit: 'f'.repeat(40) }, f.plan, f.dir, B), /binding/);
  fs.appendFileSync(path.join(f.dir, f.prefix + '-control.tap'), 'tampered');
  assert.throws(() => aggregate({ candidate: f.candidate, B }, f.plan, f.shards, path.join(f.root, 'proof')), /bytes changed/);
});
test('a failed or missing control cannot certify a caught mutation', t => {
  const f = fixture(t); delete f.result.evidence.control; f.save();
  assert.throws(() => aggregate({ candidate: f.candidate, B }, f.plan, f.shards, path.join(f.root, 'proof')), /passing control/);
});
test('missing shard and path traversal cannot be read as complete evidence', t => {
  const f = fixture(t);
  assert.throws(() => aggregate({ candidate: f.candidate, B },
    { ...f.plan, shards: [...f.plan.shards, { index: 1, groups: [] }] }, f.shards, path.join(f.root, 'proof')), /Missing/);
  assert.throws(() => S.fileWithin(f.dir, '../candidate/OUTPUTPROEF.json'), /Unsafe/);
});
