/* ============================================================================
   DE EIGENAAR ZET HET PLATFORMCONTRACT MET DE HAND -- /api/onboarding/config/zet.

   test/onboarding.test.js toetst het aanpassen MET AI (/config/ai); de deur
   waarmee de eigenaar de eisen en het contract rechtstreeks zet, riep niemand
   aan. Dit staat in een eigen bestand en niet in onboarding.test.js: dat bestand
   is een vingerafdruk van het taalbewijs (scripts/language-proof.js), en een
   toets erbij zou dat bewijs verouderen zonder dat er aan de taallaag iets
   veranderde.

   Wat er moet kloppen:
     - een gewijzigde contracttekst is een NIEUWE contractversie (wie tekende,
       tekende de oude);
     - dezelfde tekst nog eens, of een tekst van een paar tekens, verandert niets;
     - een gewoon lid komt er niet bij, en na die weigering veranderde er niets;
     - een lid ziet de nieuwe versie meteen in zijn eigen onboarding.

   MUTATIE GEZIEN ZAKKEN: in server/kern/onboarding/beheer.js `sc.contract.versie
   += 1` weggehaald; de toets zakte op "een gewijzigde tekst is een nieuwe versie".

   Draai los: node --test test/onboarding-config-zet.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const OWNER = 'baaszet' + Date.now().toString().slice(-6) + '@rtg-test.nl';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onbzet-'));
let srv, base, lid, owner;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Gewoon Lid', email: 'onbzet' + Date.now() + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  // de eigenaar bestaat al als demo-account (RTG_OWNER_EMAIL); inloggen i.p.v. registreren
  owner = (await api('/api/auth/login', { login: OWNER, password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(lid && owner, 'een lid en de eigenaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de eigenaar zet het contract met de hand; elke echte wijziging is een nieuwe versie', async () => {
  const v0 = (await api('/api/onboarding/config', {}, owner)).body.config.contract.versie;
  assert.ok(Number.isInteger(v0), 'het contract heeft een versie');
  const tekst = 'Artikel 1. Het lid reist op eigen risico en houdt zich aan de huisregels. (toets ' + Date.now() + ')';

  const geweigerd = await api('/api/onboarding/config/zet', { voorstel: { contract: { tekst } } }, lid);
  assert.equal(geweigerd.status, 403, 'een gewoon lid zet het platformcontract niet');
  assert.equal((await api('/api/onboarding/config/zet', { voorstel: { contract: { tekst } } }, null)).status, 401);
  assert.equal((await api('/api/onboarding/config', {}, owner)).body.config.contract.versie, v0, 'en er veranderde niets');

  const zet = await api('/api/onboarding/config/zet', { voorstel: { contract: { tekst } } }, owner);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  assert.equal(zet.body.config.contract.tekst, tekst);
  assert.equal(zet.body.config.contract.versie, v0 + 1, 'een gewijzigde tekst is een nieuwe versie');

  const nogEens = await api('/api/onboarding/config/zet', { voorstel: { contract: { tekst } } }, owner);
  assert.equal(nogEens.body.config.contract.versie, v0 + 1, 'dezelfde tekst is geen nieuwe versie');
  const kort = await api('/api/onboarding/config/zet', { voorstel: { contract: { tekst: 'te kort' } } }, owner);
  assert.equal(kort.body.config.contract.tekst, tekst, 'een tekst van een paar tekens vervangt het contract niet');
  assert.equal(kort.body.config.contract.versie, v0 + 1);

  const st = (await api('/api/onboarding/status', {}, lid)).body;
  assert.equal(st.contract.versie, v0 + 1, 'het lid tekent voortaan de nieuwe versie');
});
