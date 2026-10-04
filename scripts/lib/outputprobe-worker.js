'use strict';
// One owned POSIX process group, one original candidate experiment, no writes
// to the candidate source. The wrapper adds raw logs, not assertions or rules.
const fs = require('node:fs'), path = require('node:path');
const S = require('./outputshards');
function probe(candidate, planFile, rowIndex, baselineFile, evidenceDir) {
  const plan = S.verifySeal(S.read(planFile)), row = plan.rows[rowIndex];
  if (!row) throw Error('Unknown planned route.');
  const B = require(path.join(candidate, 'scripts/lib/outputbinding'));
  const current = B.binding(plan.binding.journal);
  if (current.id !== plan.binding.id) throw Error('Candidate or runtime changed.');
  if (S.hash(fs.readFileSync(path.join(candidate, 'test', row.toets))) !== row.testSha256) throw Error('Test changed.');
  const prefix = path.join(evidenceDir, S.hash(row.route));
  const baseline = fs.existsSync(baselineFile) ? S.read(baselineFile) : null;
  if (baseline && !B.currentBaseline(baseline, current.id)) throw Error('Invalid reusable control.');
  if (baseline) S.verifyExecution(baseline.execution, evidenceDir, baseline.logPrefix);
  const mutation = require(path.join(candidate, 'scripts/mutatie'));
  const original = mutation.draaiToets;
  mutation.draaiToets = (file, env, wait, force) => {
    const isMutation = !!env?.RTG_LIEG;
    const result = original(file, env, wait, force, prefix + (isMutation ? '-mutation' : '-control'));
    if (isMutation) fs.writeFileSync(prefix + '.hits', fs.existsSync(env.RTG_LIEG_JOURNAAL)
      ? fs.readFileSync(env.RTG_LIEG_JOURNAAL) : '', { flag: 'wx' });
    return result;
  };
  let result;
  try {
    result = require(path.join(candidate, 'scripts/outputproef')).meetEen(row.route, row.toets,
      { requireHit: true, ...(baseline ? { basisGroen: new Set([row.toets]) } : {}) });
  } finally { mutation.draaiToets = original; }
  if (B.binding(plan.binding.journal).id !== current.id) throw Error('Candidate changed during the experiment.');
  return { ...row, ...result, merkt: result.staat === 'merkt', plan: plan.id,
    binding: current.id, evidenceCommit: current.commit, provenance: 'CURRENT_CANDIDATE',
    baselineReference: baseline ? S.hash(JSON.stringify(baseline)) : null, op: new Date().toISOString() };
}
if (require.main === module) {
  const [candidate, plan, row, baseline, out] = process.argv.slice(2);
  try { console.log(JSON.stringify(probe(path.resolve(candidate), plan, Number(row), baseline, out))); }
  catch (error) { console.error(error.stack); process.exitCode = 2; }
}
module.exports = { probe };
