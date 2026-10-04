'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const M = require('../scripts/mutationproof-model');
const { canaryProof } = require('../scripts/mutationproof-evidence');
const { fixture } = require('./mutationproof-fixture');
test('host canary fails the job even when a zero-call preparation failure exits its container successfully', async t => {
  const vm = require('node:vm'), { EventEmitter } = require('node:events');
  const { temp } = require('./mutationproof-fixture'), { cancellation } = require('../scripts/mutationproof-process');
  const root = temp(t), output = path.join(root, 'out'), signals = new EventEmitter();
  const candidate = { commit: 'a'.repeat(40) }, runner = { commit: 'b'.repeat(40) }, runtime = { fixture: true };
  const plan = M.seal({ candidate, runner, canary: { name: 'fixture.test.js', testSha256: 'e'.repeat(64) },
    shards: [], limits: { shardMinutes: 120 } });
  const planPath = path.join(root, 'PLAN.json'); M.write(planPath, plan);
  let started = 0;
  const context = { module: { exports: {} }, __dirname: path.resolve(__dirname, '../scripts'), console: { log() {} },
    process: { env: { GITHUB_ACTIONS: 'true' } }, require(id) {
      if (id === './mutationproof-model') return M;
      if (id === './mutationproof-plan') return { setup: () => ({ candidate: root, source: candidate, runner }),
        checkPlan() {}, planRun() {}, empty(dir) { fs.mkdirSync(dir); } };
      if (id === './mutationproof-aggregate') return {};
      if (id === './mutationproof-evidence') return { canaryProof };
      if (id === './mutationproof-runtime') return { prepared: () => runtime, verifyPrepared() {} };
      if (id === 'node:child_process') return { execFileSync: () => 'sha256:' + 'f'.repeat(64) };
      if (id === './mutationproof-process') return { cancellation: () => cancellation(signals), async runContainer(args, name, dir) {
        started++; fs.writeFileSync(path.join(dir, 'container.stdout'), ''); fs.writeFileSync(path.join(dir, 'container.stderr'), '');
        fs.writeFileSync(path.join(dir, 'calls.jsonl'), '');
        M.write(path.join(dir, 'CASE.json'), M.seal({ plan: plan.digest, candidate, runner, test: plan.canary.name,
          testSha256: plan.canary.testSha256, calls: [], error: 'dubious ownership', motorExit: 0, sourceRestored: false,
          verdict: { passed: true }, files: { 'calls.jsonl': M.hash('') } }));
        return { exitCode: 0 };
      } };
      return require(id);
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/mutationproof.js'), 'utf8'), context);
  await assert.rejects(context.module.exports.runShard(root, candidate.commit, planPath, 'canary', output), /Linux canary did not prove/);
  const result = M.verify(M.read(path.join(output, 'CANARY.json')));
  assert.equal(started, 1); assert.equal(result.proof.passed, false); assert.equal(result.proof.measured, false);
  assert.equal(fs.existsSync(path.join(output, 'SHARD.json')), false, 'canary never masquerades as a discovery shard');
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});
test('canary requires bound real baseline, assertion-detected mutation and restored run; no green exit shortcut', t => {
  const { dir, evidence } = fixture(t);
  const candidate = { commit: 'a'.repeat(40), tree: 'b'.repeat(40) }, runner = { commit: 'c'.repeat(40), tree: 'd'.repeat(40) };
  const subject = { name: 'fixture.test.js', testSha256: M.hash(fs.readFileSync(path.join(dir, 'fixture.test.js'))) };
  const plan = M.seal({ candidate, runner, canary: subject });
  const runtime = M.seal({ fixture: 'prepared runtime binding' }), ctx = { candidate: dir };
  const row = { test: subject.name, directory: M.hash(subject.name), state: 'COLLECTED', execution: { exitCode: 0 } };
  function publish(delta = {}) {
    const e = { ...evidence, candidate, runner, plan: plan.digest, test: subject.name, testSha256: subject.testSha256, preparedRuntime: runtime, ...delta };
    fs.writeFileSync(path.join(dir, 'calls.jsonl'), e.calls.map(c => JSON.stringify(c)).join('\n') + '\n');
    e.files = Object.fromEntries(fs.readdirSync(dir).filter(p => p !== 'CASE.json' && fs.statSync(path.join(dir, p)).isFile())
      .map(p => [p, M.hash(fs.readFileSync(path.join(dir, p)))]));
    M.write(path.join(dir, 'CASE.json'), M.seal(e));
  }
  const proof = (override = {}) => canaryProof(ctx, plan, { ...row, ...override }, runtime, dir);
  publish(); assert.equal(proof().passed, true);
  publish({ error: 'dubious ownership', calls: [], verdict: { measured: true, passed: true } });
  assert.equal(proof().passed, false, 'green container and fabricated verdict cannot hide zero calls');
  publish({ error: 'failure after otherwise passing calls' }); assert.equal(proof().passed, false);
  publish({ calls: evidence.calls.filter(c => c.phase !== 'restored') }); assert.equal(proof().passed, false);
  publish({ sourceRestored: false }); assert.equal(proof().passed, false);
  publish(); assert.equal(proof({ execution: { exitCode: 0, interrupted: true } }).passed, false);
  publish({ candidate: { ...candidate, commit: 'e'.repeat(40) } }); assert.throws(proof, /subject mismatch/);
  publish({ preparedRuntime: { fixture: 'different binary' } }); assert.throws(proof, /executable provenance/);
  publish(); fs.appendFileSync(path.join(dir, '2.tap'), '\nchanged'); assert.throws(proof, /Evidence file changed/);
});
test('Linux canary is a mandatory dependency before any shard or aggregate, with independent raw evidence', () => {
  const wf = fs.readFileSync(path.join(__dirname, '../.github/workflows/mutationproof.yml'), 'utf8');
  const canary = wf.slice(wf.indexOf('  canary:\n'), wf.indexOf('  shards:\n'));
  const shards = wf.slice(wf.indexOf('  shards:\n'), wf.indexOf('  aggregate:\n'));
  const aggregate = wf.slice(wf.indexOf('  aggregate:\n'));
  assert.match(canary, /runs-on: ubuntu-24\.04/);
  assert.match(canary, /node tooling\/scripts\/mutationproof\.js canary candidate/);
  assert.match(canary, /docker build --build-arg NODE_VERSION=/);
  assert.match(canary, /if: always\(\)\n\s+uses: actions\/upload-artifact/);
  assert.match(shards, /needs: \[plan, canary\]/);
  assert.doesNotMatch(shards, /^    if: always|continue-on-error/m);
  assert.match(aggregate, /needs: \[plan, canary, shards\]/);
  assert.match(aggregate, /needs\.canary\.result == 'success'/);
  assert.match(aggregate, /name: mutation-canary-/);
  assert.doesNotMatch(canary, /continue-on-error/);
  const worker = fs.readFileSync(path.join(__dirname, '../scripts/mutationproof-worker.js'), 'utf8');
  assert.match(worker, /cloneSetup\('\/input\/source', root, '\/work\/candidate-git\.config'\)/);
  assert.match(worker, /sync\('git', clone\.args, \{ env: clone\.env \}\)/);
});
