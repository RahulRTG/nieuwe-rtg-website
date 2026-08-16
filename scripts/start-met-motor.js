/* Start RTG als lokale veiligheidsketen:

     browser -> onafhankelijke Rust Sentinel -> Node failover-trio -> Rust motor

   Sentinel krijgt noch app-geheimen noch medewerking van Node nodig om verkeer
   af te sluiten. Voor elke start wordt een vers, extern gepind releasebewijs
   gemaakt. Eén commando, zonder npm-runtime-dependencies. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'motor', 'target', 'release', 'rtg-motor');
const SENTINEL_BIN = path.join(ROOT, 'motor', 'target', 'release', 'rtg-sentinel');
const SENTINEL_TOKEN = path.join(ROOT, '.sentinel-token');
// Een staging- of herstelproef moet de echte Sentinel-historie nooit mengen
// met tijdelijke auditdata. Productie behoudt zonder override exact dezelfde
// vaste locatie; tests en repetities kunnen een geïsoleerde map aanwijzen.
const SENTINEL_DATA = process.env.RTG_SENTINEL_DATA || path.join(ROOT, 'sentinel-data');
const BEWIJS = path.join(ROOT, '.release', 'release-bewijs.json');
const CARGO = process.env.CARGO || 'cargo';

function zonderSentinelGeheim(env) {
  const uit = { ...env };
  for (const naam of Object.keys(uit)) if (naam.startsWith('RTG_SENTINEL_')) delete uit[naam];
  return uit;
}
function sentinelBasisEnv() {
  const uit = {};
  for (const naam of ['PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ'])
    if (process.env[naam]) uit[naam] = process.env[naam];
  /* Alleen Sentinel-instellingen, nooit app-/kluis-/betaalsleutels. Het token
     zelf komt verplicht uit het losse bestand en wordt ook hier niet geërfd. */
  for (const [naam, waarde] of Object.entries(process.env))
    if (naam.startsWith('RTG_SENTINEL_') && !['RTG_SENTINEL_TOKEN', 'RTG_SENTINEL_TOKEN_FILE'].includes(naam)) uit[naam] = waarde;
  return uit;
}

if (!fs.existsSync(BIN) || !fs.existsSync(SENTINEL_BIN)) {
  console.log('[rust-start] native binaries ontbreken; eenmalig release-build uitvoeren...');
  const b = spawnSync(CARGO, ['build', '--release', '--manifest-path', path.join(ROOT, 'motor', 'Cargo.toml'), '--locked'], {
    cwd: ROOT, stdio: 'inherit'
  });
  if (b.status !== 0 || !fs.existsSync(BIN) || !fs.existsSync(SENTINEL_BIN)) process.exit(b.status || 1);
}

if (!fs.existsSync(SENTINEL_TOKEN)) {
  const i = spawnSync(SENTINEL_BIN, ['init', SENTINEL_TOKEN], { cwd: ROOT, stdio: 'inherit' });
  if (i.status !== 0 || !fs.existsSync(SENTINEL_TOKEN)) process.exit(i.status || 1);
}

/* De gebouwde frontend is onderdeel van het bewijs. Opzettelijk iedere start:
   zo kan een oude manifest-pin nooit per ongeluk een nieuwe werkboom zegenen. */
for (const [script, label] of [[path.join(ROOT, 'scripts', 'build.js'), 'frontend-build'],
  [path.join(ROOT, 'scripts', 'release-bewijs.js'), 'releasebewijs']]) {
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { console.error('[rust-start] ' + label + ' is mislukt.'); process.exit(r.status || 1); }
}
const bewijsPin = crypto.createHash('sha256').update(fs.readFileSync(BEWIJS)).digest('hex');

const adres = process.env.RTG_MOTOR_ADDR || '127.0.0.1:3100';
const token = process.env.RTG_MOTOR_TOKEN || crypto.randomBytes(32).toString('hex');
const publiekePoort = Number(process.env.PORT || 3000);
const internePoort = Number(process.env.RTG_SENTINEL_APP_PORT || publiekePoort + 20);
const sentinelAdres = process.env.RTG_SENTINEL_ADDR || '127.0.0.1:' + publiekePoort;
const sentinelControle = process.env.RTG_SENTINEL_CONTROL_ADDR || '127.0.0.1:' + (publiekePoort + 91);
if (![publiekePoort, internePoort].every(Number.isSafeInteger) || publiekePoort < 1 || internePoort < 1 || publiekePoort > 65535 || internePoort > 65535) {
  console.error('[rust-start] ongeldige publieke of interne poort.'); process.exit(1);
}
const dataMap = path.join(ROOT, 'server', 'data', 'motor');
fs.mkdirSync(dataMap, { recursive: true, mode: 0o700 });
fs.mkdirSync(SENTINEL_DATA, { recursive: true, mode: 0o700 });

