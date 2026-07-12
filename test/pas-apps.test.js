/* Integratietests voor de eigen app per pas: inloggegevens werken echt alleen
   in de app van de eigen pas (pasApp). De gratis laag heeft geen eigen app en
   speelt mee in de RTG-app; de brede leden-app (zonder pasApp) laat elke pas
   toe. Draai los: node --experimental-sqlite --test test/pas-apps.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4040 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pasapp-'));
let child;

function post(pad, body) {
  return fetch(BASE + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
}
async function registreer(naam, email, tier) {
  const r = await post('/api/auth/register', { name: naam, email, phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier });
  assert.equal(r.status, 200, 'registratie van ' + tier + ' lukt');
}

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server startte niet op tijd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('accountlogin: alleen in de app van de eigen pas; breed werkt altijd', async () => {
  await registreer('Bas Business', 'bas@x.nl', 'business');
  const login = (pasApp) => post('/api/auth/login', { login: 'bas@x.nl', password: 'geheim123', pasApp });
  assert.equal((await login('business')).status, 200, 'eigen pas-app: welkom');
  assert.equal((await login('lifestyle')).status, 403, 'andere pas-app: geweigerd');
  assert.equal((await login('rtg')).status, 403, 'ook de RTG-app weigert een Business-account');
  assert.equal((await login(undefined)).status, 200, 'de brede leden-app laat elke pas toe');
  const fout = await (await login('lifestyle')).json();
  assert.match(fout.error, /andere pas/i, 'de fout verwijst naar de eigen pas-app');
});

test('gratis laag: geen eigen app, speelt mee in de RTG-app', async () => {
  await registreer('Gea Gratis', 'gea@x.nl', 'guest');
  const login = (pasApp) => post('/api/auth/login', { login: 'gea@x.nl', password: 'geheim123', pasApp });
  assert.equal((await login('rtg')).status, 200, 'een gratis account logt in via de RTG-app');
  assert.equal((await login('business')).status, 403, 'maar niet via de Business-app');
  assert.equal((await login('lifestyle')).status, 403, 'en niet via de Lifestyle-app');
});

test('demoprofielen en registratie volgen dezelfde pas-vergrendeling', async () => {
  // demo-pas-login: alleen de eigen pas
  assert.equal((await post('/api/login', { tier: 'lifestyle', pasApp: 'business' })).status, 403);
  assert.equal((await post('/api/login', { tier: 'lifestyle', pasApp: 'lifestyle' })).status, 200);
  assert.equal((await post('/api/login', { tier: 'guest', pasApp: 'rtg' })).status, 200, 'gast-demo speelt in de RTG-app');
  // registreren in een pas-app kan alleen voor die pas (gratis mag in de RTG-app)
  assert.equal((await post('/api/auth/register', { name: 'Foute Pas', email: 'foutepas@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'lifestyle' })).status, 403);
  assert.equal((await post('/api/auth/register', { name: 'Gast In Rtg', email: 'gastinrtg@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest', pasApp: 'rtg' })).status, 200);
});
