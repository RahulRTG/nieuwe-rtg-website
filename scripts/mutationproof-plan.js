#!/usr/bin/env node
'use strict';
// All discovered gaps, immutable source identities, isolated execution, no
// automatic edits to MUTATIES/NORM and no interpretation of CI green as READY.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const M = require('./mutationproof-model');
const TOOLING = path.resolve(__dirname, '..'), SHARDS = 16;
function setup(candidate, sha) {
  candidate = fs.realpathSync(candidate); M.sha(sha);
  if (candidate === TOOLING) throw Error('Candidate and tooling require separate checkouts.');
  const source = M.identity(candidate), runner = M.identity(TOOLING);
  if (source.commit !== sha || process.env.GITHUB_SHA && process.env.GITHUB_SHA !== runner.commit) throw Error('Checkout identity mismatch.');
  return { candidate, source, runner };
}
function empty(output) {
  fs.mkdirSync(output, { recursive: true });
  if (fs.readdirSync(output).length) throw Error('Preserve earlier evidence; output must be empty.');
}
function planRun(candidate, sha, output) {
  const ctx = setup(candidate, sha), discovery = M.discovery(candidate);
  const splitter = require(path.join(candidate, 'scripts/lib/delen'));
  const partitions = M.partition(discovery.rows, SHARDS, splitter.indeling);
  const instrument = ['scripts/mutatie.js', 'scripts/lib/stempel.js', 'scripts/afbouw-slot.js',
    'scripts/ast/lexer.js', 'scripts/lib/regexmutatie.js', 'scripts/lib/delen.js', 'scripts/lib/pg-toetslijst.js']
    .map(p => ({ path: p, sha256: M.hash(fs.readFileSync(M.file(candidate, p))) }));
  const plan = M.seal({ schema: 'RTG_MUTATION_PLAN_V1', createdAt: new Date().toISOString(),
    candidate: ctx.source, runner: ctx.runner, ...discovery, shards: partitions, instrument,
    durationsSha256: M.hash(fs.readFileSync(path.join(candidate, 'TOETSDUUR.json'))),
    dependencyLockSha256: M.hash(fs.readFileSync(path.join(candidate, 'package-lock.json'))),
    costModel: splitter.weging(discovery.rows.map(r => r.name)),
    limits: { shardMinutes: 120, caseMinutes: 17, motorMinutes: 12, restoreMinutes: 4 },
    scope: 'Existing generic mutation motor, unchanged operators and assertions. No quota; every gap receives a result, including UNSEEN and UNMEASURABLE.' });
  empty(output); M.write(path.join(output, 'PLAN.json'), plan);
  console.log(JSON.stringify({ plan: plan.digest, discovered: plan.rows.length, perShard: partitions.map(s => s.length), costModel: plan.costModel }));
  return plan;
}
function checkPlan(ctx, plan) {
  M.verify(plan);
  if (JSON.stringify(ctx.source) !== JSON.stringify(plan.candidate) || JSON.stringify(ctx.runner) !== JSON.stringify(plan.runner)) throw Error('Plan belongs to another candidate or tooling revision.');
  if (JSON.stringify(M.discovery(ctx.candidate)) !== JSON.stringify({ rows: plan.rows, historicalOnly: plan.historicalOnly, historicalRegisterSha256: plan.historicalRegisterSha256 })) throw Error('Discovery changed.');
  M.partition(plan.rows, SHARDS, () => plan.shards);
  for (const f of plan.instrument) if (M.hash(fs.readFileSync(M.file(ctx.candidate, f.path))) !== f.sha256) throw Error('Candidate instrument changed.');
}
module.exports = { setup, empty, planRun, checkPlan, TOOLING, SHARDS };
