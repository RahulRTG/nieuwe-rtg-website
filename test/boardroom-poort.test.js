/* De boardroom-poort: de boardroom is de kamer van de eigenaar (Rahul Imran
   Ismail). De anonieme kantoorcode heeft geen identiteit en komt er nooit in;
   de eigenaar komt binnen met zijn eigen account (direct, of als kantoor-rol
   via het ene account) en geeft of neemt toegang op codenaam. De rest van het
   kantoor blijft gewoon op de office-inlog werken. Draai los:
   node --experimental-sqlite --test test/boardroom-poort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, baas, lid, lidCodenaam;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-brd-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  baas = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Vertrouweling Test', email: 'brd' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1991-02-02', geslacht: 'v', tier: 'business', pasApp: 'business' })).body.token;
  assert.ok(office && baas && lid, 'kantoor, eigenaar en lid zijn ingelogd');
  // het lid doet iets, zodat het in de codenaam-gids staat
  await api('/api/theater/zaal', {}, lid);
  lidCodenaam = (await api('/api/auth/me', {}, lid)).body.user.codename;
  assert.ok(lidCodenaam, 'het lid heeft een codenaam');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het eigenaarsaccount heet Rahul Imran Ismail en logt in als Rahul/Imran', async () => {
  const login = await api('/api/auth/login', { login: 'Rahul', password: 'Imran', pasApp: 'business' });
  assert.equal(login.status, 200, 'inloggen op de naam Rahul werkt');
  const me = await api('/api/auth/me', {}, login.body.token);
  assert.equal(me.body.user.full, 'Rahul Imran Ismail', 'de echte naam komt uit de kluis');
});

test('2. de sleutelbos: kantoor- en zaak-rol hangen standaard aan het eigenaarsaccount', async () => {
  const r = await api('/api/account/rollen', {}, baas);
  assert.equal(r.status, 200);
  const rollen = (r.body.rollen || []).map(x => x.rol);
  assert.ok(rollen.includes('kantoor'), 'de kantoor-rol is gekoppeld');
  assert.ok(rollen.includes('zaak'), 'de zaak-rol is gekoppeld');
});

test('3. de anonieme kantoorcode komt de boardroom niet in; het kantoor zelf blijft open', async () => {
  assert.equal((await api('/api/office/kamers', {}, office)).status, 200, 'de kamers blijven open');
  assert.equal((await api('/api/office/boardroom', {}, office)).status, 403, 'de boardroom is dicht');
  assert.equal((await api('/api/office/geld', {}, office)).status, 403, 'de geld-regie is dicht');
  assert.equal((await api('/api/office/boardroom/schakel', { functie: 'x', aan: true }, office)).status, 403, 'schakelen kan niet');
});

test('4. de eigenaar komt binnen met zijn eigen account en is de baas', async () => {
  const b = await api('/api/office/boardroom', {}, baas);
  assert.equal(b.status, 200, 'de boardroom opent voor de eigenaar');
  assert.equal(b.body.baas, true, 'en herkent hem als de baas');
  assert.equal((await api('/api/office/geld', {}, baas)).status, 200, 'de geld-regie opent');
});

test('5. een gewoon account komt er niet in, ook niet met een geldige inlog', async () => {
  assert.equal((await api('/api/office/boardroom', {}, lid)).status, 401, 'geen kantoor-sessie, geen eigenaar');
});

test('6. toegang geven op codenaam: de vertrouweling komt binnen via het ene account', async () => {
  // de eigenaar geeft de sleutel
  const geef = await api('/api/office/boardroom/toegang/geef', { codenaam: lidCodenaam }, baas);
  assert.equal(geef.status, 200, 'de eigenaar geeft toegang');
  assert.ok(geef.body.lijst.some(t => t.codenaam === lidCodenaam), 'de codenaam staat op de lijst');
  // het lid koppelt de kantoor-rol (bewijst de code) en start ermee
  assert.equal((await api('/api/account/koppel', { soort: 'kantoor', code: 'RTG-OFFICE' }, lid)).status, 200, 'kantoor-rol gekoppeld');
  const start = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal(start.status, 200, 'kantoor-sessie via het ene account');
  const b = await api('/api/office/boardroom', {}, start.body.token);
  assert.equal(b.status, 200, 'de vertrouweling komt de boardroom in');
  assert.equal(b.body.baas, false, 'maar is niet de baas');
  // de sleutel doorgeven kan alleen de eigenaar
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: 'iemand' }, start.body.token)).status, 403,
    'een vertrouweling geeft geen toegang door');
});

test('7. de eigenaar trekt de sleutel weer in', async () => {
  const weg = await api('/api/office/boardroom/toegang/weg', { codenaam: lidCodenaam }, baas);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.lijst.length, 0, 'de lijst is weer leeg');
  const start = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal((await api('/api/office/boardroom', {}, start.body.token)).status, 403, 'de deur is weer dicht');
});
