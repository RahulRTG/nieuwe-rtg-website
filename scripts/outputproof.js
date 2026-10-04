#!/usr/bin/env node
'use strict';
// A pinned runner revision measures a separately checked-out candidate. No
// source updates, Git writes, deployments or automatic debt adjudications.
const fs = require('node:fs'), path = require('node:path');
const S = require('./lib/outputshards');
const tooling = path.resolve(__dirname, '..');
function setup(candidate, sha) {
  candidate = fs.realpathSync(candidate);
  if (candidate === tooling || !/^[a-f0-9]{40}$/.test(sha || '')) throw Error('An independent exact candidate checkout is required.');
  if (['.env', 'server/.env'].some(p => fs.existsSync(path.join(candidate, p)))) throw Error('Secrets in candidate checkout.');
  if (S.identity(candidate).commit !== sha) throw Error('Wrong candidate checkout.');
  const runner = S.identity(tooling);
  if (process.env.GITHUB_SHA && runner.commit !== process.env.GITHUB_SHA) throw Error('Runner checkout is not workflow revision.');
  return { candidate, runner, B: require(path.join(candidate, 'scripts/lib/outputbinding')),
    op: require(path.join(candidate, 'scripts/outputproef')) };
}
function planRun(candidate, sha, journal, output) {
  const ctx = setup(candidate, sha), { op, B } = ctx;
  const binding = B.binding(journal), k = op.koppeling(journal), g = op.gevoeligheid();
  const provenance = S.read(journal + '.provenance.json');
  if (provenance.sources?.length !== 14 || provenance.sources.some(s => s.testConclusion !== 'success'))
    throw Error('All fourteen complete CI journals are required.');
  const old = S.read(path.join(candidate, 'OUTPUTPROEF.json'));
  const thin = op.teDun({ routes: k?.perRoute.size || 0 }, old);
  if (thin) throw Error(thin);
  const { DEUREN } = require(path.join(candidate, 'scripts/mutatie'));
  const selection = S.choose(k, g.gevoelig, DEUREN.split(','), op.infrastructuur(k.perToets), candidate);
  const shards = S.partition(selection.rows, 8);
  const plan = S.seal({ schema: 'RTG_OUTPUT_SHARDS_V1', createdAt: new Date().toISOString(),
    candidate: S.identity(candidate), runner: ctx.runner, binding,
    journalProvenanceSha256: S.hash(fs.readFileSync(journal + '.provenance.json')),
    instrument: 'candidate scripts/outputproef.js meetEen, unchanged assertions and limits',
    workersPerShard: 2, ...selection, shards,
    historicalUnseen: Object.keys(old.perRoute || {}).filter(r => !k.perRoute.has(r)).sort(),
    historicalRegisterSha256: S.hash(fs.readFileSync(path.join(candidate, 'OUTPUTPROEF.json'))) });
  fs.mkdirSync(output, { recursive: true });
  if (fs.existsSync(path.join(output, 'PLAN.json'))) throw Error('Plan already exists; preserve earlier evidence.');
  S.write(path.join(output, 'PLAN.json'), plan);
  console.log(JSON.stringify({ plan: plan.id, routes: plan.rows.length, excluded: plan.excluded.length,
    historicalUnseen: plan.historicalUnseen.length, shardRoutes: shards.map(s => s.routes) }));
  return plan;
}
function checkPlan(ctx, plan) {
  S.verifySeal(plan);
  if (ctx.runner.commit !== plan.runner.commit || ctx.runner.tree !== plan.runner.tree ||
      ctx.B.binding(plan.binding.journal).id !== plan.binding.id) throw Error('Runner/candidate/input identity changed.');
  if (S.hash(fs.readFileSync(plan.binding.journal + '.provenance.json')) !== plan.journalProvenanceSha256)
    throw Error('Journal provenance changed.');
}
async function runShard(candidate, sha, planFile, index, output) {
  const ctx = setup(candidate, sha), plan = S.read(planFile); checkPlan(ctx, plan);
  const shard = plan.shards[index];
  if (!shard || !Number.isInteger(index)) throw Error('Unknown shard.');
  fs.mkdirSync(output, { recursive: true });
  if (fs.readdirSync(output).length) throw Error('Do not overwrite earlier evidence.');
  const home = path.join(output, 'home'); fs.mkdirSync(home);
  const env = { PATH: process.env.PATH, HOME: home, TMPDIR: process.env.RUNNER_TEMP || '/tmp',
    LANG: 'C.UTF-8', TZ: 'Europe/Amsterdam', CI: 'true', NODE_ENV: 'test', RTG_AI_UIT: '1',
    GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_VALUE_0: 'RTG output probe',
    GIT_CONFIG_KEY_1: 'user.email', GIT_CONFIG_VALUE_1: 'output-proof@example.invalid' };
  const { runWorker } = require(path.join(candidate, 'scripts/lib/outputworker'));
  const baselines = {}, results = []; let next = 0;
  async function worker() {
    while (next < shard.groups.length) {
      const group = shard.groups[next++], baselineFile = path.join(output, S.hash(group.toets) + '.baseline.json');
      for (const row of group.routes) {
        const rowIndex = plan.rows.findIndex(r => r.route === row.route);
        const raw = await runWorker([path.join(__dirname, 'lib/outputprobe-worker.js'), candidate,
          path.resolve(planFile), String(rowIndex), baselineFile, path.resolve(output)], { cwd: candidate, env });
        const result = { ...row, plan: plan.id, binding: plan.binding.id, evidenceCommit: sha, ...raw };
        if (result.basis === 'groen' && ctx.B.green(result.evidence?.control)) {
          baselines[group.toets] = { staat: 'groen', binding: plan.binding.id,
            execution: result.evidence.control, logPrefix: S.hash(row.route) + '-control' };
          S.write(baselineFile, baselines[group.toets]);
        }
        S.write(path.join(output, S.hash(row.route) + '.json'), result); results.push(result);
        console.log(`${index}:${results.length}/${shard.routes} ${result.staat} ${row.route}`);
      }
    }
  }
  await Promise.all([worker(), worker()]); checkPlan(ctx, plan);
  S.exactRoutes(shard.groups.flatMap(g => g.routes), results);
  const files = Object.fromEntries(fs.readdirSync(output).filter(f => fs.statSync(path.join(output, f)).isFile())
    .sort().map(f => [f, S.hash(fs.readFileSync(path.join(output, f)))]));
  const summary = S.seal({ plan: plan.id, candidate: sha, runner: ctx.runner, index, binding: plan.binding.id,
    completedAt: new Date().toISOString(), runtime: process.version, runtimeSha256: plan.binding.runtimeSha256,
    results: results.map(r => S.hash(r.route) + '.json'), baselines, files });
  S.write(path.join(output, 'SHARD.json'), summary);
  return results.every(r => r.staat !== 'stoornis');
}
if (require.main === module) {
  const [mode, candidateArg, sha, input, argument, outputArg] = process.argv.slice(2);
  const candidate = path.resolve(candidateArg || '');
  (async () => {
    if (mode === 'plan') planRun(candidate, sha, path.resolve(input), path.resolve(argument));
    else if (mode === 'shard') process.exitCode = await runShard(candidate, sha, input, Number(argument), path.resolve(outputArg)) ? 0 : 1;
    else if (mode === 'aggregate') {
      const ctx = setup(candidate, sha), plan = S.read(input); checkPlan(ctx, plan);
      process.exitCode = require('./lib/outputaggregate').aggregate(ctx, plan, path.resolve(argument), path.resolve(outputArg)) ? 0 : 1;
    } else throw Error('Use plan, shard or aggregate with candidate directory, full SHA and evidence paths.');
  })().catch(error => { console.error(error.stack); process.exitCode = 2; });
}
module.exports = { planRun, checkPlan, runShard, setup };
