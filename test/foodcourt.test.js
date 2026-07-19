/* De RTG Food Court (kern/foodcourt.js): alle restaurants op een rij, in de
   stijl van een reserveerplatform. Overzicht met keuken/prijs/ledenvoordeel,
   vrije tijdsloten per datum en gezelschap, en reserveren via /api/reserveer.
   Draai: npm test */
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
function morgen() { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); }

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foodcourt-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Tafel', email: 't' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = { token: reg.body.token };
});
test.after(() => stop(srv && srv.child));

test('1. de food court toont restaurants met keuken en prijs; alleen na inlog', async () => {
  assert.equal((await api(base, '/api/foodcourt', {}, null)).status, 401);
  const r = await api(base, '/api/foodcourt', {}, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.restaurants.length >= 1, 'er staat minstens een restaurant');
  const eersteMet = r.body.restaurants[0];
  assert.ok(eersteMet.code && eersteMet.naam && eersteMet.keuken && eersteMet.prijs, 'elk restaurant heeft keuken en prijs');
  assert.ok(Array.isArray(r.body.keukens) && r.body.keukens.length, 'er zijn keukens om op te filteren');
});

test('2. vrije tijdsloten voor een datum en gezelschap (lunch en diner)', async () => {
  const ov = await api(base, '/api/foodcourt', {}, lid.token);
  const code = ov.body.restaurants[0].code;
  const t = await api(base, '/api/foodcourt/tijden', { code, datum: morgen(), personen: 2 }, lid.token);
  assert.equal(t.status, 200);
  assert.ok(t.body.slots.length >= 4, 'er zijn tijdsloten');
  assert.ok(t.body.slots.some(s => s.dienst === 'lunch') && t.body.slots.some(s => s.dienst === 'diner'), 'lunch en diner');
  assert.ok(t.body.slots.every(s => /^\d{2}:\d{2}$/.test(s.tijd) && typeof s.vol === 'boolean'), 'elk slot heeft een tijd en een vol-vlag');
  assert.equal((await api(base, '/api/foodcourt/tijden', { code: 'BESTAATNIET', datum: morgen() }, lid.token)).status, 404);
});

test('3. reserveren via /api/reserveer landt als aanvraag bij het restaurant', async () => {
  const ov = await api(base, '/api/foodcourt', {}, lid.token);
  const rest = ov.body.restaurants.find(r => r.open) || ov.body.restaurants[0];
  const t = await api(base, '/api/foodcourt/tijden', { code: rest.code, datum: morgen(), personen: 2 }, lid.token);
  const slot = t.body.slots.find(s => !s.vol);
  assert.ok(slot, 'er is een vrij slot');
  const res = await api(base, '/api/reserveer', { supplierCode: rest.code, datum: morgen(), tijd: slot.tijd, personen: 2 }, lid.token);
  assert.equal(res.status, 200);
  assert.equal(res.body.reservering.status, 'aangevraagd');
  const mijn = await api(base, '/api/reserveringen/mijn', {}, lid.token);
  assert.ok(mijn.body.reserveringen.some(r => r.supplierCode === rest.code && r.tijd === slot.tijd), 'de reservering staat bij mij');
});
