'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const M = require('../scripts/mutationproof-model'), runner = require('../scripts/mutationproof');
const { temp, fixture } = require('./mutationproof-fixture');
const R = require('../scripts/mutationproof-runtime');
test('aggregation requires all shards and rederives the result from actual TAP', t => {
  const { dir, evidence, original } = fixture(t), root = path.join(dir, 'candidate'), input = path.join(dir, 'shards');
  fs.mkdirSync(path.join(root, 'test'), { recursive: true }); fs.mkdirSync(input);
  fs.writeFileSync(path.join(root, 'test/fixture.test.js'), '// candidate test'); fs.writeFileSync(path.join(root, 'subject.js'), original);
  M.write(path.join(root, 'MUTATIES.json'), { toetsen: {} });
  fs.mkdirSync(path.join(root, 'motor'));
  fs.writeFileSync(path.join(root, 'motor/rust-toolchain.toml'), '[toolchain]\nchannel = "1.97.1"\n');
  fs.writeFileSync(path.join(root, 'motor/Cargo.lock'), '# synthetic fixture only\n');
  const runtime = M.seal({ sourceFiles: Object.fromEntries(R.SOURCES.map(p => [p, M.hash(fs.readFileSync(path.join(root, p)))])),
    binaries: Object.fromEntries(R.BINARIES.map(p => [p, 'e'.repeat(64)])), compiler: { version: 'rustc 1.97.1 (fixture)', sha256: 'f'.repeat(64) } });
  const source = { commit: 'a'.repeat(40), tree: 'b'.repeat(40) }, tool = { commit: 'c'.repeat(40), tree: 'd'.repeat(40) };
  const d = M.discovery(root), groups = Array.from({ length: 16 }, (_, i) => i ? [] : ['fixture.test.js']);
  const plan = M.seal({ candidate: source, runner: tool, ...d, shards: groups, instrument: [] });
  const ctx = { candidate: root, source, runner: tool }, caseId = M.hash('fixture.test.js');
  for (let index = 0; index < 16; index++) {
    const s = path.join(input, String(index)); fs.mkdirSync(s);
    M.write(path.join(s, 'SHARD.json'), M.seal({ plan: plan.digest, candidate: source, runner: tool, runtime, complete: true, index, image: 'fixture-image', rows: index ? [] : [
      { test: 'fixture.test.js', directory: caseId, state: 'COLLECTED', execution: { exitCode: 0, timeout: false } }] }));
  }
  const caseDir = path.join(input, '0', caseId); fs.mkdirSync(caseDir);
  const names = ['1.tap', '2.tap', '3.tap', '1.stderr', '2.stderr', '3.stderr', 'mutant.source'];
  for (const n of names) fs.copyFileSync(path.join(dir, n), path.join(caseDir, n));
  const sharpRaw = fs.readFileSync(path.join(caseDir, '2.tap'), 'utf8').replace('ERR_ASSERTION', 'UNRELATED_FAILURE');
  fs.writeFileSync(path.join(caseDir, 'sharp.tap'), sharpRaw); names.push('sharp.tap');
  evidence.calls.splice(2, 0, { ...evidence.calls[1], number: 3, liegNiet: 'DEUREN', stdout: 'sharp.tap', stdoutSha256: M.hash(sharpRaw) });
  evidence.calls[3].number = 4;
  fs.writeFileSync(path.join(caseDir, 'calls.jsonl'), evidence.calls.map(c => JSON.stringify(c)).join('\n') + '\n'); names.push('calls.jsonl');
  const e = { ...evidence, motorRecord: { ...evidence.motorRecord, scherp: 'gezakt', naald: 'unverified metadata' }, preparedRuntime: runtime,
    plan: plan.digest, candidate: source, runner: tool, test: 'fixture.test.js', testSha256: d.rows[0].testSha256,
    files: Object.fromEntries(names.map(n => [n, M.hash(fs.readFileSync(path.join(caseDir, n)))])), verdict: { state: 'FAKE' } };
  M.write(path.join(caseDir, 'CASE.json'), M.seal(e));
  const report = runner.aggregate(ctx, plan, input, path.join(dir, 'complete'));
  assert.equal(report.measured, 1); assert.equal(report.rows[0].state, 'gezakt');
  const proposed = M.read(path.join(dir, 'complete/MUTATION-PROPOSALS.json')).toetsen['fixture.test.js'];
  assert.equal(proposed.staat, 'gezakt');
  assert.equal(Object.hasOwn(proposed, 'scherp'), false, 'primary assertion kill plus non-assertive sharp failure cannot prove sharp sensitivity');
  assert.equal(Object.hasOwn(proposed, 'naald'), false, 'raw motor metadata stays diagnostic');
  M.write(path.join(caseDir, 'CASE.json'), M.seal({ ...e, preparedRuntime: { ...runtime, digest: '0'.repeat(64) } }));
  assert.throws(() => runner.aggregate(ctx, plan, input, path.join(dir, 'wrong-runtime')), /executable provenance/);
  M.write(path.join(caseDir, 'CASE.json'), M.seal({ ...e, runner: { ...tool, commit: 'f'.repeat(40) } }));
  assert.throws(() => runner.aggregate(ctx, plan, input, path.join(dir, 'wrong-runner')), /subject mismatch/);
  M.write(path.join(caseDir, 'CASE.json'), M.seal({ ...e, calls: e.calls.slice(0, 2) }));
  assert.throws(() => runner.aggregate(ctx, plan, input, path.join(dir, 'dropped-call')), /omitted or relabelled/);
  fs.writeFileSync(path.join(caseDir, 'calls.jsonl'), '');
  const failed = { ...e, error: 'Preparation failed before runtime was validated', preparedRuntime: undefined, calls: [],
    files: { ...e.files, 'calls.jsonl': M.hash('') } };
  M.write(path.join(caseDir, 'CASE.json'), M.seal(failed));
  const incomplete = runner.aggregate(ctx, plan, input, path.join(dir, 'early-failure'));
  assert.equal(incomplete.measured, 0); assert.equal(incomplete.remaining, 1); assert.equal(incomplete.rows[0].runtimeBound, false);
  fs.unlinkSync(path.join(caseDir, 'calls.jsonl'));
  assert.throws(() => runner.aggregate(ctx, plan, input, path.join(dir, 'missing-journal')));
  fs.writeFileSync(path.join(caseDir, 'calls.jsonl'), evidence.calls.map(c => JSON.stringify(c)).join('\n') + '\n');
  M.write(path.join(caseDir, 'CASE.json'), M.seal(e));
  fs.unlinkSync(path.join(input, '15/SHARD.json'));
  assert.throws(() => runner.aggregate(ctx, plan, input, path.join(dir, 'missing')), /Incomplete round/);
  M.write(path.join(input, '15/SHARD.json'), M.seal({ plan: plan.digest, complete: true, index: 0, rows: [] }));
  assert.throws(() => runner.aggregate(ctx, plan, input, path.join(dir, 'duplicate')), /duplicate/);
});
test('workflow exposes no arbitrary commands or secrets and separates candidate from instrumentation', () => {
  const root = path.join(__dirname, '..'), wf = fs.readFileSync(path.join(root, '.github/workflows/mutationproof.yml'), 'utf8');
  assert.match(wf, /contents: read/); assert.doesNotMatch(wf, /secrets\.|pull_request_target|contents: write/);
  assert.match(wf, /ref: \$\{\{ github.sha \}\}/); assert.match(wf, /ref: \$\{\{ inputs.candidate \}\}/);
  assert.match(wf, /fail-fast: false/); assert.match(wf, /max-parallel: 8/);
  assert.match(wf, /workflow_call:/); assert.doesNotMatch(wf, /workflow_dispatch:/);
  const caller = fs.readFileSync(path.join(root, '.github/workflows/ronde.yml'), 'utf8');
  assert.match(caller, /- mutationproof/);
  assert.match(caller, /if: github.event_name == 'workflow_dispatch' && inputs.scope == 'mutationproof'\n\s+uses: \.\/\.github\/workflows\/mutationproof.yml\n\s+with:\n\s+candidate: \$\{\{ inputs.candidate \}\}/);
  assert.match(caller, /inputs.scope == 'outputproof'/); assert.match(caller, /inputs.scope == 'performance'/);
  assert.match(caller, /github.event_name != 'workflow_dispatch' \|\| inputs.scope == 'full'/);
  const source = fs.readFileSync(path.join(root, 'scripts/mutationproof.js'), 'utf8');
  assert.match(source, /'--network', 'none'/); assert.match(source, /'--cap-drop', 'ALL'/);
  assert.doesNotMatch(source, /docker\.sock|--privileged|git.*push|gh.*pr.*merge/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/mutationproof.Dockerfile'), 'utf8'), /npm ci && node scripts\/browserinstall.js/);
});
