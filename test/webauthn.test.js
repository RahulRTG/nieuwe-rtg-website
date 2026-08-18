/* Passkeys (WebAuthn): de servermechanieken. Dit bestand toetst de RANDEN --
   opties-vorm, anti-enumeratie, poorten, remmen en beheer.

   Hier stond dat de echte ceremonie "in de browser-E2E met een virtuele
   authenticator" staat. Dat klopte, maar de E2E draait niet mee in npm test, dus
   in de praktijk werd registreren en inloggen met een passkey nooit getoetst.
   Alleen weigeren is geen bewijs: een deur die altijd dicht zit haalt elke toets
   hieronder moeiteloos. Die ceremonie staat nu in
   test/webauthn-ceremonie.test.js, met een nagespeelde authenticator
   (test/webauthn-authenticator.js) en over de echte routes.

   Draai los: node --test test/webauthn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lidEmail;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-webauthn-'));

function api(pad, body, token, extraHeaders) {
  const h = { 'Content-Type': 'application/json', ...(extraHeaders || {}) };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lidEmail = 'pk' + u + '@x.nl';
  const reg = await api('/api/auth/register', { name: 'Lid P', email: lidEmail, phone: '06' + u,
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
  assert.match(echt.body.ceremonie, /^[A-Za-z0-9_-]{32}$/, 'met een onvoorspelbare, eenmalige ceremoniecode');
  assert.equal((echt.body.opties.allowCredentials || []).length, 8,
    'de gerichte terugval heeft ook voor een onbekend account exact dezelfde vaste vorm');

  const naamloos = await api('/api/webauthn/opties', {});
  assert.equal(naamloos.status, 200, 'de nieuwe deur heeft geen loginnaam nodig');
  assert.deepEqual(naamloos.body.opties.allowCredentials || [], [], 'en laat het toestel de sleutel kiezen');
  assert.equal(naamloos.body.opties.userVerification, 'required', 'lokale gebruikerscontrole is verplicht');
});

test('4. inloggen met een valse passkey faalt en de rem op de deur telt mee', async () => {
  const opties = await api('/api/webauthn/opties', { login: 'pk-nep@x.nl' });
  const r = await api('/api/webauthn/login', { login: 'pk-nep@x.nl', ceremonie: opties.body.ceremonie,
    antwoord: { id: 'nep' } });
  assert.ok(r.status === 401 || r.status === 400, 'geen sessie zonder geldige handtekening');
  assert.ok(!r.body.token, 'en zeker geen token');

  const zonder = await api('/api/webauthn/login', { antwoord: { id: 'nep' } });
  assert.equal(zonder.status, 400, 'zonder de uitgegeven ceremonie bestaat er geen inlogpoging');
});

test('5. beheer: de lijst is leeg tot de ceremonie er een toevoegt; weghalen bestaat', async () => {
  const lijst = await api('/api/webauthn/lijst', {}, lid);
  assert.equal(lijst.status, 200);
  assert.deepEqual(lijst.body.sleutels, []);
  const weg = await api('/api/webauthn/weg', { id: 'bestaat-niet' }, lid);
  assert.equal(weg.status, 404);
});

test('6. roterende nep-sleutels omzeilen de bronrem niet', async () => {
  const kop = { 'X-Forwarded-For': '198.51.100.77' };
  for (let i = 0; i < 10; i++) {
    const opties = await api('/api/webauthn/opties', {}, null, kop);
    assert.equal(opties.status, 200);
    const fout = await api('/api/webauthn/login', { ceremonie: opties.body.ceremonie,
      antwoord: { id: 'roterend-nep-' + i } }, null, kop);
    assert.notEqual(fout.status, 200);
  }
  const dicht = await api('/api/webauthn/opties', {}, null, kop);
  assert.equal(dicht.status, 429,
    'na tien ongeldige assertions krijgt dezelfde bron ook geen verse ceremonies meer');
});

test('7. APP_URL bepaalt de WebAuthn-origin; een verzoekkop kan hem niet verleggen', async t => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wa-origin-'));
  const vast = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map,
    APP_URL: 'https://login.rtg.test' } });
  t.after(() => {
    stop(vast.child);
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  });
  const r = await fetch(vast.base + '/api/webauthn/opties', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://aanvaller.example' }, body: '{}' });
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.opties.rpId, 'login.rtg.test',
    'de vaste beheerconfiguratie wint van de Origin-header van de aanvrager');
});
