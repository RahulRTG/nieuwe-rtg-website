'use strict';
// Tests of the collector itself. These tiny synthetic fixtures are not RTG
// mutation evidence and are never imported into a product register.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const M = require('../scripts/mutationproof-model');
function temp(t) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mutationproof-test-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; }
function fixture(t) {
  const dir = temp(t), testFile = path.join(dir, 'fixture.test.js'), subject = path.join(dir, 'subject.js');
  fs.writeFileSync(testFile, "const {test}=require('node:test'); const assert=require('node:assert/strict'); test('the real invariant',()=>assert.equal(require('./subject'),true));\n");
  const original = 'module.exports=true;\n', mutant = 'module.exports=false;\n';
  const calls = [];
  for (const [phase, source] of [['baseline', original], ['mutant', mutant], ['restored', original]]) {
    fs.writeFileSync(subject, source);
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    const r = cp.spawnSync(process.execPath, ['--test', '--test-reporter=tap', testFile], { env, encoding: 'utf8', timeout: 5000 });
    const number = calls.length + 1;
    const c = { number, test: 'fixture.test.js', phase, status: r.status, signal: r.signal, error: r.error?.code || null,
      forceExit: false, lieg: null, sources: [], stdout: number + '.tap', stderr: number + '.stderr',
      stdoutSha256: M.hash(r.stdout), stderrSha256: M.hash(r.stderr), sideEffects: [] };
    fs.writeFileSync(path.join(dir, c.stdout), r.stdout); fs.writeFileSync(path.join(dir, c.stderr), r.stderr);
    if (phase === 'mutant') {
      fs.writeFileSync(path.join(dir, 'mutant.source'), mutant);
      c.sources = [{ path: 'subject.js', artifact: 'mutant.source', originalSha256: M.hash(original), sha256: M.hash(mutant) }];
    }
    calls.push(c);
  }
  return { dir, original, evidence: { calls, motorExit: 0, sourceRestored: true, sideEffects: [], motorRecord: { staat: 'gezakt' } } };
}
module.exports = { temp, fixture };
