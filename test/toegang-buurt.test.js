/* DE BUURT-APP VAN FOUNDATIONOS VRAAGT EEN ACCOUNT
   (eigenaarsbesluit 19 oktober 2026, AGENTS.md: gebruiken vraagt een account).

   /api/rtfos/publiek/{steden,stad,campagnes} gingen open zonder enige sessie.
   Ze staan niet op de landing of de paspagina's, dus ze vallen niet onder een
   uitzondering. Nu komt er alleen iemand binnen met een sessie die het huis
   kent (lid, zaak of kantoor; kern/elkesessie.js), of met een gezinsprofiel
   uit een gezin dat aan het account van een ouder hangt (dezelfde regel als
   foundation/accountplicht.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const { gezinAanAccount } = require('./gezinaccount');

const ROUTES = [['/api/rtfos/publiek/steden', {}], ['/api/rtfos/publiek/stad', { id: 'ONBEKEND' }], ['/api/rtfos/publiek/campagnes', {}]];
let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-buurt-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTF_GEZIN_ACCOUNTPLICHT: '1' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de buurtroutes: zonder account 401; een lid en een gezinsprofiel aan een ouderaccount komen erdoor', async () => {
  for (const [pad, lijf] of ROUTES) assert.equal((await post(pad, lijf)).status, 401, pad + ' zonder account');
  const lid = await registreerGratis(BASE);
  for (const [pad, lijf] of ROUTES) assert.notEqual((await post(pad, lijf, lid.token)).status, 401, pad + ' met een gratis account');
  const gezin = await gezinAanAccount(BASE);
  for (const [pad, lijf] of ROUTES) {
    assert.notEqual((await post(pad, Object.assign({ code: gezin.code, token: gezin.token }, lijf))).status, 401, pad + ' met een gezinsprofiel');
  }
  assert.equal((await post('/api/rtfos/publiek/steden', { code: gezin.code, token: 'GZ.' + '0'.repeat(32) })).status, 401,
    'een verzonnen gezinstoken opent niets');
});
