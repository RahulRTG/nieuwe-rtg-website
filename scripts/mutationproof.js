#!/usr/bin/env node
'use strict';
// All discovered gaps, immutable source identities, isolated execution, no
// automatic edits to MUTATIES/NORM and no interpretation of CI green as READY.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const M = require('./mutationproof-model');
const TOOLING = path.resolve(__dirname, '..'), SHARDS = 16;
const { setup, empty, planRun, checkPlan } = require('./mutationproof-plan');
const { aggregate } = require('./mutationproof-aggregate');
const { cancellation, runContainer } = require('./mutationproof-process');
const R = require('./mutationproof-runtime');
async function runShard(candidate, sha, planPath, index, output) {
  const ctx = setup(candidate, sha), plan = M.read(planPath); checkPlan(ctx, plan);
  if (!Number.isSafeInteger(index) || !plan.shards[index]) throw Error('Invalid shard.');
  if (process.env.GITHUB_ACTIONS !== 'true') throw Error('Heavy mutation runs are restricted to isolated GitHub runners.');
  empty(output);
  const image = cp.execFileSync('docker', ['image', 'inspect', '--format', '{{.Id}}', 'rtg-mutationproof:local'], { encoding: 'utf8' }).trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw Error('Missing exact prepared container image.');
  const runtime = R.prepared(candidate), runtimePath = path.join(output, 'RUNTIME.json');
  M.write(runtimePath, runtime);
  const started = Date.now(), rows = [], cancelled = cancellation();
  try {
  for (const name of plan.shards[index]) {
    const id = M.hash(name), dir = path.join(output, id);
    if (cancelled.interrupted || Date.now() - started >= plan.limits.shardMinutes * 60000) {
      rows.push({ test: name, state: 'UNSEEN', reason: cancelled.interrupted ? 'Shard interrupted; no further case started.' : 'Shard execution budget exhausted; no proof and no debt closure.' }); continue;
    }
    fs.mkdirSync(dir, { mode: 0o777 }); fs.chmodSync(dir, 0o777);
    R.verifyPrepared(candidate, runtime);
    const container = 'rtg-mutation-' + index + '-' + id.slice(0, 16);
    const run = await runContainer(['run', '--rm', '--init', '--name', container, '--network', 'none',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '768', '--memory', '6g', '--cpus', '2',
      '--read-only', '--tmpfs', '/tmp:rw,nosuid,size=1g', '--tmpfs', '/work:rw,nosuid,size=4g,uid=10001,gid=10001',
      '--tmpfs', '/home/node:rw,nosuid,size=128m,uid=10001,gid=10001',
      '--mount', 'type=bind,src=' + candidate + ',dst=/input/source,readonly',
      '--mount', 'type=bind,src=' + TOOLING + ',dst=/tooling,readonly',
      '--mount', 'type=bind,src=' + path.resolve(planPath) + ',dst=/input/PLAN.json,readonly',
      '--mount', 'type=bind,src=' + path.resolve(runtimePath) + ',dst=/input/RUNTIME.json,readonly',
      '--mount', 'type=bind,src=' + dir + ',dst=/out', '-e', 'RTG_MUTATION_CONTAINER=isolated-v1', image,
      'node', '/tooling/scripts/mutationproof-worker.js', '/input/PLAN.json', name], container, dir, cancelled);
    R.verifyPrepared(candidate, runtime);
    rows.push({ test: name, directory: id, execution: run,
      containerLogs: Object.fromEntries(['container.stdout', 'container.stderr'].map(p => [p, M.hash(fs.readFileSync(path.join(dir, p)))])),
      state: fs.existsSync(path.join(dir, 'CASE.json')) ? 'COLLECTED' : 'INCOMPLETE' });
    M.write(path.join(output, 'SHARD.json'), M.seal({ schema: 'RTG_MUTATION_SHARD_V1', plan: plan.digest, candidate: ctx.source, runner: ctx.runner,
      index, image, runtime, complete: false, rows }));
    console.log(index + ' ' + rows.length + '/' + plan.shards[index].length + ' ' + name + ' ' + rows.at(-1).state);
  }
  checkPlan(ctx, plan);
  M.write(path.join(output, 'SHARD.json'), M.seal({ schema: 'RTG_MUTATION_SHARD_V1', plan: plan.digest, candidate: ctx.source, runner: ctx.runner,
    index, image, runtime, complete: !cancelled.interrupted, interrupted: cancelled.interrupted, rows, finishedAt: new Date().toISOString() }));
  } finally { cancelled.dispose(); }
}
if (require.main === module) {
  const [mode, candidateArg, sha, input, argument, output] = process.argv.slice(2), candidate = path.resolve(candidateArg || '');
  (async () => {
    if (mode === 'plan') planRun(candidate, sha, path.resolve(input));
    else if (mode === 'verify') checkPlan(setup(candidate, sha), M.read(input));
    else if (mode === 'shard') await runShard(candidate, sha, input, Number(argument), path.resolve(output));
    else if (mode === 'aggregate') aggregate(setup(candidate, sha), M.read(input), path.resolve(argument), path.resolve(output));
    else throw Error('Use plan, shard or aggregate with exact candidate and output paths.');
  })().catch(e => { console.error(e.stack); process.exitCode = 2; });
}
module.exports = { planRun, checkPlan, runShard, aggregate };
