/* BOEKEN EN DE PERSONEELSDEUR VAN HET PARTNERKANAAL VRAGEN EEN ACCOUNT
   (eigenaarsbesluit 19 oktober 2026, AGENTS.md: gebruiken vraagt een account).

   POST /api/book boekte zonder sessie, en POST /api/staff opende het
   bedrijfsbeeld van een partner op alleen een personeelscode. Geen scherm roept
   ze nog aan; ze staan nu achter auth. Een personeelscode blijft een EXTRA
   sleutel bij de sessie, en de boeking hangt aan de codenaam van het account. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-partner-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('boeken en de personeelsdeur: zonder account 401, met een gratis account werkt het', async () => {
  const boeking = { tripId: 'gstaad-alpien', name: 'Test Reiziger', email: 'reiziger@test.nl' };
  assert.equal((await post('/api/book', boeking)).status, 401, 'boeken zonder account');
  assert.equal((await post('/api/staff', { staffCode: 'PK.' + '0'.repeat(32) })).status, 401, 'de personeelsdeur zonder account');

  const wie = await registreerGratis(BASE);
  assert.ok(wie, 'een gratis account');
  const b = await post('/api/book', boeking, wie.token);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.ok(b.body.ref, 'een boekingsreferentie');
  assert.equal((await post('/api/staff', { staffCode: 'PK.' + '0'.repeat(32) }, wie.token)).status, 404,
    'met een account maar een onbekende code: de code blijft de sleutel van het partnerbeeld');
});
