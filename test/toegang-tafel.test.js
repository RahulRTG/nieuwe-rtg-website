/* DE TAFEL-QR IS EEN EXTRA SLEUTEL BIJ EEN ACCOUNT, GEEN VERVANGING ERVAN
   (eigenaarsbesluit 19 oktober 2026, AGENTS.md: gebruiken vraagt een account).

   Wie de QR scant, maakt in het scherm een gratis account en schuift dan aan.
   Wat hier vastligt:
     1. zonder account geven scannen, aanschuiven en alle tafelroutes 401;
     2. met een gratis account werkt het, en de deelnemer op de rekening is de
        CODENAAM van het account -- geen zelfgekozen naam, geen echte naam;
     3. de tafelsleutel van een ander account opent niets: de sleutel hoort bij
        de sessie die aanschoof. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const TAFELROUTES = ['/api/gast/kaart', '/api/gast/concierge', '/api/gast/bestel', '/api/gast/rekening', '/api/gast/waarom',
  '/api/gast/verdeel', '/api/gast/fooi', '/api/gast/betaal', '/api/gast/logboek', '/api/gast/band', '/api/gast/club/tafel',
  '/api/gast/pols', '/api/gast/pols/meld', '/api/gast/verzoek/soorten', '/api/gast/verzoek', '/api/gast/verzoek/intrekken'];

let BASE, child, ZAAK;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-tafel-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  ZAAK = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(ZAAK, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de tafel vraagt een account; de QR blijft de sleutel van de tafel', async () => {
  const qr = (await post('/api/supplier/horeca/gast/qr', { tafel: 'Tafel 1' }, ZAAK)).body.token;
  assert.ok(qr, 'een tafel-QR');

  // 1. zonder account
  assert.equal((await post('/api/gast/tafel', { token: qr })).status, 401, 'scannen zonder account');
  assert.equal((await post('/api/gast/aanschuiven', { token: qr, naam: 'Iemand' })).status, 401, 'aanschuiven zonder account');

  // 2. met een gratis account
  const klant = await registreerGratis(BASE);
  assert.ok(klant, 'een gratis account');
  assert.equal((await post('/api/gast/tafel', { token: qr }, klant.token)).status, 200);
  const aan = await post('/api/gast/aanschuiven', { token: qr, naam: 'Verzonnen Naam' }, klant.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  assert.equal(aan.body.ik.handle, klant.codenaam, 'op de rekening staat de codenaam van het account');
  const sleutel = aan.body.sleutel;
  for (const pad of TAFELROUTES) {
    const r = await post(pad, { sleutel });
    assert.equal(r.status, 401, pad + ' met alleen de tafelsleutel hoort 401 te geven, kreeg ' + r.status);
  }
  assert.equal((await post('/api/gast/kaart', { sleutel }, klant.token)).status, 200, 'sleutel plus account: de kaart');
  assert.equal((await post('/api/gast/rekening', { sleutel }, klant.token)).status, 200, 'sleutel plus account: de rekening');

  // 3. de sleutel van dit account opent niets voor een ander account
  const ander = await registreerGratis(BASE);
  const vreemd = await post('/api/gast/rekening', { sleutel }, ander.token);
  assert.equal(vreemd.status, 403, 'een tafelsleutel hoort bij het account dat aanschoof, kreeg ' + vreemd.status);
});
