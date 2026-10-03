'use strict';
/* Herhaalbare voorbereiding en beoordeling van de geïsoleerde CI-storm.
   Dit start geen belasting en verandert geen norm. Een meting hoort bij één
   schone kandidaat en moet op vergelijkbare hardware de originele doelen halen. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const OUT = path.join('artifacts', 'performance-debt');
const TARGETS = Object.freeze({ p99Ms: 144, eventLoopP99Ms: 64.8 });
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const { PRESTATIEMETERS, oordeel } = require('./norm');
const heap = require('./lib/heapdiagnose');
const finite = n => typeof n === 'number' && Number.isFinite(n);

function assess(candidate, norm, measurement, profiling = false) {
  const proof = { commit: candidate, status: 'BLOCKED', blockers: [], targets: TARGETS };
  if (profiling || measurement?.diagnosticOnly) proof.blockers.push('Profiler is active; diagnostic timings cannot close performance debt.');
  if (!/^[a-f0-9]{40}$/.test(candidate || '')) proof.blockers.push('No full candidate commit was supplied.');
  if (!measurement) {
    proof.blockers.push('The current storm produced no completed measurement; historical values cannot stand in for it.');
    return proof;
  }
  proof.measurement = measurement;
  const stamp = measurement.stempel || {};
  const short = stamp.commit || '';
  if (typeof short !== 'string' || !/^[a-f0-9]{7,40}$/.test(short) || !String(candidate).startsWith(short) || stamp.boomVuil !== false) {
    proof.blockers.push('Measurement does not bind to the clean candidate commit.');
  }
  const machine = measurement.machine || {};
  const shape = machine.kernen + 'k/' + machine.geheugenGB + 'g/' + machine.platform + '/' + measurement.modus;
  const calibration = machine.kalibratieBasisMs, baseline = norm.prestatieKalibratie;
  const comparable = shape === norm.prestatieBron && finite(calibration) && calibration > 0 && finite(baseline) && baseline > 0
    && Math.max(calibration / baseline, baseline / calibration) <= 1.4;
  proof.hardwareComparison = { current: shape, baseline: norm.prestatieBron, calibrationMs: calibration, baselineCalibrationMs: baseline, comparable };
  if (!comparable) proof.blockers.push('Hardware or calibration differs from the recorded baseline; debt cannot be declared repaid on this measurement.');
  const metrics = measurement.meters || {};
  if (measurement.oordeel !== 'PASS' || measurement.gezakteDrempels !== 0) proof.blockers.push('Existing storm correctness/recovery assertions did not all pass.');
  if (!finite(metrics.stormDuurSec) || metrics.stormDuurSec < 180 || metrics.endpointsOnbereikt !== 0) {
    proof.blockers.push('The required duration or discovered-endpoint coverage was not completed.');
  }
  for (const [name, target] of Object.entries(TARGETS)) {
    const value = metrics[name];
    if (!finite(value) || value < 0 || value > target) proof.blockers.push(name + ': measured ' + value + ', original target ' + target);
  }
  // De twee af te lossen schulden vervangen de overige bestaande lat niet.
  proof.normResults = PRESTATIEMETERS.map(m => {
    const value = metrics[m.sleutel], limit = norm.prestatie?.[m.sleutel];
    const pass = finite(value) && finite(limit) && oordeel(m, value, limit) !== 'slechter';
    if (!pass) proof.blockers.push(m.sleutel + ': measured ' + value + ', existing norm ' + limit + ' (' + m.richting + ')');
    return { metric: m.sleutel, direction: m.richting, value, limit, status: pass ? 'PASS' : 'BLOCKED' };
  });
  if (!proof.blockers.length) proof.status = 'PASS';
  return proof;
}

function prepare(root = process.cwd(), env = process.env) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(env.RTG_PERFORMANCE_COMMIT || '') || commit !== env.RTG_PERFORMANCE_COMMIT) throw new Error('Candidate commit mismatch.');
  if (heap.active(env)) {
    heap.identity(env);
    heap.check(!env.RTG_CPU_PROFILE_DIR && env.LEK_RONDES === '2', 'heap-workload-mode');
    heap.check(path.resolve(env.RTG_HEAP_PROFILE_DIR) === path.join(root, OUT, 'heap'), 'heap-output-directory');
    heap.check(!fs.existsSync(env.RTG_HEAP_PROFILE_DIR), 'heap-stale-output');
  }
  const out = path.join(root, OUT);
  fs.mkdirSync(out, { recursive: true });
  for (const name of ['BEPROEVING.json', 'LAATSTE_METING.json']) {
    const source = path.join(root, name);
    if (fs.existsSync(source)) { fs.copyFileSync(source, path.join(out, 'previous-' + name)); fs.unlinkSync(source); }
  }
  const manifest = {
    commit,
    normSha256: hash(fs.readFileSync(path.join(root, 'NORM.json'))),
    platform: [os.platform(), os.release(), os.arch()].join('/'),
    cpu: execFileSync('lscpu', { encoding: 'utf8' }),
    workload: Object.fromEntries(['STORM_WERKERS', 'SOAK_MIN', 'MEGA_SEED', 'LEK_MS', 'LEK_RONDES'].map(key => [key, env[key]])),
    profiling: Boolean(env.RTG_CPU_PROFILE_DIR),
    diagnosticOnly: Boolean(env.RTG_CPU_PROFILE_DIR || env.RTG_HEAP_PROFILE_DIR),
    heapRequested: heap.active(env),
    toolingCommit: env.RTG_PERFORMANCE_WORKFLOW_COMMIT,
    candidateToolingSha256: Object.fromEntries(['scripts/beproeving.js', 'scripts/gc-hook.js', 'scripts/heap-profile-hook.js',
      'scripts/lib/heapdiagnose.js', 'scripts/performance-debt.js', '.github/workflows/ronde.yml'].map(file => [file, hash(fs.readFileSync(path.join(root, file)))])),
    runtimeTrees: Object.fromEntries(['server', 'public', 'package.json', 'package-lock.json'].map(file =>
      [file, execFileSync('git', ['rev-parse', 'HEAD:' + file], { cwd: root, encoding: 'utf8' }).trim()])),
    isolation: 'Fresh GitHub-hosted runner; temporary SQLite directory; no production or provider credentials.'
  };
  fs.writeFileSync(path.join(out, 'RUN-IDENTITY.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function evaluate(root = process.cwd(), env = process.env) {
  const out = path.join(root, OUT);
  fs.mkdirSync(out, { recursive: true });
  const norm = JSON.parse(fs.readFileSync(path.join(root, 'NORM.json'), 'utf8'));
  const source = path.join(root, 'LAATSTE_METING.json');
  const bytes = fs.existsSync(source) ? fs.readFileSync(source) : null;
  const runFile = path.join(out, 'RUN-IDENTITY.json');
  const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile)) : {};
  const diagnostic = Boolean(env.RTG_CPU_PROFILE_DIR || env.RTG_HEAP_PROFILE_DIR || run.diagnosticOnly);
  const proof = assess(env.RTG_PERFORMANCE_COMMIT, norm, bytes ? JSON.parse(bytes.toString()) : null, diagnostic);
  if (heap.active(env) || run.heapRequested) {
    proof.diagnosticOnly = true;
    proof.heapDiagnostic = heap.verify(path.join(out, 'heap'), {
      candidate: env.RTG_PERFORMANCE_COMMIT, tooling: env.RTG_PERFORMANCE_WORKFLOW_COMMIT || run.toolingCommit });
    if (proof.heapDiagnostic.status !== 'COMPLETE') proof.blockers.push('Heap diagnostic incomplete or invalid: ' + proof.heapDiagnostic.reason);
    proof.status = 'BLOCKED';
  }
  if (bytes) proof.measurementSha256 = hash(bytes);
  fs.writeFileSync(path.join(out, 'PERFORMANCE-DEBT-PROOF.json'), JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (require.main === module) {
  const command = process.argv[2];
  if (command === 'prepare') console.log(JSON.stringify(prepare(), null, 2));
  else if (command === 'evaluate') {
    const proof = evaluate();
    console.log(JSON.stringify(proof, null, 2));
    process.exitCode = proof.status === 'PASS' ? 0 : 1;
  } else { console.error('Usage: node scripts/performance-debt.js prepare|evaluate'); process.exitCode = 2; }
}
module.exports = { assess, prepare, evaluate, TARGETS };
