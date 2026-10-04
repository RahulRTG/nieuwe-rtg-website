'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const M = require('../scripts/mutationproof-model'), runner = require('../scripts/mutationproof');
const { temp, fixture } = require('./mutationproof-fixture');
test('discovery covers every existing gap and keeps all existing norm categories unchanged', t => {
  const dir = temp(t); fs.mkdirSync(path.join(dir, 'test'));
  const states = [null, 'gezakt', 'overleefd', 'geen bronmutatie mogelijk', 'al rood', 'slaat zichzelf over', 'geen module gevonden'];
  const toetsen = {};
  states.forEach((state, i) => { const name = i + (i % 2 ? '.test.js' : '.e2e.js'); fs.writeFileSync(path.join(dir, 'test', name), '// fixture'); if (state) toetsen[name] = { staat: state }; });
  M.write(path.join(dir, 'MUTATIES.json'), { toetsen });
  const d = M.discovery(dir);
  assert.deepEqual(d.rows.map(r => r.previousState), [null, 'al rood', 'slaat zichzelf over', 'geen module gevonden']);
  assert.equal(d.rows.length + d.historicalOnly.length, states.length);
  fs.writeFileSync(path.join(dir, 'test', 'new.test.js'), '// newly added real test');
  assert.equal(M.discovery(dir).rows.length, 5, 'new files are not silently omitted');
});
test('missing or unreadable registers cannot become a zero-size measurement', t => {
  const dir = temp(t); assert.throws(() => M.discovery(dir));
  M.write(path.join(dir, 'MUTATIES.json'), {}); assert.throws(() => M.discovery(dir));
});
test('partition rejects duplicates, losses and a changed shard count', () => {
  const rows = [{ name: 'a' }, { name: 'b' }];
  assert.deepEqual(M.partition(rows, 2, () => [['b'], ['a']]), [['b'], ['a']]);
  for (const shards of [[['a'], ['a']], [['a'], []], [['a', 'b']]]) assert.throws(() => M.partition(rows, 2, () => shards));
});
test('candidate and evidence bytes are bound; paths cannot escape or traverse symlinks', t => {
  const dir = temp(t), r = M.seal({ candidate: 'a'.repeat(40), testSha256: 'c'.repeat(64) });
  assert.doesNotThrow(() => M.verify(r)); r.candidate = 'b'.repeat(40); assert.throws(() => M.verify(r));
  fs.symlinkSync(os.tmpdir(), path.join(dir, 'outside'));
  for (const p of ['../secret', '/tmp/secret', 'outside/foo']) assert.throws(() => M.file(dir, p));
  for (const sha of ['main', '7e71dac', 'a'.repeat(40) + ';evil']) assert.throws(() => M.sha(sha));
});
test('a real assertion on a changed source, then exact restoration, is measurable', t => {
  const { dir, evidence } = fixture(t);
  assert.equal(M.verdict(evidence, dir).state, 'gezakt');
  assert.equal(M.verdict(evidence, dir).measured, true);
  assert.equal(M.grade(evidence.calls[1], dir).assertionFailure, true);
});
test('a forged PASS label does not replace a baseline, mutation or restored test', t => {
  const { dir, evidence } = fixture(t);
  for (const phase of ['baseline', 'mutant', 'restored']) {
    const r = structuredClone(evidence); r.calls = r.calls.filter(c => c.phase !== phase);
    r.verdict = { measured: true, state: 'gezakt' };
    assert.equal(M.verdict(r, dir).measured, false, phase);
  }
  const r = structuredClone(evidence); r.sourceRestored = false;
  assert.equal(M.verdict(r, dir).measured, false);
});
test('timeouts, signals, forced exits, non-assertion errors and raw byte tampering are not kills', t => {
  const { dir, evidence } = fixture(t);
  for (const change of [c => { c.error = 'ETIMEDOUT'; }, c => { c.signal = 'SIGKILL'; }, c => { c.forceExit = true; }]) {
    const r = structuredClone(evidence); change(r.calls[1]); assert.equal(M.verdict(r, dir).measured, false);
  }
  const c = evidence.calls[1], p = path.join(dir, c.stdout), original = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, original.replace('ERR_ASSERTION', 'MODULE_NOT_FOUND'));
  assert.throws(() => M.verdict(evidence, dir), /log changed/);
  c.stdoutSha256 = M.hash(fs.readFileSync(p));
  assert.equal(M.verdict(evidence, dir).measured, false, 'even correctly hashed import errors are not assertion proof');
});
test('skip/todo/cancelled or missing TAP remains unknown rather than surviving', t => {
  const { dir, evidence } = fixture(t);
  for (const key of ['skipped', 'todo', 'cancelled']) {
    const c = structuredClone(evidence.calls[0]); c.stdout = key + '.tap';
    const raw = fs.readFileSync(path.join(dir, evidence.calls[0].stdout), 'utf8').replace('# ' + key + ' 0', '# ' + key + ' 1');
    fs.writeFileSync(path.join(dir, c.stdout), raw); c.stdoutSha256 = M.hash(raw);
    assert.equal(M.grade(c, dir).green, false);
  }
  assert.equal(M.tap('# tests 0\n'), null);
  const r = structuredClone(evidence); r.motorRecord.staat = 'overleefd';
  assert.equal(M.verdict(r, dir).measured, false, 'a real failed mutant cannot be relabelled survived');
});
test('source side effects and mutant-source tampering are rejected', t => {
  const { dir, evidence } = fixture(t);
  const r = structuredClone(evidence); r.sideEffects = ['changed-other.js']; assert.equal(M.verdict(r, dir).measured, false);
  fs.appendFileSync(path.join(dir, 'mutant.source'), '// changed after capture');
  assert.throws(() => M.verdict(evidence, dir), /source binding/);
});
test('top-level errors, interruptions and motor signals invalidate otherwise complete good calls', t => {
  const { dir, evidence } = fixture(t);
  for (const failure of [{ error: 'git inspection failed after restoration' }, { interrupted: true }, { motorSignal: 'SIGTERM' }]) {
    const verdict = M.verdict({ ...evidence, ...failure }, dir);
    assert.equal(verdict.measured, false);
    assert.equal(verdict.state, 'INCOMPLETE');
  }
});
