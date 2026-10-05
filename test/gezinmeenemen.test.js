/* EEN BESTAAND GEZIN MEENEMEN NAAR EEN ACCOUNT (foundation/gezinmeenemen.js,
   DPIA-GEZIN.md R-G8), op een ECHTE server.

   Het gezin ontstaat zoals vroeger, op een server ZONDER accountplicht (code +
   PIN, een kind erin). Daarna start een server MET de plicht op dezelfde map en
   met dezelfde sleutels, en daar neemt de beheerder het mee. Zo meet dit wat
   een gezin van voor 5 oktober werkelijk overkomt, en niet een nagebouwd gezin.

   Draai los: node --test test/gezinmeenemen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, stopNet } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinmeenemen-'));
const SLEUTELS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };
let child, base, oud;

async function post(b, pad, body, token) {
  const r = await fetch(b + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let lijf = {}; try { lijf = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: lijf, tekst };
}
const mij = (code, token) => fetch(base + '/api/foundation/gezin/' + code + '/mij',
  { headers: { Authorization: 'Bearer ' + token } }).then(r => r.status);

test.before(async () => {
  const eerst = await startServer({ env: { ...SLEUTELS, SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const g = await post(eerst.base, '/api/foundation/gezin/maak',
      { gezinsnaam: 'Gezin Oud', naam: 'Beheerder', pin: '2468', bevoegdGezin: true, privacyAkkoord: true });
    assert.equal(g.status, 200, g.tekst);
    assert.match(String(g.body.gezinscode), /^GC\./, 'het gezin heeft een gezinscode van na B18');
    const k = await post(eerst.base, '/api/foundation/gezin/profiel/maak',
      { code: g.body.code, token: g.body.token, naam: 'Noor', rol: 'kind', geboortedatum: '2016-04-12', pin: '1357' });
    assert.equal(k.status, 200, k.tekst);
    oud = { code: g.body.code, gezinscode: g.body.gezinscode, token: g.body.token };
  } finally { await stopNet(eerst.child); }
  ({ child, base } = await startServer({ env: { ...SLEUTELS, SMTP_URL: '', RTG_DATA_DIR: TMP, RTF_GEZIN_ACCOUNTPLICHT: '1' } }));
});
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let ouder;

test('1. onder de plicht opent het oude gezin niets, tot het is meegenomen', async () => {
  assert.equal(await mij(oud.code, oud.token), 403, 'zonder eigenaar opent de oude sessie niets');
});

test('2. een verkeerde pincode, of de pincode van het kind, neemt niets mee', async () => {
  ouder = await registreerGratis(base);
  assert.ok(ouder, 'een gratis account');
  const fout = await post(base, '/api/rtf/eigen-gezin/koppel', { gezinscode: oud.gezinscode, pin: '9999' }, ouder.token);
  assert.equal(fout.status, 403, fout.tekst);
  const kind = await post(base, '/api/rtf/eigen-gezin/koppel', { gezinscode: oud.gezinscode, pin: '1357' }, ouder.token);
  assert.equal(kind.status, 403, 'alleen de beheerder neemt het gezin mee: ' + kind.tekst);
  const stand = await post(base, '/api/rtf/eigen-gezin', {}, ouder.token);
  assert.equal(stand.body.gezin, null, 'er hangt nog niets aan het account');
});

test('3. de beheerder neemt het mee: zijn account is daarna de sleutel', async () => {
  const r = await post(base, '/api/rtf/eigen-gezin/koppel', { gezinscode: oud.gezinscode, pin: '2468' }, ouder.token);
  assert.equal(r.status, 200, r.tekst);
  assert.equal(r.body.code, oud.code, 'hetzelfde gezin, met zijn gegevens');
  assert.ok(r.body.profielen.some(p => p.naam === 'Noor'), 'het kind is er nog');
  assert.equal(await mij(oud.code, r.body.token), 200, 'de nieuwe sessie opent het gezin');
  const s = await post(base, '/api/rtf/eigen-gezin/sessie', {}, ouder.token);
  assert.equal(s.status, 200, 'en daarna gaat het zonder code of pincode');
});

test('4. een tweede keer, of een ander account, neemt het niet over', async () => {
  const nog = await post(base, '/api/rtf/eigen-gezin/koppel', { gezinscode: oud.gezinscode, pin: '2468' }, ouder.token);
  assert.equal(nog.status, 409, 'dit account heeft al een gezin: ' + nog.tekst);
  assert.equal(nog.body.token, undefined, 'geen sessie bij een weigering');
  const ander = await registreerGratis(base);
  const over = await post(base, '/api/rtf/eigen-gezin/koppel', { gezinscode: oud.gezinscode, pin: '2468' }, ander.token);
  assert.equal(over.status, 409, 'een gezin met een eigenaar gaat niet naar een tweede account: ' + over.tekst);
  assert.equal(over.body.token, undefined);
});

test('5. zonder account geen meenemen', async () => {
  const r = await post(base, '/api/rtf/eigen-gezin/koppel', { gezinscode: oud.gezinscode, pin: '2468' });
  assert.ok([401, 403].includes(r.status), String(r.status));
});
