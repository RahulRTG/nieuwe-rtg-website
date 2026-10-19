/* EEN GEZINSPROFIEL HANGT AAN HET ACCOUNT VAN EEN OUDER (eigenaarsbesluit
   19 oktober 2026, AGENTS.md; foundation/accountplicht.js).

   Buiten de demo opent een gezinstoken alleen nog iets in een gezin met een
   EIGENAAR. Zes /api/rtf-families stonden niet onder de vrijgavepoort
   (middleware/foundation-productiepoort.js) en leunden alleen op die plicht --
   en die plicht keek naar NODE_ENV in plaats van naar de demo. Deze toets
   maakt een anoniem gezin in een demo-start, start daarna DEZELFDE gegevens
   zonder demo en loopt de zes families langs:

     - het token van een gezin zonder eigenaar-account: 401, met accountNodig;
     - het token van een gezin aan een gratis account: komt erdoor. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const FAMILIES = [
  '/api/rtf/connect/ontdek',
  '/api/rtf/labfonds/overzicht',
  '/api/rtf/beroepen',
  '/api/rtf/bieb',
  '/api/rtf/geloof',
  '/api/rtf/knelpunt'
];

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test('buiten de demo opent een gezinstoken zonder eigenaar-account geen /api/rtf-familie', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-gezin-'));
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' };

  let srv = await startServer({ env: Object.assign({ RTG_MAGNAAT_TEST: '1' }, env) });
  let anoniem;
  try {
    const P = post(srv.base);
    const g = await P('/api/foundation/gezin/maak',
      { gezinsnaam: 'Anoniem', naam: 'Iemand', pin: '2468', bevoegdGezin: true, privacyAkkoord: true });
    assert.equal(g.status, 200, 'in de demo kan een anoniem gezin nog: ' + JSON.stringify(g.body).slice(0, 160));
    anoniem = { code: g.body.code, token: g.body.token };
    assert.equal((await P('/api/rtf/bieb', anoniem)).status, 200, 'en in de demo opent het');
  } finally { await stop(srv); }

  srv = await startServer({ env: Object.assign({ RTG_MAGNAAT_TEST: '', RTG_DEMO: '' }, env) });
  try {
    const P = post(srv.base);
    for (const pad of FAMILIES) {
      const r = await P(pad, anoniem);
      assert.equal(r.status, 401, pad + ': een gezin zonder eigenaar-account hoort 401 te geven, kreeg ' + r.status);
      assert.equal(r.body.accountNodig, true, pad + ' zegt dat er een account nodig is');
    }

    const ouder = await registreerGratis(srv.base);
    assert.ok(ouder, 'een gratis account');
    const eigen = await P('/api/rtf/eigen-gezin/maak',
      { gezinsnaam: 'Gezin Proef', naam: 'Ouder', bevoegdGezin: true, privacyAkkoord: true }, ouder.token);
    assert.equal(eigen.status, 200, JSON.stringify(eigen.body).slice(0, 160));
    const metAccount = { code: eigen.body.code, token: eigen.body.token };
    for (const pad of FAMILIES) {
      const r = await P(pad, metAccount);
      assert.notEqual(r.status, 401, pad + ': een gezin aan een gratis account komt erdoor');
      assert.notEqual(r.status, 403, pad + ': ' + JSON.stringify(r.body).slice(0, 120));
    }
  } finally {
    await stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
