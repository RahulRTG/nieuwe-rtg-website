/* KAS- EN TIKCODE OP EEN ECHTE SERVER (CODECREDENTIALS.json, deuren
   pay.kascode_en_vooraf en pay.tikcode): de uitgifte is no-store en staat
   buiten elke retrycache, een retry met dezelfde sleutel geeft geen code, en de
   twee intrekroutes zijn gemonteerd en doen wat ze zeggen. De controls zelf
   staan in kascode-credential.test.js en kascode-tik-vooraf.test.js.

   Draai los: node --test test/kascode-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, ander, zaak;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kascode-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, kop: r.headers, body: await r.json().catch(() => ({})) }));
const login = async tier => (await (await fetch(base + '/api/login', { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) })).json()).token;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await login('rtg');
  ander = await login('lifestyle');
  const s = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json();
  zaak = s.token;
  assert.equal((await api('pay/oplaad', { centen: 10000, idem: 'kr-op' }, lid)).status, 200);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de kascode: no-store, geen tweede code op dezelfde sleutel, en intrekken sluit hem', async () => {
  const k = await api('pay/kascode', { maxCenten: 3000, idem: 'kr-1' }, lid);
  assert.equal(k.status, 200);
  assert.match(k.body.code, /^KC(-[0-9A-F]{4}){8}$/);
  assert.equal(k.kop.get('cache-control'), 'no-store', 'de browser bewaart de code niet');
  const nog = await api('pay/kascode', { maxCenten: 3000, idem: 'kr-1' }, lid);
  assert.equal(nog.status, 409);
  assert.equal(JSON.stringify(nog.body).includes(k.body.code), false, 'geen cache heronthult de code');
  const weg = await api('pay/kascode/intrek', {}, lid);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.ingetrokken, 1);
  assert.equal((await api('pay/kascode/intrek', {}, lid)).body.ingetrokken, 0, 'een tweede keer verandert niets');
  assert.equal((await api('supplier/pay/in', { code: k.body.code, centen: 500, idem: 'kr-in' }, zaak)).status, 404,
    'een ingetrokken code opent niets');
});

test('de tikcode: no-store, betalen, en intrekken sluit hem', async () => {
  const t = await api('pay/tikcode', {}, ander);
  assert.equal(t.status, 200);
  assert.match(t.body.code, /^TK(-[0-9A-F]{4}){8}$/);
  assert.equal(t.kop.get('cache-control'), 'no-store');
  assert.equal((await api('pay/tik', { code: t.body.code, centen: 200, idem: 'kr-t1' }, lid)).status, 200);
  assert.equal((await api('pay/tikcode/intrek', {}, ander)).body.ingetrokken, 1);
  assert.equal((await api('pay/tik', { code: t.body.code, centen: 200, idem: 'kr-t2' }, lid)).status, 404);
  assert.equal((await (await fetch(base + '/api/pay/gezond')).json()).klopt, true, 'het grootboek sluit');
});
