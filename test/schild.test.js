/* Het schild: de applicatie-WAF, de DDoS-banlijst en de kortlevende
   TURN-inloggegevens. Extern verkeer wordt gesimuleerd met een
   X-Forwarded-For-header (trust proxy staat aan); localhost zelf is
   uitgezonderd zodat health-checks en de testsuite nooit geraakt worden.
   Draai: node --experimental-sqlite --test test/schild.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schild-'));
const TURN_SECRET = 'orkaan-turn-geheim';

const vraag = (pad, ip, extra) => fetch(BASE + pad, Object.assign({}, extra || {}, {
  headers: Object.assign({ 'X-Forwarded-For': ip }, (extra && extra.headers) || {})
}));

// fetch normaliseert URL's (%2e%2e wordt netjes opgelost); een echte aanvaller
// stuurt de rauwe bytes. Deze helper doet dat ook.
const rauw = (pad, ip) => new Promise((resolve, reject) => {
  const u = new URL(BASE);
  http.get({ host: u.hostname, port: u.port, path: pad, headers: { 'X-Forwarded-For': ip } },
    res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
});

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: {
    RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_SCHILD_PLAFOND: '60',
    TURN_URL: 'turn:turn.rtg.example:3478', TURN_SECRET
  } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('WAF: sondes en scanners worden geblokkeerd, gewoon verkeer niet', async () => {
  assert.equal((await vraag('/wp-admin/setup.php', '203.0.113.10')).status, 403, 'wordpress-sonde');
  assert.equal((await vraag('/.env', '203.0.113.10')).status, 403, 'dotenv-sonde');
  assert.equal(await rauw('/api/%2e%2e/%2e%2e/etc/passwd', '203.0.113.10'), 403, 'pad-klimmen');
  assert.equal(await rauw('/api/../../etc/passwd', '203.0.113.10'), 403, 'pad-klimmen (onversleuteld)');
  assert.equal((await vraag('/apps/index.html', '203.0.113.11', { headers: { 'User-Agent': 'sqlmap/1.7' } })).status, 403, 'scanner-user-agent');
  // gewoon verkeer van een ander IP gaat gewoon door
  assert.equal((await vraag('/apps/index.html', '203.0.113.12')).status, 200);
});

test('banlijst: herhaalde WAF-treffers zetten het IP 15 minuten op slot', async () => {
  for (let i = 0; i < 5; i++) await vraag('/wp-login.php?p=' + i, '203.0.113.20');
  // nu is zelfs een onschuldig verzoek van dit IP geblokkeerd
  assert.equal((await vraag('/apps/index.html', '203.0.113.20')).status, 403);
  // maar een ander IP heeft nergens last van
  assert.equal((await vraag('/apps/index.html', '203.0.113.21')).status, 200);
});

test('DDoS-rem: boven het plafond gaat het IP op de banlijst; localhost nooit', async () => {
  let status = 200;
  for (let i = 0; i < 70 && status !== 403; i++) status = (await vraag('/api/health', '203.0.113.30')).status;
  assert.equal(status, 403, 'boven het plafond (60/10s) volgt de ban');
  // localhost (geen X-Forwarded-For) blijft er volledig buiten
  for (let i = 0; i < 70; i++) assert.equal((await fetch(BASE + '/api/health')).status, 200);
});

test('TURN: /api/ice geeft kortlevende inloggegevens met een kloppende HMAC', async () => {
  const d = await (await fetch(BASE + '/api/ice')).json();
  const turn = d.iceServers.find(s => String(s.urls).includes('turn:'));
  assert.ok(turn, 'de TURN-server staat in de lijst');
  assert.match(turn.username, /^\d+:rtg$/);
  const verloopt = Number(turn.username.split(':')[0]);
  assert.ok(verloopt * 1000 > Date.now() + 30 * 60000, 'minstens een half uur geldig');
  assert.ok(verloopt * 1000 < Date.now() + 2 * 3600000, 'maar niet eeuwig');
  const verwacht = crypto.createHmac('sha1', TURN_SECRET).update(turn.username).digest('base64');
  assert.equal(turn.credential, verwacht, 'de HMAC klopt met het gedeelde geheim (coturn use-auth-secret)');
});
