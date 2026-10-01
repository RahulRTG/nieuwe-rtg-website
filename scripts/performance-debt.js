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
const finite = n => typeof n === 'number' && Number.isFinite(n);

function assess(candidate, norm, measurement, profiling = false) {
  const proof = { commit: candidate, status: 'BLOCKED', blockers: [], targets: TARGETS };
  if (profiling) proof.blockers.push('Profiler is active; diagnostic timings cannot close performance debt.');
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
  if (!proof.blockers.length) proof.status = 'PASS';
  return proof;
}

function prepare(root = process.cwd(), env = process.env) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(env.RTG_PERFORMANCE_COMMIT || '') || commit !== env.RTG_PERFORMANCE_COMMIT) throw new Error('Candidate commit mismatch.');
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
  const proof = assess(env.RTG_PERFORMANCE_COMMIT, norm, bytes ? JSON.parse(bytes.toString()) : null, Boolean(env.RTG_CPU_PROFILE_DIR));
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
