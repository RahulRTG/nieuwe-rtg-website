/* Nieuwe registratie koopt niets. De echte HTTP-route tekent uitsluitend voor
   de ingelogde actor, met de getoonde versie en expliciet akkoord. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stopNet } = require('./helper');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-registratie-basis-'));
let srv, teller = 0;
async function api(pad, body = {}, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
const registratie = (tier, pasApp = 'rtg') => api('/api/auth/register', {
  name: 'Nieuw gratis lid', email: 'nieuw-' + (++teller) + '@example.test',
  password: 'geheim123', geboortedatum: '1990-01-01', tier, pasApp
});
const start = async () => { srv = await startServer({ env: { RTG_DATA_DIR: dir,
  RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '' } }); };
test.before(start);
test.after(async () => { if (srv) await stopNet(srv.child); fs.rmSync(dir, { recursive: true, force: true }); });

test('geen enkele aangeleverde tier koopt een pas of maakt een factuur', async () => {
  for (const tier of [undefined, 'guest', 'rtg', 'business', 'lifestyle', 'business-lite', 'beheerder']) {
    const r = await registratie(tier);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.state.user.tier, 'guest', String(tier));
    assert.equal(r.body.state.user.account, true);
    assert.deepEqual(r.body.state.invoices, []);
    assert.equal(r.body.state.trip, undefined);
    assert.equal((await api('/api/vak/offerte/vraag', {}, r.body.token)).status, 403);
    const onb = await api('/api/onboarding/status', {}, r.body.token);
    assert.equal(onb.body.contract.ondertekend, false);
    assert.equal((await api('/api/pay', { all: true }, r.body.token)).status, 409);
  }
});

test('eigen Business/Lifestyle-aanmelding is gratis; kruismismatch blijft dicht', async () => {
  for (const pas of ['business', 'lifestyle']) {
    const r = await registratie(pas, pas);
    assert.equal(r.status, 200); assert.equal(r.body.state.user.tier, 'guest');
    assert.equal((await registratie(pas, pas === 'business' ? 'lifestyle' : 'business')).status, 403);
  }
});

test('gratis ondertekening: expliciet akkoord, sessieactor, versie en identieke ontvangst na herstart', async () => {
  const a = (await registratie('guest')).body, b = (await registratie('guest')).body;
  const status = () => api('/api/onboarding/status', {}, a.token);
  const versie = (await status()).body.contract.versie;
  const inhoud = { naam: 'Nieuw gratis lid', akkoord: true, contractVersion: versie,
    accountId: b.state.user.id, key: 'user-' + b.state.user.id, scope: 'andere-organisatie' };
  for (const patch of [{ akkoord: false }, { naam: '' }]) {
    assert.equal((await api('/api/onboarding/teken', { ...inhoud, ...patch }, a.token)).status, 400);
    assert.equal((await status()).body.contract.ondertekend, false);
  }
  assert.equal((await api('/api/onboarding/teken', { ...inhoud, contractVersion: versie + 1 }, a.token)).status, 409);
  const eerste = await api('/api/onboarding/teken', inhoud, a.token);
  assert.equal(eerste.status, 200, JSON.stringify(eerste.body));
  assert.equal(eerste.body.contract.ondertekend, true);
  assert.equal(eerste.body.scope, 'rtg');
  assert.equal((await api('/api/onboarding/status', {}, b.token)).body.contract.ondertekend, false);
  assert.equal((await api('/api/onboarding/teken', { ...inhoud, naam: 'Andere naam' }, a.token)).status, 409);
  await stopNet(srv.child); srv = null; await start();
  const herhaald = await api('/api/onboarding/teken', inhoud, a.token);
  assert.equal(herhaald.status, 200, JSON.stringify(herhaald.body));
  assert.equal(herhaald.body.herhaald, true);
  assert.equal(herhaald.body.contract.ondertekendAt, eerste.body.contract.ondertekendAt);
  const staat = (await api('/api/state', {}, a.token)).body.state;
  assert.equal(staat.user.tier, 'guest', 'platformcontract koopt geen abonnement');
  assert.deepEqual(staat.invoices, []);
});
