/* De promotiepoort van een Service-leerobservatie (routes/service-kantoor-learning.js),
   tegen een echte server: de route bestaat, zit achter de kantoordeur en de
   ledenbalie, en geeft niets vrij aan een werkruimte die niet als ontvanger
   bevoegd is. Een leerobservatie gaat naar een ANDERE werkruimte; een geldige
   balie-sessie maakt een onbekende ontvanger niet bevoegd. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

test('leerobservatie: zonder deur geweigerd, een onbekend proces 409, een onbekende ontvanger 404', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = async (pad, body, tok) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const review = { operationId: 'leerproef-review-0001', caseId: 'SUP-ONBEKEND', workspaceCode: 'WS-ONBEKEND',
      processId: 'human-handoff', purpose: 'procesverbetering' };
    const withdraw = { operationId: 'leerproef-intrek-0001', workspaceCode: 'WS-ONBEKEND', reason: 'niet meer nodig',
      observationRef: { domain: 'service', type: 'process-observation', id: 'svobs_onbekend', version: 1 } };
    for (const pad of ['/api/office/service/learning/review', '/api/office/service/learning/withdraw']) {
      const anoniem = await p(pad, pad.endsWith('review') ? review : withdraw);
      assert.ok([401, 403].includes(anoniem.status), pad + ' zonder kantoorsessie: ' + anoniem.status);
    }
    const balie = await kantoorAlsPersoon(srv.base);
    const onbekend = await p('/api/office/service/learning/review', { ...review, processId: 'iets-anders' }, balie);
    assert.equal(onbekend.status, 409, JSON.stringify(onbekend.body));
    const r = await p('/api/office/service/learning/review', review, balie);
    assert.deepEqual([r.status, r.body.code], [404, 'NOT_FOUND'], 'een onbekende ontvanger krijgt niets: ' + JSON.stringify(r.body));
    const w = await p('/api/office/service/learning/withdraw', withdraw, balie);
    assert.deepEqual([w.status, w.body.code], [404, 'NOT_FOUND'], 'en er wordt ook niets ingetrokken: ' + JSON.stringify(w.body));
  } finally { await stop(srv); }
});
