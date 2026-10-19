/* De paspoortpoort op de geldroutes van de RTG Bank (server/routes/bank.js,
   bankhart.js), vóór de leden-bank live gaat.

   Eigenaarsbesluit van 19 oktober 2026: elk geldmoment van een account vraagt
   eenmalig het paspoort (kern/onboarding payGate); de Lifestyle- en Business
   Pass zijn vrij. De bank liet een ongekeurd lid een rekening openen, storten,
   overboeken en geld naar de wallet halen zonder die poort. Kijken (overzicht,
   akkoord) blijft vrij: daar beweegt geen geld. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bank-paspoort-'));
const CODE = 'KANTOOR-BANKPOORT';
let srv, office;
const api = (pad, body, token) => fetch(srv.base + '/api/' + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function lid() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('auth/register', { name: 'Rekening', email: 'bankpoort' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { token: r.body.token, codenaam: r.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1', OFFICE_CODE: CODE } });
  office = (await api('office/login', { code: CODE })).body.token;
  assert.ok(office);
  assert.equal((await api('office/bank/leden', { aan: true, naam: 'boardroom' }, office)).body.ledenAan, true);
});
test.after(async () => { await stop(srv); });

test('een ongekeurd lid kijkt wel, maar verplaatst geen geld en krijgt de paspoortweg', async () => {
  const A = await lid();
  assert.equal((await api('bank/overzicht', {}, A.token)).status, 200, 'kijken mag');
  for (const [pad, body] of [['bank/rekening/open', { soort: 'spaar' }], ['bank/storten', { centen: 1000 }],
    ['bank/overboek', { centen: 100 }], ['bank/naar-wallet', { centen: 100 }], ['bank/van-wallet', { centen: 100 }],
    ['bank/sepa', { centen: 100 }], ['bank/bulk', {}], ['bank/veeg', {}]]) {
    const r = await api(pad, body, A.token);
    assert.equal(r.status, 403, pad + ': ' + JSON.stringify(r.body));
    assert.equal(r.body.kyc, true, pad + ' stuurt naar de paspoortstap');
  }
});

test('na de keuring opent hetzelfde lid zijn rekening', async () => {
  const A = await lid();
  await keurLidGoed(srv.base, A.token, A.codenaam);
  assert.equal((await api('bank/akkoord', {}, A.token)).status, 200);
  const r = await api('bank/rekening/open', { soort: 'spaar', naam: 'Buffer' }, A.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
});
