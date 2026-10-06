'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const M = require('../scripts/mutationproof-model'), runner = require('../scripts/mutationproof');
const { temp, fixture } = require('./mutationproof-fixture');
test('restoration retains raw motor output but reinstates exact candidate register bytes', t => {
  const C = require('../scripts/mutationproof-capture'), dir = temp(t);
  const source = path.join(dir, 'source'), clone = path.join(dir, 'clone'), out = path.join(dir, 'out');
  for (const d of [source, clone, out]) fs.mkdirSync(d);
  const original = '{"toetsen":{}}\n', result = '{"toetsen":{"example.test.js":{"staat":"gezakt"}}}\n';
  fs.writeFileSync(path.join(source, 'MUTATIES.json'), original); fs.writeFileSync(path.join(clone, 'MUTATIES.json'), original);
  const git = args => require('node:child_process').execFileSync('git', args, { cwd: clone, stdio: 'pipe' });
  git(['init', '--quiet']); git(['add', 'MUTATIES.json']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'frozen candidate']);
  fs.writeFileSync(path.join(clone, 'MUTATIES.json'), result);
  assert.equal(C.registerMatches(clone, M.hash(original)), false);
  assert.throws(() => C.restoreRegister(clone, source, out, M.hash('wrong candidate')), /changed/);
  C.restoreRegister(clone, source, out, M.hash(original));
  assert.equal(C.registerMatches(clone, M.hash(original)), true);
  assert.equal(fs.readFileSync(path.join(out, 'motor-register.json'), 'utf8'), result);
  assert.equal(fs.readFileSync(path.join(source, 'MUTATIES.json'), 'utf8'), original);
  const altered = original + ' ';
  fs.writeFileSync(path.join(source, 'MUTATIES.json'), altered);
  assert.throws(() => C.restoreRegister(clone, source, out, M.hash(altered)), /does not contain/);
  assert.equal(fs.readFileSync(path.join(clone, 'MUTATIES.json'), 'utf8'), original);
  fs.appendFileSync(path.join(clone, 'MUTATIES.json'), 'modified by restoration test');
  assert.equal(C.registerMatches(clone, M.hash(original)), false);
});
test('capture keeps raw calls and allocates a different disposable PG database for each phase', t => {
  const vm = require('node:vm'), { dir, evidence, original } = fixture(t), out = path.join(dir, 'capture'); fs.mkdirSync(out);
  fs.mkdirSync(path.join(dir, 'test'));
  const commit = 'a'.repeat(40), fixtureFile = path.join(dir, 'test/fixture.test.js'), commands = [];
  fs.copyFileSync(path.join(dir, 'fixture.test.js'), fixtureFile);
  const child = { spawnSync(cmd, args, options) {
    commands.push({ cmd, args, env: options?.env });
    if (args.includes('--test')) {
      const c = evidence.calls[fs.readFileSync(path.join(dir, 'subject.js'), 'utf8') === original ? 0 : 1];
      return { status: c.status, signal: null, stdout: fs.readFileSync(path.join(dir, c.stdout), 'utf8'), stderr: '' };
    }
    let stdout = '';
    if (cmd === 'git' && args[0] === 'rev-parse') stdout = commit;
    if (cmd === 'git' && args[0] === 'diff' && fs.readFileSync(path.join(dir, 'subject.js'), 'utf8') !== original) stdout = 'subject.js';
    if (cmd === 'git' && args[0] === 'show') stdout = Buffer.from(original);
    return { status: 0, stdout, stderr: '' };
  } };
  const context = { module: { exports: {} }, process: { env: {}, argv: [] },
    require(id) { if (id === 'node:child_process') return child; if (id === './mutationproof-model') return M; return require(id); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/mutationproof-capture.js'), 'utf8'), context);
  const config = { root: dir, output: out, name: 'fixture.test.js', pg: true, commit, testSha256: M.hash(fs.readFileSync(fixtureFile)) };
  let undo = context.module.exports.install(config);
  const run = () => child.spawnSync(process.execPath, ['--test', fixtureFile], { cwd: dir, env: {} });
  run(); fs.writeFileSync(path.join(dir, 'subject.js'), 'module.exports=false;\n'); run(); undo();
  fs.writeFileSync(path.join(dir, 'subject.js'), original);
  undo = context.module.exports.install({ ...config, phase: 'restored' }); run(); undo();
  const calls = fs.readFileSync(path.join(out, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map(c => c.phase), ['baseline', 'mutant', 'restored']);
  assert.deepEqual(calls.map(c => c.database), ['mutation_1', 'mutation_2', 'mutation_3']);
  assert.equal(commands.filter(c => c.cmd.endsWith('/dropdb')).length, 3);
  assert.equal(commands.filter(c => c.cmd === 'redis-cli').length, 3);
  assert.equal(calls[1].sources[0].originalSha256, M.hash(original));
  assert.equal(M.verdict({ calls, sourceRestored: true, motorExit: 0, sideEffects: [], motorRecord: { staat: 'gezakt' } }, out).measured, true);
  // No PostgreSQL or Redis process is started by this fixture; only their
  // argument boundary is exercised. The actual integration belongs to CI.
});
