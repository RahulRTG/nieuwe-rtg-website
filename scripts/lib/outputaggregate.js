'use strict';
const fs = require('node:fs'), path = require('node:path');
const S = require('./outputshards');
function aggregate(ctx, plan, shardsRoot, output) {
  fs.mkdirSync(output, { recursive: true });
  if (fs.readdirSync(output).length) throw Error('Do not replace earlier aggregate evidence.');
  const results = [], baselines = {}, shardEvidence = [], seen = new Set();
  const directories = fs.readdirSync(shardsRoot).filter(f => fs.statSync(path.join(shardsRoot, f)).isDirectory());
  if (directories.length !== plan.shards.length) throw Error('Missing or extra shard artifacts.');
  for (const name of directories.sort()) {
    const dir = path.join(shardsRoot, name), summary = S.verifySeal(S.read(path.join(dir, 'SHARD.json')));
    if (seen.has(summary.index) || !plan.shards[summary.index]) throw Error('Duplicate or invalid shard.');
    seen.add(summary.index);
    if (summary.plan !== plan.id || summary.candidate !== plan.candidate.commit || summary.binding !== plan.binding.id ||
        summary.runner.commit !== plan.runner.commit || summary.runner.tree !== plan.runner.tree ||
        summary.runtime !== plan.binding.runtime || summary.runtimeSha256 !== plan.binding.runtimeSha256)
      throw Error('Shard identity mismatch.');
    for (const [file, digest] of Object.entries(summary.files)) {
      if (S.hash(fs.readFileSync(S.fileWithin(dir, file))) !== digest) throw Error('Evidence bytes changed: ' + file);
    }
    for (const [toets, baseline] of Object.entries(summary.baselines)) {
      if (baselines[toets] || !ctx.B.currentBaseline(baseline, plan.binding.id)) throw Error('Duplicate or invalid baseline.');
      S.verifyExecution(baseline.execution, dir, baseline.logPrefix); baselines[toets] = baseline;
    }
    const rows = plan.shards[summary.index].groups.flatMap(g => g.routes);
    const measured = summary.results.map(file => {
      if (!summary.files[file]) throw Error('Result is absent from shard manifest.');
      return S.read(S.fileWithin(dir, file));
    });
    S.exactRoutes(rows, measured);
    for (const result of measured) {
      const row = rows.find(r => r.route === result.route);
      S.verifyResult(row, result, plan, dir, ctx.B);
      if (result.staat === 'merkt' && !ctx.B.green(result.evidence?.control)) {
        const baseline = baselines[row.toets];
        if (!ctx.B.currentBaseline(baseline, plan.binding.id) ||
            result.baselineReference !== S.hash(JSON.stringify(baseline))) throw Error('MERKT without bound passing control.');
      }
      results.push(result);
    }
    shardEvidence.push({ directory: name, digest: summary.id, index: summary.index,
      files: summary.files, routes: measured.length });
  }
  S.exactRoutes(plan.rows, results);
  const previous = S.read(path.join(ctx.candidate, 'OUTPUTPROEF.json'));
  if (S.hash(fs.readFileSync(path.join(ctx.candidate, 'OUTPUTPROEF.json'))) !== plan.historicalRegisterSha256)
    throw Error('Historical baseline changed.');
  const perRoute = {}, gericht = {}, totals = { bewezen: 0, blind: 0, ongemeten: 0, onbeslist: 0 };
  for (const row of plan.excluded) perRoute[row.route] = { staat: 'ongemeten', reden: row.reason, toetsen: row.tests };
  for (const route of plan.historicalUnseen) perRoute[route] = { staat: 'ongemeten',
    reden: 'Not reached by the complete current journal; retained as a gap, not silently removed.',
    historicalState: previous.perRoute[route]?.staat };
  for (const result of results) {
    const row = { staat: result.staat === 'merkt' ? 'bewezen' : result.staat === 'blind' ? 'blind' : 'ongemeten',
      bron: 'outputproef (gericht)', toetsen: [result.toets], evidenceCommit: plan.candidate.commit,
      evidenceBinding: plan.binding.id, reden: result.reden || 'Current candidate; preserved mutation/control TAP and changed-response journal.' };
    if (result.staat !== 'stoornis') gericht[result.route] = result;
    perRoute[result.route] = row;
    if (row.staat === 'bewezen' && ctx.B.outputCell(row,
      { binding: plan.binding, gericht, basislijn: baselines }, result.route).staat !== 'bewezen')
      throw Error('Candidate proof consumer rejected route: ' + result.route);
  }
  for (const row of Object.values(perRoute)) totals[row.staat]++;
  const register = { stempel: { commit: plan.candidate.commit, runtime: process.version, op: new Date().toISOString() },
    binding: plan.binding, runner: plan.runner, plan: plan.id, routes: Object.keys(perRoute).length,
    gemeten: totals, perRoute, gericht, basislijn: baselines,
    historicalEvidence: { digest: plan.historicalRegisterSha256, retainedAs: 'HISTORICAL-OUTPUTPROEF.json', revalidated: false },
    claimValidity: { currentCandidate: totals.bewezen,
      historicalClaims: Object.values(previous.perRoute || {}).filter(r => r.staat === 'bewezen').length,
      historicalUnrevalidated: Object.entries(previous.perRoute || {})
        .filter(([route, row]) => row.staat === 'bewezen' && perRoute[route]?.staat !== 'bewezen').length },
    grens: 'Only whether an existing test detects a changed response. This does not prove complete business correctness or release readiness.' };
  fs.copyFileSync(path.join(ctx.candidate, 'OUTPUTPROEF.json'), path.join(output, 'HISTORICAL-OUTPUTPROEF.json'));
  S.write(path.join(output, 'OUTPUTPROEF.json'), register);
  const status = { complete: true, candidate: plan.candidate, runner: plan.runner, plan: plan.id,
    measured: results.length, merkt: totals.bewezen, blind: totals.blind,
    stoornis: results.filter(r => r.staat === 'stoornis').length, excluded: plan.excluded.length,
    historicalUnseen: plan.historicalUnseen.length, automaticRepositoryChanges: false,
    releaseReadiness: 'NOT_EVALUATED', debtDecision: 'NOT_AUTOMATIC' };
  S.write(path.join(output, 'STATUS.json'), status);
  S.write(path.join(output, 'BUNDLE.json'), S.seal({ plan, shards: shardEvidence, status,
    files: Object.fromEntries(fs.readdirSync(output).sort().map(f => [f, S.hash(fs.readFileSync(path.join(output, f)))])) }));
  console.log(JSON.stringify(status));
  return status.stoornis === 0 && status.blind === 0;
}
module.exports = { aggregate };
