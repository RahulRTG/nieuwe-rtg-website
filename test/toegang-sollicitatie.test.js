/* SOLLICITEREN BIJ EEN ZAAK VRAAGT EEN ACCOUNT (eigenaarsbesluit 19 oktober
   2026, AGENTS.md: gebruiken vraagt een account).

   POST /api/supplier/apply nam een sollicitatie aan van iedereen zonder sessie.
   Nu vraagt hij minimaal een gratis account, en de sollicitatie hangt aan de
   codenaam van dat account: de zaak ziet de codenaam, en de sollicitant vindt
   zijn sollicitatie terug op zijn eigen sleutel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-soll-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('solliciteren: zonder account 401, met een gratis account aan het account', async () => {
  const lijf = { code: 'KIKUNOI', name: 'Sam Proef', func: 'Bediening', contact: '0612345678', note: 'Graag' };
  const zonder = await post('/api/supplier/apply', lijf);
  assert.equal(zonder.status, 401, 'zonder account geen sollicitatie, kreeg ' + zonder.status);

  const wie = await registreerGratis(BASE);
  assert.ok(wie, 'een gratis account');
  const met = await post('/api/supplier/apply', lijf, wie.token);
  assert.equal(met.status, 200, JSON.stringify(met.body));

  /* De zaak ziet de codenaam NIET (kern/werk.js werkgeverSollicitatie: een
     codenaam naast een echte naam is precies de koppeling die het
     codenaamontwerp voorkomt). De sollicitant ziet zijn sollicitatie wel terug,
     op de sleutel van zijn account. */
  const mijn = (await post('/api/state', {}, wie.token)).body.state.myApplications || [];
  assert.ok(mijn.some(a => a.func === 'Bediening'), 'de sollicitatie hangt aan het account: ' + JSON.stringify(mijn));
});
