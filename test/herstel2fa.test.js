/* Integratietests voor wachtwoordherstel met tweestapsverificatie (link per
   e-mail + code op de telefoon) en wachtwoord wijzigen vanuit de eigen
   backoffice. Zonder SMTP geeft de server dev-velden terug zodat de flow
   volledig te testen is. Draai: node --experimental-sqlite --test test/herstel2fa.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4120 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-2fa-'));
let child;

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const tokenUit = (url) => new URL(url).searchParams.get('reset');

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  await post('/api/auth/register', { name: 'Vera Vergeet', email: 'vera@x.nl', phone: '0612345678',
    password: 'oudgeheim', geboortedatum: '1990-01-01', tier: 'lifestyle' });
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('herstel: link alleen is niet genoeg; link plus telefooncode wel', async () => {
  const f = await json(await post('/api/auth/forgot', { email: 'vera@x.nl' }));
  assert.ok(f.tweestaps && f.devResetUrl && f.devCode, 'zonder SMTP komen de dev-velden mee');
  const tok = tokenUit(f.devResetUrl);
  assert.match(f.devResetUrl, /pas=lifestyle/, 'de herstel-link landt in de eigen pas-app');

  // zonder code: geweigerd; met foute code: geweigerd
  assert.equal((await post('/api/auth/reset', { token: tok, password: 'nieuwgeheim' })).status, 403);
  assert.equal((await post('/api/auth/reset', { token: tok, code: '000000', password: 'nieuwgeheim' })).status, 403);
  // het oude wachtwoord werkt nog gewoon (er is niets gewijzigd)
  assert.equal((await post('/api/auth/login', { login: 'vera@x.nl', password: 'oudgeheim' })).status, 200);

  // met de juiste code: het wachtwoord gaat om
  const r = await post('/api/auth/reset', { token: tok, code: f.devCode, password: 'nieuwgeheim' });
  assert.equal(r.status, 200);
  assert.equal((await post('/api/auth/login', { login: 'vera@x.nl', password: 'oudgeheim' })).status, 401, 'oude wachtwoord is weg');
  assert.equal((await post('/api/auth/login', { login: 'vera@x.nl', password: 'nieuwgeheim' })).status, 200, 'nieuwe werkt');
  // de code is eenmalig: dezelfde link/code nog eens gebruiken kan niet
  assert.notEqual((await post('/api/auth/reset', { token: tok, code: f.devCode, password: 'derde' })).status, 200);
});

test('herstel: na vijf foute codes gaat de poging op slot', async () => {
  const f = await json(await post('/api/auth/forgot', { email: 'vera@x.nl' }));
  const tok = tokenUit(f.devResetUrl);
  for (let i = 0; i < 5; i++) {
    assert.equal((await post('/api/auth/reset', { token: tok, code: '111111', password: 'x'.repeat(8) })).status, 403);
  }
  // ook de JUISTE code werkt nu niet meer: eerst een nieuwe link aanvragen
  const na = await post('/api/auth/reset', { token: tok, code: f.devCode, password: 'x'.repeat(8) });
  assert.equal(na.status, 400);
  assert.match((await na.json()).error, /nieuwe herstel-link/i);
  // en een onbekend e-mailadres verklapt niets (zelfde antwoord, geen dev-velden)
  const vreemd = await json(await post('/api/auth/forgot', { email: 'bestaatniet@x.nl' }));
  assert.ok(vreemd.ok && !vreemd.devResetUrl && !vreemd.devCode);
});

test('backoffice: wachtwoord wijzigen vereist het huidige wachtwoord', async () => {
  const reg = await json(await post('/api/auth/register', { name: 'Wim Wijzig', email: 'wim@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business' }));
  // fout huidig wachtwoord: 403; te kort nieuw: 400
  assert.equal((await post('/api/auth/password', { huidig: 'fout', nieuw: 'nieuwgeheim' }, reg.token)).status, 403);
  assert.equal((await post('/api/auth/password', { huidig: 'geheim123', nieuw: 'kort' }, reg.token)).status, 400);
  // goed: daarna werkt alleen het nieuwe wachtwoord
  assert.equal((await post('/api/auth/password', { huidig: 'geheim123', nieuw: 'nieuwgeheim' }, reg.token)).status, 200);
  assert.equal((await post('/api/auth/login', { login: 'wim@x.nl', password: 'geheim123' })).status, 401);
  assert.equal((await post('/api/auth/login', { login: 'wim@x.nl', password: 'nieuwgeheim', pasApp: 'business' })).status, 200);
  // zonder inlog geen toegang tot het wijzig-endpoint
  assert.equal((await post('/api/auth/password', { huidig: 'x', nieuw: 'yyyyyy' })).status, 401);
});
