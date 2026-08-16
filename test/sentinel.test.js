'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { maakManifest } = require('../scripts/release-bewijs');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'motor', 'target', 'release', 'rtg-sentinel');

function luister(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}
async function vrijePoort() {
  const s = http.createServer(); const p = await luister(s);
  await new Promise(r => s.close(r)); return p;
}
function beheer(poort, token, pad, body) {
  const tekst = body == null ? '' : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: poort, path: pad,
      method: body == null ? 'GET' : 'POST', headers: {
        Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(tekst)
      } }, res => { let data = ''; res.on('data', d => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) })); });
    req.on('error', reject); req.end(tekst);
  });
}
function publiekVerzoek(poort, pad, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: poort, path: pad,
      method: 'GET', agent: false, headers: { ...headers, Connection: 'close' } }, res => {
      let data = ''; res.on('data', d => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, tekst: data }));
    });
    req.on('error', reject); req.end();
  });
}
async function wachtOpBeheer(poort, token) {
  for (let i = 0; i < 100; i++) {
    try { const r = await beheer(poort, token, '/v1/status'); if (r.status === 200) return r; } catch (e) {}
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Sentinel-beheer kwam niet op.');
}

test('Sentinel bewaakt de echte procesgrens, standen en forwardingheaders',
  { timeout: 30000 }, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sentinel-e2e-'));
    const bewijs = path.join(tmp, 'release.json'); const data = path.join(tmp, 'data');
    const tekst = JSON.stringify(maakManifest(ROOT)); fs.writeFileSync(bewijs, tekst);
    const pin = crypto.createHash('sha256').update(tekst).digest('hex');
    const token = crypto.randomBytes(32).toString('hex'); let gezien;
    const upstream = http.createServer((req, res) => {
      gezien = req.headers;
      // Ook de echte failoverpoort kiest zijn backend asynchroon. Een proxy die
      // zijn TCP-schrijfhelft te vroeg sluit verliest juist dit antwoord.
      setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, pad: req.url })); }, 10);
    });
    const upstreamPoort = await luister(upstream);
    const publiek = await vrijePoort(); const controle = await vrijePoort();
    const env = { ...process.env, RTG_SENTINEL_TOKEN: token, RTG_SENTINEL_ROOT: ROOT,
      RTG_SENTINEL_BEWIJS: bewijs, RTG_SENTINEL_DATA: data,
      RTG_RELEASE_BEWIJS_SHA256: pin, RTG_SENTINEL_ADDR: '127.0.0.1:' + publiek,
      RTG_SENTINEL_CONTROL_ADDR: '127.0.0.1:' + controle,
      RTG_SENTINEL_UPSTREAM: '127.0.0.1:' + upstreamPoort,
      RTG_SENTINEL_FORWARDED_PROTO: 'https', RTG_SENTINEL_SCAN_SEC: '3600' };
    const child = spawn(BIN, ['serve'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'] });
    let childFout = ''; child.stderr.on('data', d => { childFout += d; });
    try {
      const start = await wachtOpBeheer(controle, token).catch(e => {
        throw new Error(e.message + (childFout ? '\n' + childFout : ''));
      });
      assert.equal(start.body.release.ok, true);
      const door = await publiekVerzoek(publiek, '/api/goed', {
        'X-Forwarded-For': '1.2.3.4', 'X-Forwarded-Proto': 'http'
      });
      assert.equal(door.status, 200); assert.equal(JSON.parse(door.tekst).pad, '/api/goed');
      assert.notEqual(gezien['x-forwarded-for'], '1.2.3.4');
      assert.equal(gezien['x-forwarded-proto'], 'https');

      let r = await beheer(controle, token, '/v1/mode', {
        mode: 'beperkt', prefixes: ['/api/pay'], reden: 'betaalroute tijdelijk gesloten'
      });
      assert.equal(r.status, 200);
      assert.equal((await publiekVerzoek(publiek, '/api/pay/stuur')).status, 503);
      assert.equal((await publiekVerzoek(publiek, '/api/goed')).status, 200);

      r = await beheer(controle, token, '/v1/mode', { mode: 'isolatie', reden: 'mogelijke besmetting wordt onderzocht' });
      assert.equal(r.status, 400, 'isolatie eist de letterlijke bevestiging');
      r = await beheer(controle, token, '/v1/mode', { mode: 'isolatie', reden: 'mogelijke besmetting wordt onderzocht', bevestiging: 'ISOLEER RTG' });
      assert.equal(r.status, 200);
      assert.equal((await publiekVerzoek(publiek, '/api/goed')).status, 503);
      assert.equal((await publiekVerzoek(publiek, '/__sentinel/ready')).status, 503);

      assert.equal((await beheer(controle, token, '/v1/scan', {})).status, 200);
      r = await beheer(controle, token, '/v1/mode', { mode: 'normaal', reden: 'schone release volledig onderzocht', bevestiging: 'HERSTEL RTG' });
      assert.equal(r.status, 200);
      assert.equal((await publiekVerzoek(publiek, '/api/goed')).status, 200);
    } finally {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill('SIGKILL'); await new Promise(r => child.once('exit', r));
      }
      if (typeof upstream.closeAllConnections === 'function') upstream.closeAllConnections();
      await new Promise(r => upstream.close(r));
    }
    const audit = spawnSync(BIN, ['verify-audit'], { cwd: ROOT, env, encoding: 'utf8' });
    assert.equal(audit.status, 0, audit.stderr); assert.match(audit.stdout, /Auditketen geldig/);
    fs.appendFileSync(path.join(data, 'audit.jsonl'), '{}\n');
    const kapot = spawnSync(BIN, ['verify-audit'], { cwd: ROOT, env, encoding: 'utf8' });
    assert.notEqual(kapot.status, 0, 'auditmanipulatie wordt ontdekt');
    const herstel = spawnSync(BIN, ['recover-audit', 'BEWAAR EN HERSTART AUDIT'], {
      cwd: ROOT, env, encoding: 'utf8'
    });
    assert.equal(herstel.status, 0, herstel.stderr);
    assert.match(herstel.stdout, /Nieuwe audit gestart in isolatie/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'state.json'))).mode, 'isolatie');
    assert.ok(fs.readdirSync(data).some(n => /^audit\.corrupt-\d+\.jsonl$/.test(n)), 'kapot bewijs blijft bewaard');
    assert.equal(spawnSync(BIN, ['verify-audit'], { cwd: ROOT, env }).status, 0, 'de nieuwe auditketen is geldig');
    fs.rmSync(tmp, { recursive: true, force: true });
  });
