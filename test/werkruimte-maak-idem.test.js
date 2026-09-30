/* EEN RETRY MET DEZELFDE SLEUTEL MAAKT GEEN TWEEDE WERKRUIMTE.

   /api/bedrijf/werkruimte/maak staat in lib/eenmalig-geheim-routes.js: het
   antwoord draagt een beheer-token dat alleen als hash blijft, dus geen
   generieke antwoordcache mag het herhalen. Dan moet het domein de dubbele
   uitgifte zelf tegenhouden. De staatproef van 29 september 2026 zag dat het
   dat niet deed: dezelfde sleutel twee keer gaf twee werkruimtes, terwijl het
   mutatiecontract PROTECTED zei.

     1. dezelfde idem twee keer: een werkruimte, en de tweede keer 409 zonder token
     2. een andere idem: gewoon een tweede werkruimte (de rem is geen verbod)
     3. de Idempotency-Key header telt ook

   Draai los: node --test test/werkruimte-maak-idem.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

async function post(base, pad, body, headers) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body || {}) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

test('een retry met dezelfde sleutel maakt geen tweede werkruimte en toont het token niet opnieuw', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wmi-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const eerste = await post(base, '/api/bedrijf/werkruimte/maak', { naam: 'Proef BV', idem: 'wmi-een' });
    assert.equal(eerste.status, 200, JSON.stringify(eerste.data));
    assert.ok(eerste.data.beheerToken, 'de eerste keer hoort het token er te staan');

    const tweede = await post(base, '/api/bedrijf/werkruimte/maak', { naam: 'Proef BV', idem: 'wmi-een' });
    assert.equal(tweede.status, 409, JSON.stringify(tweede.data));
    assert.equal(tweede.data.code, 'WERKRUIMTE_AL_GEMAAKT');
    assert.equal(tweede.data.beheerToken, undefined, 'een herhaling toont het token nooit opnieuw');
    assert.equal(tweede.data.werkruimte, undefined);

    const ander = await post(base, '/api/bedrijf/werkruimte/maak', { naam: 'Proef BV', idem: 'wmi-twee' });
    assert.equal(ander.status, 200, 'een andere sleutel is een nieuwe werkruimte');
    assert.notEqual(ander.data.werkruimte, eerste.data.werkruimte);

    const kop1 = await post(base, '/api/bedrijf/werkruimte/maak', { naam: 'Kop BV' }, { 'Idempotency-Key': 'wmi-kop' });
    const kop2 = await post(base, '/api/bedrijf/werkruimte/maak', { naam: 'Kop BV' }, { 'Idempotency-Key': 'wmi-kop' });
    assert.equal(kop1.status, 200);
    assert.equal(kop2.status, 409, 'de header telt als sleutel');
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
