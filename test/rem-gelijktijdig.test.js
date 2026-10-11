/* ============================================================================
   EEN GOLF GELIJKTIJDIGE GOKKEN GAAT NIET LANGS DE REM -- regressie voor N39 uit
   de V1-audit (ronde 7).

   DE FOUT: kern/identiteit/wachtwoordrem.js keek vóór de wachtwoordtoets of een
   emmer dicht was en telde pas erna. Honderd gelijktijdige gokken op een
   account vanaf een adres gaven honderd keer 401 en geen 429, op
   /api/auth/login en op de werkplekinlog.

   DE FIX: een poging telt vanaf dicht() (kern/identiteit/lopend.js). De
   emmer van adres plus account (10) en die van het adres (50) houden dan ook
   een golf tegen.

   Draai los: node --test test/rem-gelijktijdig.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-remgolf-'));

async function post(pad, body, adres) {
  const r = await fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': adres }, body: JSON.stringify(body) });
  return r.status;
}
const telling = lijst => lijst.reduce((t, s) => (t[s] = (t[s] || 0) + 1, t), {});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: '' } });
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

for (const [nr, pad, adres] of [[1, '/api/auth/login', '198.20.1.1'], [2, '/api/supplier/mijn/login', '198.20.2.2']]) {
  test(nr + '. veertig gelijktijdige gokken op ' + pad + ' vanaf een adres: hooguit tien komen bij het wachtwoord', async () => {
    const golf = await Promise.all(Array.from({ length: 40 },
      () => post(pad, { login: 'nora@rtg.example', password: 'fout' }, adres)));
    const t = telling(golf);
    assert.ok((t[401] || 0) <= 10, 'hooguit tien gokken worden getoetst, kreeg ' + JSON.stringify(t));
    assert.ok((t[429] || 0) >= 30, 'de rest krijgt 429, kreeg ' + JSON.stringify(t));
  });
}

test('3. TEGENPROEF: een ander adres en een ander account merken er niets van', async () => {
  assert.equal(await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' }, '198.20.3.3'), 200,
    'de eigenaar logt gewoon in vanaf een eigen adres');
});

test('4. TEGENPROEF: na een geslaagde inlog is de plek terug, dus wie na elkaar inlogt merkt niets', async () => {
  for (let i = 0; i < 15; i++) {
    assert.equal(await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' }, '198.20.4.4'), 200,
      'inlog ' + (i + 1) + ' na elkaar vanaf hetzelfde adres');
  }
});

test('5. de adresemmer (50) houdt een golf over veel accounts tegen', async () => {
  const golf = await Promise.all(Array.from({ length: 70 },
    (_, i) => post('/api/auth/login', { login: 'golf' + i + '@nergens.test', password: 'fout' }, '198.20.5.5')));
  const t = telling(golf);
  assert.ok((t[401] || 0) <= 50, 'hooguit vijftig gokken per adres, kreeg ' + JSON.stringify(t));
  // de rest krijgt 429, of 403 zodra de noodrem het adres in quarantaine zet
  assert.equal((t[429] || 0) + (t[403] || 0), 70 - (t[401] || 0), 'de rest wordt geweigerd, kreeg ' + JSON.stringify(t));
  assert.ok((t[401] || 0) < 70);
});

test('6. een plek die nooit wordt teruggegeven, vervalt (een fout in een deur zet niets blijvend dicht)', () => {
  const lopend = require('../server/kern/identiteit/lopend');
  const echt = Date.now;
  let nu = echt();
  Date.now = () => nu;
  try {
    lopend.neem('proef:verval');
    assert.equal(lopend.aantal('proef:verval'), 1);
    nu += lopend.VENSTER_MS - 1000;
    assert.equal(lopend.aantal('proef:verval'), 1, 'binnen het venster telt hij nog');
    nu += 2000;
    assert.equal(lopend.aantal('proef:verval'), 0, 'na het venster is de plek terug');
  } finally { Date.now = echt; }
});
