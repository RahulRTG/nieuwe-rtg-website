'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const S = require('../scripts/lib/outputshards');
const B = require('../scripts/lib/outputbinding');
const { aggregate } = require('../scripts/lib/outputaggregate');
const { fixture } = require('./lib/outputshards-fixture');
const debt = require('../scripts/bewijsschuld').POSTEN;
const debtCount = (register, id) => debt.find(p => p.id === id).uit({ output: register });

test('planRun requires all fifteen distinct successful CI journal sources', t => {
  // Synthetic candidate isolates the planner contract; it is not runtime proof.
  const candidate = fs.realpathSync(temporary(t)), sha = 'a'.repeat(40);
  fs.mkdirSync(path.join(candidate, 'scripts/lib'), { recursive: true });
  fs.writeFileSync(path.join(candidate, 'scripts/lib/outputbinding.js'),
    "exports.binding = journal => ({ id: 'synthetic-binding', journal });\n");
  fs.writeFileSync(path.join(candidate, 'scripts/outputproef.js'),
    'exports.koppeling = () => ({ perRoute: new Map(), perToets: new Map() });\n' +
    'exports.gevoeligheid = () => ({ gevoelig: new Set() });\n' +
    'exports.teDun = () => null; exports.infrastructuur = () => new Set();\n');
  fs.writeFileSync(path.join(candidate, 'scripts/mutatie.js'), "exports.DEUREN = '/api/auth';\n");
  S.write(path.join(candidate, 'OUTPUTPROEF.json'), { perRoute: {} });
  t.mock.method(S, 'identity', cwd => ({ commit: cwd === candidate ? sha : (process.env.GITHUB_SHA || 'b'.repeat(40)), tree: 'c'.repeat(40) }));
  const sources = [
    ...[1, 2, 3, 4].map(n => ({ artifact: 'routejournaal-scherf-' + n,
      jobName: 'Toetsscherf ' + n + ' van 4', testStep: 'Deze scherf, met dekking als lcov' })),
    ...['boot-smoke', 'grens-sweep', 'keuring', 'klok', 'meterijk', 'zaakdoos'].map(n => ({ artifact: 'routejournaal-ijking-' + n,
      jobName: 'De ijking - ' + n, testStep: 'De ijking draaien (een bestand, alleen op deze machine)' })),
    ...[1, 2, 3, 4, 5].map(n => ({ artifact: 'schermjournaal-deel-' + n,
      jobName: 'Schermtoetsen deel ' + n + ' van 5', testStep: 'Scherm-tests (PDA in de browser)' }))
  ].map(s => ({ ...s, testConclusion: 'success' }));
  const journal = path.join(candidate, 'journal.log');
  const plan = rows => {
    S.write(journal + '.provenance.json', { sources: rows });
    return require('../scripts/outputproof').planRun(candidate, sha, journal, path.join(candidate, 'plan'));
  };
  assert.equal(plan(sources).candidate.commit, sha, 'the complete producer inventory reaches planning');
  for (const change of [rows => rows.pop(), rows => { rows[14] = { ...rows[13] }; },
    rows => rows.push({ ...rows[0], artifact: 'unexpected' }),
    rows => { rows[14].artifact = 'unexpected'; },
    rows => { rows[14].testConclusion = 'failure'; },
    rows => { delete rows[14].testConclusion; },
    rows => { rows[14].jobName = rows[13].jobName; },
    rows => { rows[14].testStep = 'Other execution'; }]) {
    const changed = structuredClone(sources); change(changed);
    assert.throws(() => plan(changed), /CI journals/, 'missing, duplicated, unknown or failed evidence cannot replace a required source');
  }
  assert.throws(() => plan(null), /CI journals/);
});

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
