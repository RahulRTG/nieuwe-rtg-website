/* De eigen mini-boardroom per zaak: elke leverancier zet zijn eigen functies
   aan/uit en ziet een HR- en marketing-momentopname. Een uitgezette functie
   werkt echt (bijv. Salon-marketing uit = niet kunnen posten). Draai: npm test */
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

let srv, base, zaak;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaak-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de boardroom toont functies, HR en marketing', async () => {
  const b = await api(base, '/api/supplier/zaak/board', {}, zaak);
  assert.equal(b.status, 200);
  const ids = (b.body.functies || []).map(f => f.id);
  assert.ok(ids.includes('orders') && ids.includes('reserveren') && ids.includes('salon'), 'de juiste functies voor een restaurant');
  assert.ok(b.body.hr.teamAantal >= 2, 'HR-momentopname met team');
  assert.equal(typeof b.body.marketing.volgers, 'number', 'marketing-momentopname');
});

test('2. Salon-marketing uitzetten blokkeert het posten; weer aan laat het toe', async () => {
  await api(base, '/api/supplier/zaak/functie', { id: 'salon', aan: false }, zaak);
  const b1 = await api(base, '/api/supplier/zaak/board', {}, zaak);
  assert.equal(b1.body.functies.find(f => f.id === 'salon').aan, false);
  const post1 = await api(base, '/api/supplier/salon/post', { text: 'Nieuwe zomerkaart!' }, zaak);
  assert.equal(post1.status, 409, 'met Salon-marketing uit kan de zaak niet posten');
  await api(base, '/api/supplier/zaak/functie', { id: 'salon', aan: true }, zaak);
  const post2 = await api(base, '/api/supplier/salon/post', { text: 'Nieuwe zomerkaart!' }, zaak);
  assert.equal(post2.status, 200, 'met Salon-marketing aan kan de zaak wel posten');
});

test('3. reserveren uitzetten stuurt de echte instelling aan (round-trip)', async () => {
  // de "reserveren"-knop leest/schrijft de echte instelling s.settings.reservationsOpen
  await api(base, '/api/supplier/zaak/functie', { id: 'reserveren', aan: false }, zaak);
  let b = await api(base, '/api/supplier/zaak/board', {}, zaak);
  assert.equal(b.body.functies.find(f => f.id === 'reserveren').aan, false, 'de knop (en dus de echte instelling) staat uit');
  await api(base, '/api/supplier/zaak/functie', { id: 'reserveren', aan: true }, zaak);
  b = await api(base, '/api/supplier/zaak/board', {}, zaak);
  assert.equal(b.body.functies.find(f => f.id === 'reserveren').aan, true, 'en weer aan');
});
