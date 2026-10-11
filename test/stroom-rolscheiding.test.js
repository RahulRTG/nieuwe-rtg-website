/* DE ROLSCHEIDING VAN HET STROOMLOKET (server/opzet/stroomtoegang.js).

   POST /api/stroom/ticket is EEN loket voor drie soorten stromen (lid, zaak,
   kantoor), en elke soort toetst zelf of de sessie de hare is. De soort `lid`
   vroeg alleen of resolveSession het token kende -- dat kent ook een
   leveranciers- en kantoorsessie, en de rolronde (scripts/rolronde.js) zag die
   met een ledenticket de LEDENSTROOM openen. Deze toets houdt de scheiding
   vast tegen een echte server: elke rol krijgt alleen zijn eigen soort, een lid
   opent de ledenstroom nog gewoon, en wie toch een ledenticket bemachtigt maar
   geen lid is, komt /api/stream niet in.

   Draai los: node --test test/stroom-rolscheiding.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stroomrol-'));
const post = (pad, lijf, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(lijf || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
async function stroomStatus(ticket) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 3000);
  try { const r = await fetch(base + '/api/stream?ticket=' + encodeURIComponent(ticket), { signal: c.signal }); c.abort(); return r.status; }
  catch (e) { return 'afgebroken'; } finally { clearTimeout(t); }
}

let lid, sup, kantoor;
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  lid = (await post('/api/login', { tier: 'rtg' })).body.token;
  sup = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  kantoor = (await post('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(lid && sup && kantoor, 'lid-, leverancier- en kantoorlogin werken');
});
test.after(async () => { await stop(srv); fs.rmSync(TMP, { recursive: true, force: true }); });

test('een lid krijgt een ledenticket en opent de ledenstroom (tegenproef)', async () => {
  const r = await post('/api/stroom/ticket', { stroom: 'lid' }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await stroomStatus(r.body.ticket), 200);
});

test('leverancier en kantoor krijgen geen ledenticket, ook niet zonder soort', async () => {
  for (const [rol, tok] of [['leverancier', sup], ['kantoor', kantoor]]) {
    for (const lijf of [{ stroom: 'lid' }, {}]) {
      const r = await post('/api/stroom/ticket', lijf, tok);
      assert.equal(r.status, 401, rol + ' kreeg een ledenticket met ' + JSON.stringify(lijf));
    }
  }
});

test('elke rol krijgt alleen zijn eigen soort stroom', async () => {
  assert.equal((await post('/api/stroom/ticket', { stroom: 'zaak' }, sup)).status, 200);
  assert.equal((await post('/api/stroom/ticket', { stroom: 'kantoor' }, sup)).status, 401);
  assert.equal((await post('/api/stroom/ticket', { stroom: 'kantoor' }, kantoor)).status, 200);
  assert.equal((await post('/api/stroom/ticket', { stroom: 'zaak' }, kantoor)).status, 401);
  assert.equal((await post('/api/stroom/ticket', { stroom: 'zaak' }, lid)).status, 401);
  assert.equal((await post('/api/stroom/ticket', { stroom: 'kantoor' }, lid)).status, 401);
});
