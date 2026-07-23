/* Dynamische RTG-code, end-to-end via de routes: alleen een app-sessie kan een
   code maken (/api/code/dyn) of verifieren (/api/code/scan); een generieke lezer
   zonder inlog komt er niet langs. npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, brand;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dyn-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Code Lid', email: 'c' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
  brand = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('een lid maakt een verse kas-code en verifieert die weer', async () => {
  const mk = await api(base, '/api/code/dyn', { soort: 'kas', code: 'BETAAL9' }, lid);
  assert.equal(mk.status, 200);
  assert.ok(mk.body.token.startsWith('RTG1.'));
  const scan = await api(base, '/api/code/scan', { token: mk.body.token }, lid);
  assert.equal(scan.status, 200);
  assert.equal(scan.body.soort, 'kas');
  assert.equal(scan.body.code, 'BETAAL9');
});

test('zonder inlog kan niemand maken of scannen (alleen onze app)', async () => {
  const mk = await api(base, '/api/code/dyn', { soort: 'kas', code: 'X' }, null);
  assert.equal(mk.status, 401);
  const sc = await api(base, '/api/code/scan', { token: 'RTG1.a.b' }, null);
  assert.equal(sc.status, 401);
});

test('een lid mag geen zaak-codesoort maken (entree)', async () => {
  const r = await api(base, '/api/code/dyn', { soort: 'entree', code: 'KIKUNOI' }, lid);
  assert.equal(r.status, 403);
});

test('een zaak maakt een entree-code; het lid kan die verifieren', async () => {
  const mk = await api(base, '/api/code/dyn', { soort: 'entree', code: 'KIKUNOI' }, brand);
  assert.equal(mk.status, 200);
  const scan = await api(base, '/api/code/scan', { token: mk.body.token }, lid);
  assert.equal(scan.status, 200);
  assert.equal(scan.body.soort, 'entree');
});

test('een vreemde code geeft 422, geen soort', async () => {
  const r = await api(base, '/api/code/scan', { token: 'https://niet-van-ons/x' }, lid);
  assert.equal(r.status, 422);
  assert.equal(r.body.ok, false);
});
