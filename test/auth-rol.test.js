/* Regressietest voor een crash die de chaos-soak (scripts/mega65-storm.js)
   vond: een leverancier- of kantoor-token dat op een LEDEN-endpoint belandt.
   De leden-auth accepteerde die sessie (die geen persona-tier heeft) en de
   ledengids crashte dan op een ontbrekende codenaam -> 500 op elk zo geraakt
   endpoint. Nu weert de leden-auth niet-leden-sessies met 401, en
   liveCodename is defensief. Draai: node --experimental-sqlite --test test/auth-rol.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-authrol-'));
const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een leverancier- of kantoor-token op een leden-endpoint geeft 401, geen 500', async () => {
  const lid = (await api('login', { tier: 'rtg' })).body.token;
  const sup = (await (await fetch(base + '/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json()).token;
  const office = (await (await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'RTG-OFFICE' }) })).json()).token;
  assert.ok(lid && sup && office, 'alle drie de rollen kunnen inloggen');

  // een echt lid komt gewoon binnen
  assert.equal((await api('suppliers', {}, lid)).status, 200);

  // een niet-leden-token wordt geweigerd (401), nooit een crash (500), op een
  // paar representatieve leden-endpoints met verschillende handlers
  for (const pad of ['suppliers', 'care', 'state', 'assets']) {
    assert.equal((await api(pad, {}, sup)).status, 401, 'leverancier-token op /' + pad + ' -> 401');
    assert.equal((await api(pad, {}, office)).status, 401, 'kantoor-token op /' + pad + ' -> 401');
  }

  // rommel als tier bij het inloggen wordt geweigerd (geen sessie met onbekende tier)
  const junk = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'zzz-onbekend' }) })).json();
  assert.ok(!junk.token, 'een onbekende tier levert geen sessie op');
});
