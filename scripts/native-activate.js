#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { setTimeout:pause } = require('node:timers/promises');
const host = require('./lib/native-host'), native = require('./lib/native-artifact');

function restart(config) {
  // Alleen deze ene service, nooit hostbrede processen zoeken of beëindigen.
  cp.execFileSync('/bin/launchctl', ['kickstart', '-k', 'gui/' + process.getuid() + '/' + config.service],
    { stdio:'pipe', timeout:15000 });
}
async function smoke(a) {
  const until = Date.now() + 90000;
  while (Date.now() < until) {
    try {
      const health = await fetch('http://127.0.0.1:' + a.config.port + '/api/health', { signal:AbortSignal.timeout(3000) }).then(r => r.json());
      const ready = await fetch('http://127.0.0.1:' + a.config.port + '/api/ready', { signal:AbortSignal.timeout(3000) }).then(r => r.json());
      if (health.ok && ready.ready && Number.isInteger(health.pid) && health.pid > 1) {
        const cwd = cp.execFileSync('/usr/sbin/lsof', ['-a', '-p', String(health.pid), '-d', 'cwd', '-Fn'], { encoding:'utf8', timeout:5000 });
        const command = cp.execFileSync('/bin/ps', ['-p', String(health.pid), '-o', 'comm='], { encoding:'utf8', timeout:5000 }).trim();
        if (cwd.split('\n').includes('n' + path.join(a.release, 'app')) && command === path.join(a.release, 'runtime/node')) {
          native.verifyInstalled(a.release, a.artifact.manifest);
          return { pid:health.pid, ready:true, digest:a.selected.digest, checkedAt:new Date().toISOString() };
        }
      }
    } catch (e) { if (Date.now() >= until) throw e; }
    await pause(250);
  }
  throw Error('Productiesmoke bevestigt niet het geautoriseerde native proces.');
}
async function activate(root, commit) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw Error('Native host is niet macOS arm64.');
  const a = host.authorized(root, commit, 'candidate');
  const lock = path.join(a.config.store, '.activation-lock');
  fs.mkdirSync(lock, { mode:0o700 });
  const report = { schema:'rtg-native-deployment-v1', commit, startedAt:new Date().toISOString(), status:'BLOCKED' };
  try {
    // Ook het terugvalpakket is aanwezig en geverifieerd vóór de eerste omschakeling.
    const old = host.authorized(root, commit, 'rollback');
    native.stage(old.archive, old.attestation, root, old.selected.commit, old.config.store);
    const selected = host.select(root, commit, 'candidate');
    try { restart(selected.config); report.smoke = await smoke(selected); report.status = 'LIVE'; }
    catch (e) {
      report.failure = e.message;
      const rollback = host.select(root, commit, 'rollback'); restart(rollback.config);
      report.rollback = await smoke(rollback); report.status = 'ROLLED_BACK';
      throw Error('Native uitrol faalde; exact het goedgekeurde vorige pakket draait weer.');
    }
    return report;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(root, '.release/native/DEPLOYMENT-RESULT.json'), JSON.stringify(report, null, 2) + '\n', { mode:0o600 });
    fs.rmdirSync(lock);
  }
}
if (require.main === module) activate(path.resolve(__dirname, '..'), process.argv[2])
  .then(r => console.log('NATIVE_DEPLOYMENT=' + r.status)).catch(e => { console.error('[native-activate] ' + e.message); process.exitCode = 1; });
module.exports = { activate, smoke };
