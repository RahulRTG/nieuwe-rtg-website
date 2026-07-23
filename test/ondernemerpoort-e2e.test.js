/* Ondernemer-poort, end-to-end: een zaak die offline staat is niet zichtbaar
   voor leden; pas na de poort (Salon-pagina + rondleiding kassa en werk-apps)
   kan de manager de zaak online zetten en verschijnt hij weer. npm test */
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
function zichtbaar(dir, code) { return (dir.body.suppliers || []).some(s => s.code === code); }

let srv, base, brand, lid;
const CODE = 'KIKUNOI';

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-poort-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: CODE } });
  base = srv.base;
  brand = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Poort Lid', email: 'p' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. een geseede zaak staat online en is zichtbaar voor leden', async () => {
  const p = await api(base, '/api/supplier/poort', {}, brand);
  assert.equal(p.body.online, true, 'de demo-zaak is grandfathered online');
  const dir = await api(base, '/api/suppliers', { city: 'Ibiza' }, lid);
  assert.ok(zichtbaar(dir, CODE), 'zichtbaar in de directory');
});

test('2. offline gezet verdwijnt de zaak uit de directory', async () => {
  const r = await api(base, '/api/supplier/poort/online', { online: false }, brand);
  assert.equal(r.status, 200);
  assert.equal(r.body.online, false);
  const dir = await api(base, '/api/suppliers', { city: 'Ibiza' }, lid);
  assert.ok(!zichtbaar(dir, CODE), 'offline zaak is verborgen voor leden');
});

test('3. online zetten kan pas als de poort klaar is (rondleidingen)', async () => {
  // Salon is compleet (geseed), maar de rondleidingen nog niet -> 409
  const nee = await api(base, '/api/supplier/poort/online', { online: true }, brand);
  assert.equal(nee.status, 409, 'zonder rondleidingen mag de zaak niet online');
  await api(base, '/api/supplier/poort/rondleiding', { id: 'kassa' }, brand);
  const na = await api(base, '/api/supplier/poort/rondleiding', { id: 'werk' }, brand);
  assert.equal(na.body.klaar, true, 'na beide rondleidingen is de poort klaar');
  const ja = await api(base, '/api/supplier/poort/online', { online: true }, brand);
  assert.equal(ja.status, 200);
  assert.equal(ja.body.online, true);
  const dir = await api(base, '/api/suppliers', { city: 'Ibiza' }, lid);
  assert.ok(zichtbaar(dir, CODE), 'weer zichtbaar na het online zetten');
});

test('4. een lid kan de poort niet bedienen', async () => {
  const r = await api(base, '/api/supplier/poort', {}, lid);
  assert.ok(r.status === 401 || r.status === 403, 'geen zaak-inlog, geen poort');
});
