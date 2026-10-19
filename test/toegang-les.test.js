/* DE LES VAN DE RTFOUNDATION VRAAGT EEN ACCOUNT (eigenaarsbesluit 19 oktober
   2026, AGENTS.md: gebruiken vraagt een account).

   /api/foundation/les/maak en /les/join werkten zonder account; alleen de
   lessleutel telde. Nu:
     - een les MAKEN vraagt een ingelogd account (een gratis account is genoeg);
     - MEEDOEN vraagt een ingelogd account, of een kind via het gezinsprofiel
       onder het account van een ouder (gezinCode + gezinToken in het lijf);
     - de lescode en de lessleutels blijven een EXTRA sleutel naast de sessie,
       en zonder lessleutel blijven de lesroutes 403 geven: dat is een tweede
       poort. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const { gezinAanAccount } = require('./gezinaccount');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-les-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTF_GEZIN_ACCOUNTPLICHT: '1' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('les maken en meedoen: zonder account 401, met een account of gezinsprofiel door', async () => {
  assert.equal((await post('/api/foundation/les/maak', { vak: 'Rekenen', naam: 'Juf' })).status, 401, 'les maken zonder account');
  const gezin = await gezinAanAccount(BASE);
  assert.equal((await post('/api/foundation/les/maak', { vak: 'Rekenen', naam: 'Juf', gezinCode: gezin.code, gezinToken: gezin.token })).status, 401,
    'een les maken vraagt een account, geen gezinsprofiel');

  const juf = await registreerGratis(BASE);
  const les = await post('/api/foundation/les/maak', { vak: 'Rekenen', naam: 'Juf' }, juf.token);
  assert.equal(les.status, 200, JSON.stringify(les.body));
  const lescode = les.body.lescode;

  assert.equal((await post('/api/foundation/les/join', { lescode, naam: 'Anoniem' })).status, 401, 'meedoen zonder account');
  const kind = await post('/api/foundation/les/join', { lescode, naam: 'Kim', gezinCode: gezin.code, gezinToken: gezin.token });
  assert.equal(kind.status, 200, 'meedoen via het gezinsprofiel van een ouderaccount: ' + JSON.stringify(kind.body));
  const lid = await registreerGratis(BASE);
  const mee = await post('/api/foundation/les/join', { lescode, naam: 'Sam' }, lid.token);
  assert.equal(mee.status, 200, 'meedoen met een gratis account: ' + JSON.stringify(mee.body));
  assert.equal((await post('/api/foundation/les/join', { lescode, naam: 'Kim2', gezinCode: gezin.code, gezinToken: 'GZ.' + '0'.repeat(32) })).status, 401,
    'een verzonnen gezinstoken opent niets');

  // de tweede poort blijft: zonder lessleutel geen bord
  const bord = await fetch(BASE + '/api/foundation/bord/stroke', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid.token },
    body: JSON.stringify({ code: les.body.lesId, stroke: { p: [[0, 0], [1, 1]] } }) });
  assert.ok([401, 403].includes(bord.status), 'een account zonder lessleutel tekent niet op het bord: ' + bord.status);
});
