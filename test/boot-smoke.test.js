'use strict';
/* Start-rooktest: boot de ECHTE server als kindproces met een verse, tijdelijke
   database en controleer dat hij (a) opstart zonder fatale uitzondering en
   (b) op de site-root het RTG OS-bureaublad (de ROS-poort) serveert - niet de
   oude hub, niet een 500.

   Waarom: een unittest raakt losse functies, maar niets startte tot nu toe de
   hele applicatie op. Zo glipte een crash-bij-opstart (een module die een niet-
   bestaande functie aanriep) én een verkeerde root-route langs alle groene
   tests. Deze test dekt die hele klasse in één keer af. */
const { test } = require('node:test');
const assert = require('node:assert');
const cp = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function haal(port, pad) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pad, timeout: 4000 }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

async function wachtTotOp(port, uitInfo, tot = 15000) {
  const eind = Date.now() + tot;
  while (Date.now() < eind) {
    if (uitInfo.fataal) throw new Error('server crashte bij opstart:\n' + uitInfo.log.slice(-2000));
    try { const r = await haal(port, '/'); if (r.status) return r; } catch (e) { /* nog niet op */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('server werd niet bereikbaar binnen ' + tot + 'ms\n' + uitInfo.log.slice(-2000));
}

test('de server boot en serveert de ROS-poort op de root', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-boot-'));
  const port = 34000 + Math.floor(Math.random() * 2000);
  const kind = cp.spawn(process.execPath, ['--experimental-sqlite', 'server/server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(port), RTG_DATA_DIR: dataDir, RTG_CSP_NONCE: '0',
      NODE_ENV: 'test', RTG_DEMO: '1', ANTHROPIC_API_KEY: '', RTG_PG: ''
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const uitInfo = { log: '', fataal: false };
  const vang = d => { uitInfo.log += d; if (/uncaughtException|"fataal":true|is not a function/.test(String(d))) uitInfo.fataal = true; };
  kind.stdout.on('data', vang);
  kind.stderr.on('data', vang);

  try {
    const r = await wachtTotOp(port, uitInfo);
    // 1) de root reageert met een echte pagina
    assert.equal(r.status, 200, 'root gaf status ' + r.status + ' i.p.v. 200');
    // 2) het is het RTG OS-bureaublad (de ROS-poort), herkenbaar aan het slot + het gategrid
    assert.ok(/id="gate"/.test(r.body) && /os-lock|os-grid/.test(r.body),
      'root serveert niet de ROS-poort (klokscherm) maar iets anders');
    // 3) niet per ongeluk de oude hub-index
    assert.ok(!/RTG OS het bureaublad|het bureaublad/i.test(r.body) || /os-lock/.test(r.body),
      'root serveert de oude hub in plaats van de ROS');
    // 4) geen fatale uitzondering onderweg
    assert.equal(uitInfo.fataal, false, 'server logde een fatale fout:\n' + uitInfo.log.slice(-1500));
  } finally {
    kind.kill('SIGKILL');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
