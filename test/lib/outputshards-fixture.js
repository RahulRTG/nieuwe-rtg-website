'use strict';
// Synthetic immutable shard evidence shared by output aggregation regressions.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const S = require('../../scripts/lib/outputshards');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-outputshards-')), candidate = path.join(root, 'candidate'), shards = path.join(root, 'shards');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(shards, 'shard0'); fs.mkdirSync(candidate); fs.mkdirSync(dir, { recursive: true });
  const row = { route: 'POST /api/documents', toets: 'documents.test.js', testSha256: 'c'.repeat(64) };
  const prior = { perRoute: { [row.route]: { staat: 'onbeslist' } }, gericht: {} };
  S.write(path.join(candidate, 'OUTPUTPROEF.json'), prior);
  const binding = S.seal({ commit: 'a'.repeat(40), runtime: process.version, runtimeSha256: 'd'.repeat(64) });
  const plan = S.seal({ candidate: { commit: binding.commit }, runner: { commit: 'b'.repeat(40), tree: 'e'.repeat(40) }, binding,
    rows: [row], excluded: [], historicalUnseen: [], shards: S.partition([row], 1),
    historicalRegisterSha256: S.hash(fs.readFileSync(path.join(candidate, 'OUTPUTPROEF.json'))) });
  const prefix = S.hash(row.route), mutationTap = 'not ok 1 - detects changed output\n# tests 1\n# skipped 0\n';
  const controlTap = 'ok 1 - checks real output\n# tests 1\n# skipped 0\n';
  function execution(kind, tap, status, gezakt) {
    fs.writeFileSync(path.join(dir, prefix + '-' + kind + '.tap'), tap);
    fs.writeFileSync(path.join(dir, prefix + '-' + kind + '.stderr'), '');
    return { toetsen: 1, overgeslagen: 0, status, gezakt, signal: null, error: null, tijdout: false,
      stdoutSha256: S.hash(tap), stderrSha256: S.hash('') };
  }
  const mutation = execution('mutation', mutationTap, 1, 1), control = execution('control', controlTap, 0, 0);
  const hits = 'POST /api/documents'; fs.writeFileSync(path.join(dir, prefix + '.hits'), hits + '\n');
  const result = { ...row, staat: 'merkt', merkt: true, provenance: 'CURRENT_CANDIDATE', plan: plan.id,
    binding: binding.id, evidenceCommit: binding.commit, evidence: { mutation, control, changedResponses: 1, hitDigest: S.hash(hits) } };
  const save = () => {
    S.write(path.join(dir, prefix + '.json'), result);
    const files = Object.fromEntries(fs.readdirSync(dir).filter(f => f !== 'SHARD.json')
      .map(f => [f, S.hash(fs.readFileSync(path.join(dir, f)))]));
    S.write(path.join(dir, 'SHARD.json'), S.seal({ index: 0, plan: plan.id, candidate: binding.commit,
      runner: plan.runner, binding: binding.id, runtime: binding.runtime, runtimeSha256: binding.runtimeSha256,
      files, results: [prefix + '.json'], baselines: {} }));
  };
  save(); return { root, candidate, dir, shards, plan, row, result, prefix, save };
}
module.exports = { fixture };
