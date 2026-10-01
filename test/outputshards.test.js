'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const S = require('../scripts/lib/outputshards');
const B = require('../scripts/lib/outputbinding');
const { aggregate } = require('../scripts/lib/outputaggregate');
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
function fixture(t) {
  const root = temporary(t), candidate = path.join(root, 'candidate'), shards = path.join(root, 'shards');
  const dir = path.join(shards, 'shard0'); fs.mkdirSync(candidate); fs.mkdirSync(dir, { recursive: true });
  const row = { route: 'POST /api/documents', toets: 'documents.test.js', testSha256: 'c'.repeat(64) };
  const prior = { perRoute: { [row.route]: { staat: 'onbeslist' } }, gericht: {} };
  S.write(path.join(candidate, 'OUTPUTPROEF.json'), prior);
  const binding = S.seal({ commit: 'a'.repeat(40), runtime: process.version, runtimeSha256: 'd'.repeat(64) });
  const plan = S.seal({ candidate: { commit: binding.commit }, runner: { commit: 'b'.repeat(40), tree: 'e'.repeat(40) }, binding,
    rows: [row], excluded: [], historicalUnseen: [], shards: S.partition([row], 1),
    historicalRegisterSha256: S.hash(fs.readFileSync(path.join(candidate, 'OUTPUTPROEF.json'))) });
  const prefix = S.hash(row.route), mutationTap = 'not ok 1 - detects changed output\n# tests 1\n# skipped 0\n';
  const controlTap = 'ok 1 - checks real output\n# tests 1\n# skipped 0\n';
  function execution(kind, tap, status, gezakt) {
    fs.writeFileSync(path.join(dir, prefix + '-' + kind + '.tap'), tap);
    fs.writeFileSync(path.join(dir, prefix + '-' + kind + '.stderr'), '');
    return { toetsen: 1, overgeslagen: 0, status, gezakt, signal: null, error: null, tijdout: false,
      stdoutSha256: S.hash(tap), stderrSha256: S.hash('') };
  }
  const mutation = execution('mutation', mutationTap, 1, 1), control = execution('control', controlTap, 0, 0);
  const hits = 'POST /api/documents'; fs.writeFileSync(path.join(dir, prefix + '.hits'), hits + '\n');
  const result = { ...row, staat: 'merkt', merkt: true, provenance: 'CURRENT_CANDIDATE', plan: plan.id,
    binding: binding.id, evidenceCommit: binding.commit, evidence: { mutation, control, changedResponses: 1, hitDigest: S.hash(hits) } };
  const save = () => {
    S.write(path.join(dir, prefix + '.json'), result);
    const files = Object.fromEntries(fs.readdirSync(dir).filter(f => f !== 'SHARD.json')
      .map(f => [f, S.hash(fs.readFileSync(path.join(dir, f)))]));
    S.write(path.join(dir, 'SHARD.json'), S.seal({ index: 0, plan: plan.id, candidate: binding.commit,
      runner: plan.runner, binding: binding.id, runtime: binding.runtime, runtimeSha256: binding.runtimeSha256,
      files, results: [prefix + '.json'], baselines: {} }));
  };
  save(); return { root, candidate, dir, shards, plan, row, result, prefix, save };
}
test('aggregate verifies preserved mutation/control and emits current proof separately from history', t => {
  const f = fixture(t), out = path.join(f.root, 'proof');
  assert.equal(aggregate({ candidate: f.candidate, B }, f.plan, f.shards, out), true);
  const proof = S.read(path.join(out, 'OUTPUTPROEF.json'));
  assert.equal(proof.gemeten.bewezen, 1);
  assert.equal(B.outputCell(proof.perRoute[f.row.route], proof, f.row.route).staat, 'bewezen');
  assert.equal(S.read(path.join(f.candidate, 'OUTPUTPROEF.json')).perRoute[f.row.route].staat, 'onbeslist', 'source was not changed');
  assert.equal(S.read(path.join(out, 'STATUS.json')).releaseReadiness, 'NOT_EVALUATED');
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
