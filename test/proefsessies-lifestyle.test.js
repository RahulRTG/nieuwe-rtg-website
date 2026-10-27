/* De APPWERKT-persona `lifestyle` mag niet als een kunstmatige tier of
   handgemaakt token ontstaan. Deze proef loopt de echte menselijke
   goedkeuringsroute af en bewijst daarna beide kanten van de premiumdeur: het
   goedgekeurde lid komt binnen en een gewoon lid blijft buiten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { haalSessies, haalLifestyleLid } = require('../scripts/lib/proefsessies');

let srv;
let data;
test.before(async () => {
  data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-proefsessies-lifestyle-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
});
test.after(async () => {
  await stop(srv && srv.child);
  try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
});

const api = (pad, token) => fetch(srv.base + pad, { method: 'POST', headers: {
  'Content-Type': 'application/json', Authorization: 'Bearer ' + token
}, body: '{}' }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('Lifestyle-proefsessie ontstaat via menselijk besluit en opent alleen daarmee de premiumdeur', async () => {
  const kantoor = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
  assert.ok(kantoor, 'de kantoormens op naam kon niet inloggen');
  const lifestyle = await haalLifestyleLid(srv.base, kantoor);
  assert.equal(lifestyle.ok, true, lifestyle.reden + ': ' + JSON.stringify(lifestyle.stappen));
  assert.equal(lifestyle.tier, 'lifestyle');
  assert.ok(lifestyle.stappen.some((s) => s.naam.includes('kantoor accepteert') && s.ok),
    'de sessie heeft geen aantoonbaar menselijk pasbesluit doorlopen');
  assert.ok(lifestyle.stappen.some((s) => s.naam.includes('identiteit') && s.ok),
    'de sessie heeft geen identiteitscontrole doorlopen');

  const premium = await api('/api/member/rechterhand/hangar', lifestyle.token);
  assert.equal(premium.status, 200, JSON.stringify(premium.body));

  const { sessies, overgeslagen } = await haalSessies(srv.base, ['lid']);
  assert.deepEqual(overgeslagen, []);
  const onboarding = await api('/api/onboarding/status', sessies.lid.waarde);
  assert.equal(onboarding.status, 200);
  assert.equal(onboarding.body.klaar, true,
    'de centrale browserpersona moet de echte onboardingroute hebben afgerond');
  const identiteit = await api('/api/verify/status', sessies.lid.waarde);
  assert.equal(identiteit.status, 200);
  assert.equal(identiteit.body.status, 'pending',
    'de browserpersona moet de echte identiteitsroute hebben doorlopen voordat geldbediening wordt gemeten');
  const gewoon = await api('/api/member/rechterhand/hangar', sessies.lid.waarde);
  assert.equal(gewoon.status, 403, 'een gewone RTG Pass kreeg onverwacht toegang tot Hangar');
  assert.match(String(gewoon.body.error || ''), /Lifestyle Pass/);
});
