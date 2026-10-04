'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { EventEmitter } = require('node:events');
const M = require('../scripts/mutationproof-model'), R = require('../scripts/mutationproof-runtime');
const { temp } = require('./mutationproof-fixture');
const { cancellation } = require('../scripts/mutationproof-process');
test('read-only candidate clone trusts its exact Git directory under a different owner, never other repositories', t => {
  const cp = require('node:child_process'), root = fs.realpathSync(temp(t));
  const source = path.join(root, 'source'), target = path.join(root, 'target');
  const home = path.join(root, 'home'); fs.mkdirSync(home); fs.mkdirSync(source);
  const env = { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(home, 'gitconfig') };
  const run = (args, extra = {}) => cp.spawnSync('git', args, { cwd: root, env: { ...env, ...extra }, encoding: 'utf8', timeout: 10000 });
  assert.equal(run(['init', '--quiet', source]).status, 0);
  fs.writeFileSync(path.join(source, 'proof.txt'), 'candidate bytes\n');
  assert.equal(run(['-C', source, 'add', 'proof.txt']).status, 0);
  assert.equal(run(['-C', source, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'candidate']).status, 0);
  const head = run(['-C', source, 'rev-parse', 'HEAD']).stdout.trim();
  const differentOwner = { GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' };
  const old = run(['-c', 'safe.directory=' + source, 'clone', '--quiet', '--no-hardlinks', source, path.join(root, 'old')], differentOwner);
  assert.notEqual(old.status, 0); assert.match(old.stderr, /dubious ownership/);
  const args = R.cloneArguments(source, target), fixed = run(args, differentOwner);
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.equal(run(['-C', target, 'rev-parse', 'HEAD']).stdout.trim(), head);
  assert.equal(fs.readFileSync(path.join(target, 'proof.txt'), 'utf8'), 'candidate bytes\n');
  const foreign = run([...args.slice(0, 4), '-C', target, 'status', '--porcelain'], differentOwner);
  assert.notEqual(foreign.status, 0); assert.match(foreign.stderr, /dubious ownership/);
  assert.equal(fs.existsSync(path.join(home, 'gitconfig')), false, 'no persistent global trust exception');
  const other = path.join(root, 'symlink'); fs.mkdirSync(other); fs.symlinkSync(path.join(source, '.git'), path.join(other, '.git'), 'dir');
  assert.throws(() => R.cloneArguments(other, path.join(root, 'unsafe')), /own Git directory/);
});
test('prepared executable hashes, modes, source lock and compiler pin are checked', t => {
  const root = temp(t); fs.mkdirSync(path.join(root, 'motor/target/release'), { recursive: true });
  fs.writeFileSync(path.join(root, R.SOURCES[0]), 'channel = "1.97.1"\n');
  fs.writeFileSync(path.join(root, R.SOURCES[1]), '# fixture');
  for (const p of R.BINARIES) fs.writeFileSync(path.join(root, p), 'synthetic executable fixture', { mode: 0o755 });
  const hashes = paths => Object.fromEntries(paths.map(p => [p, M.hash(fs.readFileSync(path.join(root, p)))]));
  const runtime = M.seal({ sourceFiles: hashes(R.SOURCES), binaries: hashes(R.BINARIES),
    compiler: { version: 'rustc 1.97.1 (fixture)', sha256: 'a'.repeat(64) } });
  assert.doesNotThrow(() => R.verifyPrepared(root, runtime));
  const binary = path.join(root, R.BINARIES[0]); fs.chmodSync(binary, 0o644);
  assert.throws(() => R.verifyPrepared(root, runtime), /not executable/);
  fs.chmodSync(binary, 0o755); fs.appendFileSync(binary, ' changed');
  assert.throws(() => R.verifyPrepared(root, runtime), /bytes changed/);
  const { digest, ...body } = runtime;
  assert.throws(() => R.verifySources(root, M.seal({ ...body, compiler: { ...runtime.compiler, version: 'rustc 9.0.0 (wrong)' } })), /compiler pin mismatch/);
  fs.appendFileSync(path.join(root, R.SOURCES[1]), ' changed');
  assert.throws(() => R.verifySources(root, runtime), /provenance mismatch/);
});
test('cancellation is persistent, kills only the registered container and removes handlers', () => {
  const signals = new EventEmitter(), state = cancellation(signals), killed = [];
  state.kill = () => killed.push('owned-case');
  signals.emit('SIGTERM'); assert.equal(state.interrupted, true); assert.deepEqual(killed, ['owned-case']);
  state.kill = null; signals.emit('SIGINT'); assert.deepEqual(killed, ['owned-case']);
  assert.equal(state.interrupted, true, 'caller must not start the next case after cancellation');
  state.dispose(); assert.equal(signals.listenerCount('SIGTERM'), 0); assert.equal(signals.listenerCount('SIGINT'), 0);
});
test('host cancellation records unfinished discovery without starting the next container', async t => {
  const vm = require('node:vm'), root = temp(t), output = path.join(root, 'out'), signals = new EventEmitter();
  const plan = M.seal({ digest: undefined, candidate: { commit: 'a'.repeat(40) }, runner: { commit: 'b'.repeat(40) },
    shards: [['one.test.js', 'two.test.js']], limits: { shardMinutes: 120 } });
  const planPath = path.join(root, 'PLAN.json'); M.write(planPath, plan);
  const started = [], context = { module: { exports: {} }, __dirname: path.resolve(__dirname, '../scripts'),
    console: { log() {} }, process: { env: { GITHUB_ACTIONS: 'true' } },
    require(id) {
      if (id === './mutationproof-model') return M;
      if (id === './mutationproof-plan') return { setup: () => ({ source: plan.candidate, runner: plan.runner }),
        checkPlan() {}, planRun() {}, empty(dir) { fs.mkdirSync(dir); } };
      if (id === './mutationproof-aggregate') return {};
      if (id === './mutationproof-runtime') return { prepared: () => ({ fixture: true }), verifyPrepared() {} };
      if (id === 'node:child_process') return { execFileSync: () => 'sha256:' + 'e'.repeat(64) };
      if (id === './mutationproof-process') return { cancellation: () => cancellation(signals), async runContainer(args, name, dir, state) {
        started.push(name); fs.writeFileSync(path.join(dir, 'container.stdout'), ''); fs.writeFileSync(path.join(dir, 'container.stderr'), '');
        signals.emit('SIGTERM'); return { exitCode: 137, interrupted: state.interrupted };
      } };
      return require(id);
    } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../scripts/mutationproof.js'), 'utf8'), context);
  await context.module.exports.runShard(root, plan.candidate.commit, planPath, 0, output);
  const shard = M.verify(M.read(path.join(output, 'SHARD.json')));
  assert.equal(started.length, 1); assert.equal(shard.complete, false); assert.equal(shard.interrupted, true);
  assert.equal(shard.rows.length, 2); assert.equal(shard.rows[1].state, 'UNSEEN');
  assert.match(shard.rows[1].reason, /no further case/); assert.equal(signals.listenerCount('SIGTERM'), 0);
});
