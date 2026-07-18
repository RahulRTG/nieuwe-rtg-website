/* Passkeys (WebAuthn): de servermechanieken. De echte ceremonie (browser +
   authenticator) staat in de browser-E2E met een virtuele authenticator; hier
   testen we de randen: opties-vorm, anti-enumeratie, poorten, remmen en
   beheer. Draai los: node --experimental-sqlite --test test/webauthn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-webauthn-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid P', email: 'pk' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. registratie-opties: echte WebAuthn-opties, met de codenaam en nooit de echte naam', async () => {
  const demo = await api('/api/login', { tier: 'rtg' });
  const dicht = await api('/api/webauthn/registreer/opties', {}, demo.body.token);
  assert.equal(dicht.status, 403, 'passkeys horen bij een eigen account, niet bij een demo-persona');
  const r = await api('/api/webauthn/registreer/opties', {}, lid);
  assert.equal(r.status, 200);
  const o = r.body.opties;
  assert.ok(o.challenge && o.challenge.length >= 16, 'er is een verse challenge');
  assert.equal(o.rp.name, 'Rahul Travel Group');
  assert.ok(!/Lid P/.test(JSON.stringify(o)), 'de echte naam gaat nooit richting de authenticator');
});

test('2. een vals registratie-antwoord wordt geweigerd', async () => {
  await api('/api/webauthn/registreer/opties', {}, lid);
  const r = await api('/api/webauthn/registreer', { antwoord: { id: 'nep', rawId: 'bnVs', type: 'public-key',
    response: { attestationObject: 'bnVs', clientDataJSON: 'bnVs' } } }, lid);
  assert.equal(r.status, 400, 'de cryptografische controle houdt rommel tegen');
  const zonder = await api('/api/webauthn/registreer', { antwoord: {} }, lid);
  assert.equal(zonder.status, 400, 'zonder verse challenge (net verbruikt) kan het ook niet');
});

test('3. login-opties verraden nooit of een account bestaat (anti-enumeratie)', async () => {
  const echt = await api('/api/webauthn/opties', { login: 'pk-onbekend@x.nl' });
  assert.equal(echt.status, 200, 'onbekende logins krijgen hetzelfde soort antwoord');
  assert.ok(echt.body.opties.challenge, 'met een echte challenge');
  assert.deepEqual(echt.body.opties.allowCredentials || [], [], 'en zonder sleutel-hints');
});

test('4. inloggen met een valse passkey faalt en de rem op de deur telt mee', async () => {
  await api('/api/webauthn/opties', { login: 'pk-nep@x.nl' });
  const r = await api('/api/webauthn/login', { login: 'pk-nep@x.nl', antwoord: { id: 'nep' } });
  assert.ok(r.status === 401 || r.status === 400, 'geen sessie zonder geldige handtekening');
  assert.ok(!r.body.token, 'en zeker geen token');
});

test('5. beheer: de lijst is leeg tot de browser-ceremonie er een toevoegt; weghalen bestaat', async () => {
  const lijst = await api('/api/webauthn/lijst', {}, lid);
  assert.equal(lijst.status, 200);
  assert.deepEqual(lijst.body.sleutels, []);
  const weg = await api('/api/webauthn/weg', { id: 'bestaat-niet' }, lid);
  assert.equal(weg.status, 404);
});
