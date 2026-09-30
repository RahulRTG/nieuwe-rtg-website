'use strict';
/* DE OV-DIENST LEEST VERZUIM (kern/ov/dienst.js, PLANNING.md par. 6).

   De chauffeur start zijn dienst zelf. Staat hij vandaag als afwezig in het
   verzuimregister, dan loopt de dienst gewoon -- wie er is, weet dat beter dan
   een register -- maar zegt de PDA het erbij: DAT, nooit waarom. Tegen een
   echte server, met de zaak Ibiza Transit uit de zaaiset. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

test('een ziekgemelde chauffeur start zijn dienst wel, en krijgt het erbij te horen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ovverzuim-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, token) => fetch(srv.base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const ch = (await api('supplier/roster', { code: 'TRANSIT' })).body.staff.find(x => x.role !== 'manager');
    const tok = (await api('supplier/login', { code: 'TRANSIT', staffId: ch.id, pin: '5678' })).body.token;
    assert.ok(tok);

    const voor = await api('staff/ov/dienst', { lijnId: 'L1', voertuigNaam: 'Bus 4' }, tok);
    assert.equal(voor.status, 200, JSON.stringify(voor.body));
    assert.equal(voor.body.afwezigWaarschuwing, undefined, 'wie er gewoon is, krijgt geen waarschuwing');
    await api('staff/ov/dienst', { aan: false }, tok);

    const ziek = await api('staff/leave/request', { soort: 'ziek' }, tok);
    assert.equal(ziek.status, 200, JSON.stringify(ziek.body));

    const na = await api('staff/ov/dienst', { lijnId: 'L1', voertuigNaam: 'Bus 4' }, tok);
    assert.equal(na.status, 200, 'de dienst loopt gewoon: ' + JSON.stringify(na.body));
    assert.equal(na.body.aan, true);
    assert.match(na.body.afwezigWaarschuwing || '', /als afwezig gemeld/);
    assert.doesNotMatch(na.body.afwezigWaarschuwing, /ziek/i, 'DAT hij afwezig staat, nooit waarom');
  } finally {
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
