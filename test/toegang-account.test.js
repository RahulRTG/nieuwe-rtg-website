/* GEBRUIKEN VRAAGT EEN ACCOUNT (eigenaarsbesluit 19 oktober 2026, AGENTS.md).

   Buiten de demo bestaat er geen gastsessie zonder account meer. Deze toets
   start een server ZONDER demo en kijkt naar wat er werkelijk gebeurt:

     1. POST /api/login met tier "guest" geeft geen sessie meer;
     2. een persona-sessie die nog in de sessiebak staat (uit een eerdere,
        demo-start op dezelfde gegevens) komt niet meer door de ledenpoort;
     3. een gratis account (tier "guest", een echt account) werkt gewoon.

   De tegenproef: in de demo blijft de gastinlog bestaan, want de testwereld
   en Magnaat leunen erop. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
async function gratisAccount(P) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: 'Gratis Lid', email: 'gratis' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest', pasApp: 'rtg'
  });
  assert.ok(r.body.token, 'het gratis account is aangemaakt: ' + JSON.stringify(r.body).slice(0, 160));
  return r.body.token;
}

test('buiten de demo: geen gastsessie zonder account, wel een gratis account', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-'));
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' };

  // eerst een demo-start op dezelfde gegevens: daar bestaat de gastinlog nog
  let srv = await startServer({ env: Object.assign({ RTG_MAGNAAT_TEST: '1' }, env) });
  let oudeGast;
  try {
    const P = post(srv.base);
    const g = await P('/api/login', { tier: 'guest', pasApp: 'rtg' });
    assert.equal(g.status, 200, 'in de demo blijft de gastinlog bestaan');
    oudeGast = g.body.token;
    assert.equal((await P('/api/state', {}, oudeGast)).status, 200);
  } finally { await stop(srv); }

  srv = await startServer({ env: Object.assign({ RTG_MAGNAAT_TEST: '', RTG_DEMO: '' }, env) });
  try {
    const P = post(srv.base);
    // 1. de gastinlog geeft geen sessie meer
    const g = await P('/api/login', { tier: 'guest', pasApp: 'rtg' });
    assert.notEqual(g.status, 200, 'buiten de demo geeft tier "guest" geen sessie');
    assert.equal(g.body.token, undefined, 'en dus ook geen token');

    // 2. zonder account: 401, ook met een overgebleven persona-sessie
    assert.equal((await P('/api/state', {})).status, 401, 'zonder token: 401');
    assert.equal((await P('/api/state', {}, oudeGast)).status, 401,
      'een persona-sessie zonder account komt buiten de demo niet door de ledenpoort');
    /* En ook niet langs een deur die resolveSession zelf leest: de belgegevens
       (/api/ice, kern/rtc/ijs.js bearerActor) geven een sessie zonder account
       geen TURN-uitgifte. Zonder sessie is het 401. */
    assert.equal((await P('/api/ice', {}, oudeGast)).status, 401,
      'een persona-sessie zonder account krijgt buiten de demo geen belgegevens');

    // 3. een gratis account werkt
    const tok = await gratisAccount(P);
    const st = await P('/api/state', {}, tok);
    assert.equal(st.status, 200, 'met een gratis account werkt het');
  } finally {
    await stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
