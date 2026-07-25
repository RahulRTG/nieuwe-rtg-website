/* Het eigenaarschap van het platform: wie het is, en hoe het overgaat.

   Dit is de zwaarste bevoegdheid die het systeem kent. De eigenaar is de enige
   die zekeringen omzet, functies uitschakelt en anderen toegang geeft. Een
   overdracht is dus geen instelling maar een machtsoverdracht, en die hoort
   drie sloten te hebben:

     1. het wachtwoord van de huidige eigenaar, op dat moment;
     2. een nieuw adres waar al een account bij hoort, want anders sluit je
        iedereen buiten en kan wie dat adres later registreert het overnemen;
     3. een spoor dat blijft staan.

   Draai los: node --experimental-sqlite --test test/eigenaarschap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* Kleine client, gelijk aan die van de andere integratietests. GET voor het
   statusbord, POST voor de rest. */
function api(base, pad, body, opt) {
  opt = opt || {};
  const h = { 'Content-Type': 'application/json' };
  if (opt.token) h.Authorization = 'Bearer ' + opt.token;
  const init = { method: opt.method || 'POST', headers: h };
  if (init.method !== 'GET') init.body = JSON.stringify(body || {});
  return fetch(base + pad, init)
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

const OWNER = 'roellie.i@gmail.com';
let srv, base, ownerToken, opvolgerEmail, opvolgerToken;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eig-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  base = srv.base;
  const li = await api(base, '/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
  assert.equal(li.status, 200, 'de eigenaar komt binnen op de technische pagina');
  ownerToken = li.body.token;

  const u = Date.now().toString().slice(-8);
  opvolgerEmail = 'opvolger' + u + '@x.nl';
  const reg = await api(base, '/api/auth/register', {
    name: 'De Opvolger', email: opvolgerEmail, phone: '069' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  });
  assert.equal(reg.status, 200);
  opvolgerToken = reg.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. het statusbord noemt de eigenaar en waar dat adres vandaan komt', async () => {
  const r = await api(base, '/api/techniek/status', null, { token: ownerToken, method: 'GET' });
  assert.equal(r.status, 200);
  assert.ok(r.body.eigenaarschap, 'het eigenaarschap staat op het bord');
  assert.equal(r.body.eigenaarschap.email, OWNER);
  assert.match(r.body.eigenaarschap.herkomst, /server/i, 'hier via RTG_OWNER_EMAIL gezet');
  assert.deepEqual(r.body.eigenaarschap.overdrachten, [], 'nog nooit overgedragen');
});

test('2. zonder wachtwoord gaat er niets over', async () => {
  const r = await api(base, '/api/techniek/eigenaar', { email: opvolgerEmail }, { token: ownerToken });
  assert.equal(r.status, 401);
  assert.match(r.body.error, /wachtwoord/i);
});

test('3. met een onjuist wachtwoord ook niet', async () => {
  const r = await api(base, '/api/techniek/eigenaar',
    { email: opvolgerEmail, wachtwoord: 'ditisnietgoed' }, { token: ownerToken });
  assert.equal(r.status, 401);
  assert.match(r.body.error, /niets gewijzigd/i, 'en dat wordt ook zo gezegd');
});

test('4. overdragen aan een adres zonder account wordt geweigerd', async () => {
  // Dit is de kern: zou dit lukken, dan zit de technische pagina voor IEDEREEN
  // dicht, en kan wie dat adres later registreert hem overnemen.
  const r = await api(base, '/api/techniek/eigenaar',
    { email: 'bestaat-echt-niet@nergens.invalid', wachtwoord: 'Imran' }, { token: ownerToken });
  assert.equal(r.status, 404);
  assert.match(r.body.error, /nog geen RTG-account/i);
  // en de eigenaar is niet stiekem toch gewijzigd
  const s = await api(base, '/api/techniek/status', null, { token: ownerToken, method: 'GET' });
  assert.equal(s.body.eigenaarschap.email, OWNER);
});

test('5. een gewoon lid mag het eigenaarschap niet overdragen', async () => {
  const r = await api(base, '/api/techniek/eigenaar',
    { email: opvolgerEmail, wachtwoord: 'geheim123' }, { token: opvolgerToken });
  assert.ok(r.status === 403 || r.status === 401, 'geen toegang, kreeg ' + r.status);
});

test('6. met alles goed gaat het eigenaarschap over, en de macht mee', async () => {
  const r = await api(base, '/api/techniek/eigenaar',
    { email: opvolgerEmail, wachtwoord: 'Imran' }, { token: ownerToken });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.eigenaar, opvolgerEmail);
  assert.equal(r.body.vorige, OWNER);

  // de opvolger mag nu wat alleen een eigenaar mag: een zekering omzetten
  const li = await api(base, '/api/techniek/inloggen', { login: opvolgerEmail, wachtwoord: 'geheim123' });
  assert.equal(li.status, 200, 'de nieuwe eigenaar komt binnen');
  assert.equal(li.body.eigenaar, true, 'en wordt als eigenaar herkend');
  const zek = await api(base, '/api/techniek/zekering',
    { id: 'ai', actie: 'spring', reden: 'test' }, { token: li.body.token });
  assert.equal(zek.status, 200, 'de nieuwe eigenaar mag zekeringen omzetten');
  assert.equal(zek.body.aan, false, 'en de zekering ging er echt uit');

  // en de vorige eigenaar mag dat niet meer
  const oud = await api(base, '/api/techniek/zekering',
    { id: 'ai', actie: 'reset' }, { token: ownerToken });
  assert.equal(oud.status, 403, 'de vorige eigenaar heeft de macht echt losgelaten');
});

test('7. de overdracht laat een spoor na', async () => {
  const li = await api(base, '/api/techniek/inloggen', { login: opvolgerEmail, wachtwoord: 'geheim123' });
  const s = await api(base, '/api/techniek/status', null, { token: li.body.token, method: 'GET' });
  const log = s.body.eigenaarschap.overdrachten;
  assert.equal(log.length, 1, 'precies een overdracht');
  assert.equal(log[0].van, OWNER);
  assert.equal(log[0].naar, opvolgerEmail);
  assert.ok(log[0].doorNaam, 'met de naam van wie het deed');
  assert.ok(log[0].at, 'en wanneer');
  assert.match(s.body.eigenaarschap.herkomst, /overgedragen/i);
});

test('8. dezelfde eigenaar nog eens instellen doet niets', async () => {
  const li = await api(base, '/api/techniek/inloggen', { login: opvolgerEmail, wachtwoord: 'geheim123' });
  const r = await api(base, '/api/techniek/eigenaar',
    { email: opvolgerEmail, wachtwoord: 'geheim123' }, { token: li.body.token });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /al de eigenaar/i);
});
