/* De kassacode van een gratis account (server/routes/pay-tegoed.js en de
   capability geld.kassa, server/kern/pay/kassacode.js).

   Met een kassacode int een zaak geld uit de wallet van het lid (kasInt, met
   bijladen). Dat is een geldmoment, en sinds het eigenaarsbesluit van 19
   oktober 2026 vraagt elk geldmoment van een account de paspoortpoort. De oude
   route /api/pay/kascode liet een ongekeurd gratis account een code maken
   zonder die poort; pay.html maakt hem via /api/link/cap/maak, en dat weigerde
   een gratis account helemaal (geenGast), zodat Pay voor hem geen kassacode had. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kascode-gratis-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function gratisAccount() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Kassa', email: 'kascode' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { token: r.body.token, codenaam: r.body.state.user.codename };
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1' } }); });
test.after(async () => { await stop(srv); });

test('een ongekeurd gratis account maakt geen kassacode en krijgt de paspoortweg', async () => {
  const A = await gratisAccount();
  const oud = await api('/api/pay/kascode', { maxCenten: 1500 }, A.token);
  assert.equal(oud.status, 403, JSON.stringify(oud.body));
  assert.equal(oud.body.kyc, true);
  const cap = await api('/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten: 1500 }, A.token);
  assert.equal(cap.status, 403, JSON.stringify(cap.body));
  assert.equal(cap.body.kyc, true, 'ook via de capability de paspoortweg, niet "alleen voor leden"');
});

test('een gekeurd gratis account maakt de kassacode zoals pay.html het doet', async () => {
  const A = await gratisAccount();
  await keurLidGoed(srv.base, A.token, A.codenaam);
  const cap = await api('/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten: 1500 }, A.token);
  assert.equal(cap.status, 200, JSON.stringify(cap.body));
  assert.ok(cap.body.token && cap.body.eigen && cap.body.eigen.code, 'een token en de code van zes tekens');
  assert.equal(cap.body.eigen.maxCenten, 1500);
  assert.equal((await api('/api/pay/kascode', { maxCenten: 1500 }, A.token)).status, 200);
});
