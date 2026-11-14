#!/usr/bin/env node
'use strict';
/* Microbenchmark van alleen de deterministische warme compositiefunctie. Dit
   is geen scherm-, database- of netwerkmeting en wordt dus ook niet zo gemeld. */
const crypto = require('node:crypto');
const engine = require('../server/kern/personalos/engine');
const catalog = require('../server/kern/personalos/catalog');
const { normaliseer } = require('../server/kern/personalos/contract');

const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const args = { catalog: catalog.preview(),
  preferences: { ...normaliseer({ goals: ['ondernemen', 'reizen', 'bijdragen'],
    pinnedCapabilities: ['onderneming', 'connect'] }, catalog.allIds()), revision: 8 },
  contextRef: 'private:benchmark', subjectRef: 'member:BENCHMARK', authorityRevision: 'a_benchmark',
  catalogVersion: 'benchmark', now: () => '2026-11-10T10:00:00.000Z', hash };
const rondes = Math.max(1000, Math.min(Number(process.argv[2]) || 10000, 100000));
for (let i = 0; i < 500; i++) engine.maak(args);
const voor = process.memoryUsage().heapUsed;
const tijden = [];
for (let i = 0; i < rondes; i++) {
  const start = process.hrtime.bigint(); engine.maak(args);
  tijden.push(Number(process.hrtime.bigint() - start) / 1e6);
}
tijden.sort((a, b) => a - b);
const p = n => tijden[Math.min(tijden.length - 1, Math.floor(tijden.length * n / 100))];
const na = process.memoryUsage().heapUsed;
console.log(JSON.stringify({ scope: 'pure-hot-composition', rounds: rondes,
  p50Ms: Number(p(50).toFixed(4)), p95Ms: Number(p(95).toFixed(4)), p99Ms: Number(p(99).toFixed(4)),
  maxMs: Number(tijden[tijden.length - 1].toFixed(4)), heapDeltaBytes: na - voor,
  mandatoryAiCalls: 0, databaseRoundTrips: 0 }, null, 2));