const gedeeld = Object.assign(zonderSentinelGeheim(process.env), {
  RTG_MOTOR_ADDR: adres,
  RTG_MOTOR_TOKEN: token,
  RTG_MOTOR_SALDI: '1',
  RTG_MOTOR_DATA: process.env.RTG_MOTOR_DATA || path.join(dataMap, 'state.json'),
  RTG_MOTOR_GIDS: process.env.RTG_MOTOR_GIDS || path.join(dataMap, 'gids.bin'),
  RTG_KLUIS_KEY_FILE: process.env.RTG_KLUIS_KEY_FILE || path.join(dataMap, 'secret.key'),
  RTG_KLUIS_DATA: process.env.RTG_KLUIS_DATA || path.join(dataMap, 'kluis.json')
});

const motor = spawn(BIN, [], { cwd: ROOT, env: gedeeld, stdio: 'inherit' });
const appEnv = Object.assign(zonderSentinelGeheim(process.env), {
  PORT: String(internePoort),
  RTG_MOTOR_TOKEN: token,
  RTG_MOTOR_SHADOW: process.env.RTG_MOTOR_SHADOW || 'http://' + adres,
  RTG_MOTOR_GELD_URL: process.env.RTG_MOTOR_GELD_URL || 'http://' + adres,
  RTG_MOTOR_REKEN_URL: process.env.RTG_MOTOR_REKEN_URL || 'http://' + adres,
  RTG_MAGNAAT_RUST: process.env.RTG_MAGNAAT_RUST || 'motor',
  RTG_CAPABILITY_RUST_BIN: process.env.RTG_CAPABILITY_RUST_BIN || BIN,
  RTG_CAPABILITY_RUST_MODE: process.env.RTG_CAPABILITY_RUST_MODE || 'canary',
  RTG_CAPABILITY_RUST_CANARY_PCT: process.env.RTG_CAPABILITY_RUST_CANARY_PCT || '10'
});
const app = spawn(process.execPath, [path.join(ROOT, 'server', 'trio.js')], { cwd: ROOT, env: appEnv, stdio: 'inherit' });
const sentinelEnv = Object.assign(sentinelBasisEnv(), {
  RTG_SENTINEL_TOKEN_FILE: SENTINEL_TOKEN,
  RTG_SENTINEL_ROOT: ROOT,
  RTG_SENTINEL_BEWIJS: BEWIJS,
  RTG_SENTINEL_DATA: SENTINEL_DATA,
  RTG_RELEASE_BEWIJS_SHA256: bewijsPin,
  RTG_SENTINEL_ADDR: sentinelAdres,
  RTG_SENTINEL_CONTROL_ADDR: sentinelControle,
  RTG_SENTINEL_UPSTREAM: '127.0.0.1:' + internePoort,
  RTG_SENTINEL_FORWARDED_PROTO: 'http',
  RTG_SENTINEL_FAIL_CLOSED: '1'
});
const sentinel = spawn(SENTINEL_BIN, ['serve'], { cwd: ROOT, env: sentinelEnv, stdio: 'inherit' });
console.log('[rust-start] openbare voordeur: http://' + sentinelAdres);
console.log('[rust-start] beheer: RTG_SENTINEL_CONTROL_ADDR=' + sentinelControle + ' npm run sentinel:status');

let afsluiten = false;
function stop(code) {
  if (afsluiten) return;
  afsluiten = true;
  if (!motor.killed) motor.kill('SIGTERM');
  if (!app.killed) app.kill('SIGTERM');
  if (!sentinel.killed) sentinel.kill('SIGTERM');
  setTimeout(() => process.exit(code || 0), 250).unref();
}
motor.on('exit', code => { if (!afsluiten) { console.error('[rust-start] motor stopte (' + code + '); app wordt gesloten.'); stop(code || 1); } });
app.on('exit', code => { if (!afsluiten) stop(code || 0); });
sentinel.on('exit', code => { if (!afsluiten) { console.error('[rust-start] Sentinel stopte (' + code + '); app en motor worden gesloten.'); stop(code || 1); } });
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
