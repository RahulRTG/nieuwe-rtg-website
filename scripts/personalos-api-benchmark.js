#!/usr/bin/env node
'use strict';
/* Herhaalbare loopbackmeting van de echte HTTP-, auth- en opslagroute. Dit is
   nog steeds geen apparaat- of internetmeting: de uitvoer noemt die grens
   expliciet zodat deze cijfers nooit als schermprestatie worden opgevoerd. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { startServer, stop } = require('../test/helper');

const percentiel = (waarden, n) => waarden[Math.min(waarden.length - 1,
  Math.floor(waarden.length * n / 100))];

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-personalos-api-'));
  let srv;
  try {
    srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir, RTG_AI_UIT: '1' } });
    let token = '';
    const post = async (route, body) => {
      const start = performance.now();
      const response = await fetch(srv.base + route, { method: 'POST', headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
      }, body: JSON.stringify(body || {}) });
      const text = await response.text();
      const ms = performance.now() - start;
      let json = {}; try { json = JSON.parse(text); } catch (e) {}
      if (!response.ok) throw new Error(route + ' gaf ' + response.status + ': ' + text.slice(0, 300));
      return { ms, bytes: Buffer.byteLength(text), json };
    };

    const firstStart = performance.now();
    const account = await post('/api/auth/register', { name: 'PersonalOS API Benchmark',
      email: 'personalo-api-' + Date.now() + '@benchmark.example', phone: '0612345678',
      password: 'benchmark-geheim-2026', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    token = account.json.token;
    await post('/api/personalos/complete', { goals: ['ondernemen', 'reizen'], layout: 'balanced', preferenceVersion: 0 });
    const firstComposition = await post('/api/personalos/composition', {});
    const registrationToCompositionMs = performance.now() - firstStart;

    const rounds = Math.max(20, Math.min(Number(process.argv[2]) || 100, 1000));
    const times = [], bytes = [];
    for (let i = 0; i < rounds; i++) {
      const result = await post('/api/personalos/composition', {});
      times.push(result.ms); bytes.push(result.bytes);
    }
    times.sort((a, b) => a - b); bytes.sort((a, b) => a - b);
    process.stdout.write(JSON.stringify({ scope: 'loopback-http-auth-storage-composition', rounds,
      registrationToFirstUsableCompositionMs: Number(registrationToCompositionMs.toFixed(2)),
      apiLatencyMs: { p50: Number(percentiel(times, 50).toFixed(2)),
        p95: Number(percentiel(times, 95).toFixed(2)), p99: Number(percentiel(times, 99).toFixed(2)),
        max: Number(times[times.length - 1].toFixed(2)) },
      responseBytes: { p50: percentiel(bytes, 50), max: bytes[bytes.length - 1], first: firstComposition.bytes },
      mandatoryAiCalls: 0, includes: ['HTTP', 'auth', 'member_state read', 'authority adapter', 'composition'],
      excludes: ['internet', 'TLS', 'browser rendering', 'FCP', 'LCP', 'INP', 'device memory'] }, null, 2) + '\n');
  } finally {
    if (srv) await stop(srv.child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
