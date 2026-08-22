/* ============================================================================
   DE RONDE IN DE ECHTE SERVER.

   test/ronde.test.js toetst de ronde met een nagebootste wereld; dit bestand
   toetst dat hij in de gemonteerde server BESTAAT en draait. Die twee zijn niet
   hetzelfde -- dat was juist het probleem: vier lagen werkten prima en werden
   door niemand aangeroepen.

   Draai los: node --experimental-sqlite --test test/commercie-ronde.e2e.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ronde-'));
const post = (p, b, t) => fetch(base + p, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(office, 'kantoor is ingelogd');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de ronde is gemount en draait, met een uitslag per stap', async () => {
  const r = await post('/api/office/commercie/ronde', {}, office);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const u = r.body.uitslag;
  for (const stap of ['fees', 'contracten', 'tegoeden', 'verrekening'])
    assert.ok(u[stap], 'de stap ' + stap + ' hoort in de uitslag te staan');
  assert.ok(u.openstaand, 'en wat er nog openstaat');
  assert.ok(!u.fees.fout, 'de fee-stap loopt niet vast: ' + u.fees.fout);
  assert.ok(!u.contracten.fout, 'de contractstap ook niet: ' + u.contracten.fout);
});

test('zonder RTF_IBAN blijft de sociale afdracht staan, en dat zegt de uitslag ook', async () => {
  const r = await post('/api/office/commercie/ronde', {}, office);
  const soc = r.body.uitslag.verrekening.sociaal;
  assert.equal(soc.gelukt, 0);
  assert.match(soc.reden || '', /geen bestemming/,
    'een lege omgevingsvariabele hoort geen betaalbaarstelling te veroorzaken');
});

test('het openstaande bord is opvraagbaar zonder een ronde te draaien', async () => {
  const r = await post('/api/office/commercie/openstaand', {}, office);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  for (const post_ of ['ledenvoordeel', 'prijsgarantie', 'sociaal', 'afgekeurd'])
    assert.ok(r.body[post_], post_ + ' hoort op het bord te staan');
});

/* De claims-laag hoort mee te veranderen met wat er gebouwd is. Stond de
   prijsgarantie eerst als GEBOUWD met "geen terugbetaalstroom", dan hoort die
   kanttekening te verdwijnen zodra de stroom er is -- anders is het document
   opnieuw uit de pas met de code, en dat was gat 4.1. */
test('de publieke claims kloppen met wat er nu draait', async () => {
  const r = await post('/api/claims', {});
  assert.equal(r.status, 200);
  const op = id => r.body.claims.find(c => c.id === id);
  assert.equal(op('claim.partner.commission').waarde, 'ZERO');
  assert.equal(op('claim.partner.entry_fee').waarde, 'GEEN');

  const poort = await post('/api/office/claims/poort', {}, office);
  assert.equal(poort.body.ok, true,
    'geen financiele claim zonder bewijs: ' + (poort.body.problemen || []).join('; '));
});
