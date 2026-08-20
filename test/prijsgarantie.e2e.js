/* ============================================================================
   DE MELDKNOP, end-to-end.

   test/prijsmelding.test.js toetst de kern; dit bestand toetst dat de knop er
   ECHT is -- dat het lid hem kan indienen en dat de zaak hem ziet. Die twee
   dingen zijn niet hetzelfde: de kern werkte al voordat de routes bestonden, en
   een belofte in de voorwaarden wordt pas waar als er een pad naartoe loopt.

   Onderweg gevonden: `veilig` is geen kern-sleutel maar een helper die elk
   routebestand zelf opzet. Hem uit kern halen geeft undefined, en dan is elke
   aanroep een 500 zonder dat er iets in de log staat waar je wat aan hebt.

   Draai los: node --experimental-sqlite --test test/prijsgarantie.e2e.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pg-'));
const post = (p, b, t) => fetch(base + p, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
test('de meldknop bestaat en werkt end-to-end', async () => {
  const u = Date.now().toString().slice(-8);
  const lid = (await post('/api/auth/register', { name: 'PG', email: 'pg' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'lid ingelogd');
  const meld = await post('/api/member/prijsgarantie/meld',
    { supplierCode: 'KIKUNOI', omschrijving: 'Ramen', betaald: 22, gezien: 19 }, lid);
  assert.equal(meld.status, 200, JSON.stringify(meld.body));
  assert.equal(meld.body.melding.verschil, 3);
  const mijn = await post('/api/member/prijsgarantie', {}, lid);
  assert.equal(mijn.body.meldingen.length, 1);
  const sup = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const bij = await post('/api/supplier/prijsgarantie', {}, sup);
  assert.equal(bij.status, 200, JSON.stringify(bij.body));
  assert.ok(bij.body.meldingen.length >= 1, 'de zaak ziet de melding');
});
