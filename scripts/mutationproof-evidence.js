'use strict';
// One verifier for the Linux canary and the complete shard aggregation.
const fs = require('node:fs'), path = require('node:path');
const M = require('./mutationproof-model');
function caseProof(ctx, plan, subject, row, runtime, caseDir) {
  if (row.state !== 'COLLECTED') return { measured: false, state: 'INCOMPLETE', reason: 'No completed case artifact.' };
  if (row.test !== subject.name || row.directory !== M.hash(row.test)) throw Error('Unsafe case directory or subject.');
  const e = M.verify(M.read(M.file(caseDir, 'CASE.json')));
  for (const [p, digest] of Object.entries(row.containerLogs || {})) if (M.hash(fs.readFileSync(M.file(caseDir, p))) !== digest) throw Error('Container log changed.');
  if (e.plan !== plan.digest || e.test !== row.test || e.testSha256 !== subject.testSha256 || JSON.stringify(e.candidate) !== JSON.stringify(plan.candidate) ||
      JSON.stringify(e.runner) !== JSON.stringify(plan.runner)) throw Error('Case subject mismatch.');
  const failedBeforeCalls = !!e.error && Array.isArray(e.calls) && e.calls.length === 0;
  if (!failedBeforeCalls && JSON.stringify(e.preparedRuntime) !== JSON.stringify(runtime)) throw Error('Case executable provenance mismatch.');
  for (const [p, digest] of Object.entries(e.files)) if (M.hash(fs.readFileSync(M.file(caseDir, p))) !== digest) throw Error('Evidence file changed.');
  const rawCalls = fs.readFileSync(M.file(caseDir, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  if (JSON.stringify(rawCalls) !== JSON.stringify(e.calls)) throw Error('Case omitted or relabelled captured invocations.');
  for (const [i, c] of e.calls.entries()) {
    if (c.number !== i + 1) throw Error('Captured invocation sequence changed.');
    if (c.test !== row.test || ['baseline', 'restored'].includes(c.phase) && (c.sources.length || c.lieg)) throw Error('Invalid phase binding.');
    for (const source of c.sources) if (M.hash(fs.readFileSync(M.file(ctx.candidate, source.path))) !== source.originalSha256) throw Error('Mutant belongs to another source.');
  }
  const v = M.verdict(e, caseDir);
  if (row.execution.exitCode !== 0 || row.execution.timeout || row.execution.interrupted || row.execution.error || row.execution.signal) {
    v.measured = false; v.state = 'INCOMPLETE'; v.reason = 'Container did not complete normally.';
  }
  return { ...v, runtimeBound: !failedBeforeCalls, evidenceSha256: M.hash(fs.readFileSync(path.join(caseDir, 'CASE.json'))) };
}
function canaryProof(ctx, plan, row, runtime, caseDir) {
  const proof = caseProof(ctx, plan, plan.canary, row, runtime, caseDir);
  // The known canary must detect an actual mutation, not merely collect files
  // or report a successful container exit after preparation failed.
  return { ...proof, passed: proof.measured === true && proof.runtimeBound === true && proof.state === 'gezakt' };
}
module.exports = { caseProof, canaryProof };
