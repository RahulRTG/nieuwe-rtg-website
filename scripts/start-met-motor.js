/* Start de gewone RTG-server met de Rust-motor als continu gecontroleerde
   schaduwmotor. Eén commando voor lokaal gebruik, zonder Docker of dependency.
   Node blijft autoritatief; zet RTG_MOTOR_GELD=motor pas na de canary/cutover. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'motor', 'target', 'release', 'rtg-motor');
const CARGO = process.env.CARGO || 'cargo';

if (!fs.existsSync(BIN)) {
  console.log('[rust-start] motor ontbreekt; eenmalig release-build uitvoeren...');
  const b = spawnSync(CARGO, ['build', '--release', '--manifest-path', path.join(ROOT, 'motor', 'Cargo.toml'), '--locked'], {
    cwd: ROOT, stdio: 'inherit'
  });
  if (b.status !== 0 || !fs.existsSync(BIN)) process.exit(b.status || 1);
}

const adres = process.env.RTG_MOTOR_ADDR || '127.0.0.1:3100';
const token = process.env.RTG_MOTOR_TOKEN || crypto.randomBytes(32).toString('hex');
const dataMap = path.join(ROOT, 'server', 'data', 'motor');
fs.mkdirSync(dataMap, { recursive: true, mode: 0o700 });

const gedeeld = Object.assign({}, process.env, {
  RTG_MOTOR_ADDR: adres,
  RTG_MOTOR_TOKEN: token,
  RTG_MOTOR_SALDI: '1',
  RTG_MOTOR_DATA: process.env.RTG_MOTOR_DATA || path.join(dataMap, 'state.json'),
  RTG_MOTOR_GIDS: process.env.RTG_MOTOR_GIDS || path.join(dataMap, 'gids.bin'),
  RTG_KLUIS_KEY_FILE: process.env.RTG_KLUIS_KEY_FILE || path.join(dataMap, 'secret.key'),
  RTG_KLUIS_DATA: process.env.RTG_KLUIS_DATA || path.join(dataMap, 'kluis.json')
});

const motor = spawn(BIN, [], { cwd: ROOT, env: gedeeld, stdio: 'inherit' });
const appEnv = Object.assign({}, process.env, {
  RTG_MOTOR_TOKEN: token,
  RTG_MOTOR_SHADOW: process.env.RTG_MOTOR_SHADOW || 'http://' + adres,
  RTG_MOTOR_GELD_URL: process.env.RTG_MOTOR_GELD_URL || 'http://' + adres
});
const app = spawn(process.execPath, [path.join(ROOT, 'server', 'trio.js')], { cwd: ROOT, env: appEnv, stdio: 'inherit' });

let afsluiten = false;
function stop(code) {
  if (afsluiten) return;
  afsluiten = true;
  if (!motor.killed) motor.kill('SIGTERM');
  if (!app.killed) app.kill('SIGTERM');
  setTimeout(() => process.exit(code || 0), 250).unref();
}
motor.on('exit', code => { if (!afsluiten) { console.error('[rust-start] motor stopte (' + code + '); app wordt gesloten.'); stop(code || 1); } });
app.on('exit', code => { if (!afsluiten) stop(code || 0); });
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
