/* Beeld "Uit De Salon" als bron in de website-makers, en foto-upload met
   virusscan in de Atelier-studio (pariteit met de leden-Website-maker).
   Draai los: node --experimental-sqlite --test test/salonbron-fotobank.test.js */
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
const PNG = 'data:image/png;base64,' + Buffer.from('demo-atelier-foto').toString('base64');
const BOOBY = 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');

let srv, base, office, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bron-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const reg = await api(base, '/api/auth/register', { name: 'Site Bouwer', email: 'bron@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(office && lid, 'office- en lid-token');
});
test.after(() => stop(srv && srv.child));

test('1. de leden-Website-maker krijgt "Uit De Salon"-beeld (campagne als huisbron)', async () => {
  const r = await api(base, '/api/salon/promo', {}, lid);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.fotos) && r.body.fotos.length > 0, 'er is Salon-beeld');
  for (const f of r.body.fotos) {
    assert.match(f.src, /^\/(media|campagne)\//, 'alleen eigen bronnen, geen extern beeld');
    assert.ok(typeof f.naam === 'string' && f.naam, 'met naamsvermelding');
  }
});

test('2. de Atelier-studio krijgt hetzelfde Salon-beeld', async () => {
  const r = await api(base, '/api/office/atelierweb/salon', {}, office);
  assert.equal(r.status, 200);
  assert.ok(r.body.fotos.length > 0);
  assert.ok(r.body.fotos.every(f => /^\/(media|campagne)\//.test(f.src)));
});

test('3. de studio uploadt een eigen foto na virusscan en bewaart de /media-url', async () => {
  const leeg = await api(base, '/api/office/atelierweb/fotos', {}, office);
  assert.deepEqual(leeg.body.fotos, [], 'begint leeg');
  const up = await api(base, '/api/office/atelierweb/foto', { dataUrl: PNG }, office);
  assert.equal(up.status, 200, up.body.error);
  assert.match(up.body.url, /^\/media\//, 'alleen een verwijzing in db.data');
  const na = await api(base, '/api/office/atelierweb/fotos', {}, office);
  assert.ok(na.body.fotos.includes(up.body.url), 'staat in de beeldbank');
});

test('4. een besmet bestand wordt door de Ontsmetter geweigerd', async () => {
  const up = await api(base, '/api/office/atelierweb/foto', { dataUrl: BOOBY }, office);
  assert.equal(up.status, 400, 'geweigerd');
});

test('5. een geüploade foto laat zich weer weghalen', async () => {
  const up = await api(base, '/api/office/atelierweb/foto', { dataUrl: 'data:image/png;base64,' + Buffer.from('tweede-' + Date.now()).toString('base64') }, office);
  const url = up.body.url;
  const weg = await api(base, '/api/office/atelierweb/foto-weg', { url }, office);
  assert.equal(weg.status, 200);
  assert.ok(!weg.body.fotos.includes(url), 'weg uit de beeldbank');
});

test('6. de studio-foto-endpoints zijn kantoor-only', async () => {
  assert.equal((await api(base, '/api/office/atelierweb/foto', { dataUrl: PNG }, lid)).status, 401);
  assert.equal((await api(base, '/api/office/atelierweb/fotos', {})).status, 401);
});
