/* Kleine lokale bediening voor de zelfstandige Rust Sentinel. Dit bestand
   leest uitsluitend de Sentinel-sleutel en het releasebewijs; het start nooit
   de app en deelt de sleutel ook niet met een app-proces. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const BIN = fs.existsSync('/app/rtg-sentinel') ? '/app/rtg-sentinel'
  : path.join(ROOT, 'motor', 'target', 'release', 'rtg-sentinel');
const TOKEN = path.resolve(process.env.RTG_SENTINEL_TOKEN_FILE || path.join(ROOT, '.sentinel-token'));
const DATA = path.resolve(process.env.RTG_SENTINEL_DATA || path.join(ROOT, 'sentinel-data'));
const BEWIJS = path.resolve(process.env.RTG_SENTINEL_BEWIJS || path.join(ROOT, '.release', 'release-bewijs.json'));

function voer(args, extraEnv = {}) {
  if (!fs.existsSync(BIN)) throw new Error('Sentinel-binary ontbreekt; draai eerst npm run motor:build.');
  const veiligEnv = {};
  for (const naam of ['PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ'])
    if (process.env[naam]) veiligEnv[naam] = process.env[naam];
  for (const [naam, waarde] of Object.entries(process.env))
    if (naam.startsWith('RTG_SENTINEL_') && naam !== 'RTG_SENTINEL_TOKEN') veiligEnv[naam] = waarde;
  if (process.env.RTG_RELEASE_BEWIJS_SHA256) veiligEnv.RTG_RELEASE_BEWIJS_SHA256 = process.env.RTG_RELEASE_BEWIJS_SHA256;
  const r = spawnSync(BIN, args, { cwd: ROOT, stdio: 'inherit', env: {
    ...veiligEnv, RTG_SENTINEL_TOKEN_FILE: TOKEN, RTG_SENTINEL_DATA: DATA,
    RTG_SENTINEL_ROOT: ROOT, RTG_SENTINEL_BEWIJS: BEWIJS, ...extraEnv
  } });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}

function hoofd() {
  const args = process.argv.slice(2);
  const commando = args.shift() || 'status';
  if (commando === 'init') return voer(['init', TOKEN]);
  if (!fs.existsSync(TOKEN)) throw new Error('Sentinel-beheersleutel ontbreekt; draai npm run sentinel:init.');
  if (commando === 'serve' || commando === 'start') {
    if (!fs.existsSync(BEWIJS)) throw new Error('Releasebewijs ontbreekt; draai npm run release:build.');
    const pin = process.env.RTG_RELEASE_BEWIJS_SHA256 ||
      crypto.createHash('sha256').update(fs.readFileSync(BEWIJS)).digest('hex');
    return voer(['serve'], { RTG_RELEASE_BEWIJS_SHA256: pin });
  }
  if (commando === 'verify-audit') return voer(['verify-audit']);
  if (commando === 'recover-audit') {
    if (!fs.existsSync(BEWIJS)) throw new Error('Releasebewijs ontbreekt; herstel eerst vanuit een bekende release.');
    const pin = process.env.RTG_RELEASE_BEWIJS_SHA256 ||
      crypto.createHash('sha256').update(fs.readFileSync(BEWIJS)).digest('hex');
    return voer(['recover-audit', ...args], { RTG_RELEASE_BEWIJS_SHA256: pin });
  }
  const ctl = new Set(['status', 'audit', 'scan', 'watch', 'restrict', 'isolate', 'restore']);
  if (!ctl.has(commando)) throw new Error('Gebruik: init, start, status, audit, scan, watch, restrict, isolate, restore, verify-audit of recover-audit.');
  voer(['ctl', commando, ...args]);
}

try { hoofd(); } catch (e) { console.error('[sentinel-beheer] ' + e.message); process.exitCode = 1; }
