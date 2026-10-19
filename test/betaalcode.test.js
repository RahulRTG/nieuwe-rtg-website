/* De persoonlijke betaalcode (server/kern/betaalcode.js, routes/code.js).

   Het scherm belooft "je persoonlijke code", en tot nu toe was elke ledencode
   `pas|RTG`: een kassa wist dat het een RTG-pas was, niet van wie. Besluit van de
   eigenaar (19 oktober 2026): een ONDOORZICHTIGE verwijzing. De code draagt een
   willekeurige, kortlevende verwijzing; alleen de server koppelt die aan de
   codenaam. Een kassa krijgt bij het scannen de codenaam (een betaalbare
   identiteit, geen echte naam) en de code is daarna op; een ander lid krijgt
   niets persoonlijks. Gevonden als open stap in scripts/lib/voltooi/rtgcode.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, stopNet } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-betaalcode-'));
const ENV = { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' };
let srv, base, A, B, kassa;
const PAS = { soort: 'pas', code: 'RTG' };

async function lid(n) {
  const u = (Date.now() + n).toString().slice(-8);
  const email = 'bc' + n + u + '@x.nl';
  const tok = (await api(base, '/api/auth/register', { name: 'Code Lid', email, phone: '06' + u, password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const codenaam = (await api(base, '/api/member/connections', {}, tok)).body.codename;
  return { tok, email, codenaam };
}

test.before(async () => {
  srv = await startServer({ env: ENV });
  base = srv.base;
  A = await lid(1);
  B = await lid(2);
  kassa = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(kassa, 'een zaak logt in als kassa');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('twee leden krijgen verschillende verwijzingen die bij de kassa naar het juiste lid leiden', async () => {
  const a = (await api(base, '/api/code/dyn', PAS, A.tok)).body;
  const b = (await api(base, '/api/code/dyn', PAS, B.tok)).body;
  const sa = await api(base, '/api/code/scan', { token: a.token }, kassa);
  const sb = await api(base, '/api/code/scan', { token: b.token }, kassa);
  assert.equal(sa.status, 200);
  assert.equal(sb.status, 200);
  assert.notEqual(sa.body.code, sb.body.code, 'twee leden, twee verwijzingen');
  assert.equal(sa.body.codenaam, A.codenaam, 'de kassa leest de codenaam van A');
  assert.equal(sb.body.codenaam, B.codenaam);
});

test('in het QR-lijf staan geen codenaam en geen account', async () => {
  const t = (await api(base, '/api/code/dyn', PAS, A.tok)).body.token;
  const lijf = Buffer.from(t.split('.')[1], 'base64url').toString('utf8');
  assert.ok(!lijf.includes(A.codenaam) && !lijf.includes(A.email) && !/user-/.test(lijf), 'lijf: ' + lijf);
  assert.match(lijf.split('|')[1], /^[A-Za-z0-9_-]{20,}$/, 'een ondoorzichtige verwijzing');
});

test('een ander lid dat de code scant, krijgt niets persoonlijks en verbruikt hem niet', async () => {
  const t = (await api(base, '/api/code/dyn', PAS, A.tok)).body.token;
  const s = await api(base, '/api/code/scan', { token: t }, B.tok);
  assert.equal(s.status, 200);
  assert.equal(s.body.codenaam, undefined);
  assert.ok(!JSON.stringify(s.body).includes(A.codenaam));
  const k = await api(base, '/api/code/scan', { token: t }, kassa);
  assert.equal(k.status, 200, 'de kassa kan hem daarna nog gewoon lezen');
});

test('hergebruik wordt geweigerd: de code is eenmalig voor betalen', async () => {
  const t = (await api(base, '/api/code/dyn', PAS, A.tok)).body.token;
  assert.equal((await api(base, '/api/code/scan', { token: t }, kassa)).status, 200);
  const nog = await api(base, '/api/code/scan', { token: t }, kassa);
  assert.equal(nog.status, 409);
  assert.match(nog.body.error, /al gebruikt/);
});

test('een verlopen verwijzing wordt geweigerd', async () => {
  const t = (await api(base, '/api/code/dyn', Object.assign({ ttlMs: 1000 }, PAS), A.tok)).body.token;
  await new Promise((r) => setTimeout(r, 2200));
  const s = await api(base, '/api/code/scan', { token: t }, kassa);
  assert.equal(s.status, 410);
  assert.match(s.body.error, /verlopen/);
});

test('de verwijzing overleeft een herstart binnen haar geldigheid', async () => {
  const t = (await api(base, '/api/code/dyn', Object.assign({ ttlMs: 120000 }, PAS), A.tok)).body.token;
  await stopNet(srv.child);
  srv = await startServer({ env: ENV });
  base = srv.base;
  kassa = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const s = await api(base, '/api/code/scan', { token: t }, kassa);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.codenaam, A.codenaam);
});
