'use strict';
const fs = require('node:fs'), path = require('node:path');
const M = require('./mutationproof-model');
const { checkPlan, empty, SHARDS } = require('./mutationproof-plan');
const R = require('./mutationproof-runtime');
function aggregate(ctx, plan, input, output) {
  checkPlan(ctx, plan); empty(output);
  const rows = [], proposals = {}, seen = new Set(), shards = [];
  for (const folder of fs.readdirSync(input).sort()) {
    const dir = path.join(input, folder), shardFile = path.join(dir, 'SHARD.json');
    if (!fs.existsSync(shardFile)) continue;
    const s = M.verify(M.read(shardFile));
    if (s.plan !== plan.digest || !s.complete || seen.has(s.index) || !plan.shards[s.index]) throw Error('Missing, duplicate or incomplete shard.');
    if (JSON.stringify(s.candidate) !== JSON.stringify(plan.candidate) || JSON.stringify(s.runner) !== JSON.stringify(plan.runner)) throw Error('Shard provenance mismatch.');
    R.verifySources(ctx.candidate, s.runtime);
    if (JSON.stringify(s.rows.map(r => r.test)) !== JSON.stringify(plan.shards[s.index])) throw Error('Shard changed test selection.');
    seen.add(s.index); shards.push({ path: folder + '/SHARD.json', sha256: M.hash(fs.readFileSync(shardFile)), image: s.image });
    for (const r of s.rows) {
      if (r.state !== 'COLLECTED') { rows.push({ test: r.test, measured: false, state: r.state, reason: r.reason || 'No completed case artifact.' }); continue; }
      if (r.directory !== M.hash(r.test)) throw Error('Unsafe case directory.');
      const caseDir = path.join(dir, r.directory), e = M.verify(M.read(M.file(caseDir, 'CASE.json')));
      for (const [p, digest] of Object.entries(r.containerLogs || {})) if (M.hash(fs.readFileSync(M.file(caseDir, p))) !== digest) throw Error('Container log changed.');
      const subject = plan.rows.find(x => x.name === r.test);
      if (e.plan !== plan.digest || e.test !== r.test || e.testSha256 !== subject.testSha256 || JSON.stringify(e.candidate) !== JSON.stringify(plan.candidate) ||
          JSON.stringify(e.runner) !== JSON.stringify(plan.runner)) throw Error('Case subject mismatch.');
      const failedBeforeCalls = !!e.error && Array.isArray(e.calls) && e.calls.length === 0;
      if (!failedBeforeCalls && JSON.stringify(e.preparedRuntime) !== JSON.stringify(s.runtime)) throw Error('Case executable provenance mismatch.');
      for (const [p, digest] of Object.entries(e.files)) if (M.hash(fs.readFileSync(M.file(caseDir, p))) !== digest) throw Error('Evidence file changed.');
      const rawCalls = fs.readFileSync(M.file(caseDir, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
      if (JSON.stringify(rawCalls) !== JSON.stringify(e.calls)) throw Error('Case omitted or relabelled captured invocations.');
      for (const [i, c] of e.calls.entries()) {
        if (c.number !== i + 1) throw Error('Captured invocation sequence changed.');
        if (c.test !== r.test || ['baseline', 'restored'].includes(c.phase) && (c.sources.length || c.lieg)) throw Error('Invalid phase binding.');
        for (const source of c.sources) if (M.hash(fs.readFileSync(M.file(ctx.candidate, source.path))) !== source.originalSha256) throw Error('Mutant belongs to another source.');
      }
      const v = M.verdict(e, caseDir), evidence = folder + '/' + r.directory + '/CASE.json';
      // An outer timeout can never be hidden by a partial successful CASE file.
      if (r.execution.exitCode !== 0 || r.execution.timeout || r.execution.interrupted || r.execution.error || r.execution.signal) { v.measured = false; v.state = 'INCOMPLETE'; v.reason = 'Container did not complete normally.'; }
      rows.push({ test: r.test, ...v, runtimeBound: !failedBeforeCalls, evidence, evidenceSha256: M.hash(fs.readFileSync(path.join(caseDir, 'CASE.json'))) });
      // Raw motor diagnostics remain in CASE.json. Only the independently
      // reconstructed primary claim is eligible for a later reviewed import.
      if (v.measured) proposals[r.test] = { staat: v.state, bewijs: { candidateCommit: plan.candidate.commit,
        runnerCommit: plan.runner.commit, plan: plan.digest, testSha256: subject.testSha256, artifact: evidence,
        sha256: rows.at(-1).evidenceSha256, image: s.image } };
    }
  }
  if (seen.size !== SHARDS || rows.length !== plan.rows.length || new Set(rows.map(r => r.test)).size !== rows.length) throw Error('Incomplete round; no silent disappearance of missing tests.');
  const report = M.seal({ schema: 'RTG_MUTATION_ROUND_V1', plan: plan.digest, candidate: plan.candidate, runner: plan.runner,
    completedAt: new Date().toISOString(), discovered: plan.rows.length, measured: rows.filter(r => r.measured).length,
    remaining: rows.filter(r => !r.measured).length, shards, rows,
    scope: 'Sensitivity to actually attempted mutations only. No current full-suite, release-readiness or production claim.' });
  M.write(path.join(output, 'MUTATION-PROOF.json'), report);
  M.write(path.join(output, 'MUTATION-PROPOSALS.json'), M.seal({ plan: plan.digest, candidate: plan.candidate, runner: plan.runner, toetsen: proposals }));
  console.log(JSON.stringify({ discovered: report.discovered, measured: report.measured, remaining: report.remaining }));
  return report;
}
module.exports = { aggregate };
