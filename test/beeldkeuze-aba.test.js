/* EEN FOTO KIEZEN, HERSTELLEN EN WEER KIEZEN STAAT ER OOK.

   /api/ik/beelden/zet stond in lib/idemsleutels-beelden.js als
   `zelfdeVerzoek`: een woordelijk gelijk verzoek binnen vijf seconden telt als
   herhaling en krijgt het eerste antwoord terug. Voor een ZETTER is dat fout:
   kies foto X, "Herstel RTG-beeld", kies X weer -- de derde gaat niet door,
   het lid krijgt "ok" met X erin, en op het scherm staat het RTG-beeld.
   Gevonden bij de voltooiproef van link:ontdek. Hetzelfde patroon stond al
   verklaard bij /api/muziek/mooi (lib/idemsleutels-media.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let srv;
test.before(async () => { srv = await startServer({ env: { RTG_DEMO: '0', RTG_AI_UIT: '1', SMTP_URL: '' } }); });
test.after(async () => { if (srv) await stop(srv.child); });

async function post(pad, body, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  const r = await fetch(srv.base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
}

test('kiezen, herstellen en dezelfde foto weer kiezen binnen vijf seconden laat de foto staan', async () => {
  const lid = (await post('/api/auth/register', { name: 'Beeldkeuze', email: 'aba-beeld@test.invalid',
    phone: '0611113333', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).body;
  const up = await post('/api/bestanden/upload', { naam: 'huis.png', dataUrl: PNG }, lid.token);
  assert.equal(up.status, 200, JSON.stringify(up.body));
  const keuze = { slot: 'living/hoofd', image: { file: up.body.id, desktop: { x: 30, y: 40, zoom: 1 }, mobile: { x: 50, y: 50, zoom: 1 } } };
  assert.equal((await post('/api/ik/beelden/zet', keuze, lid.token)).status, 200);
  assert.equal((await post('/api/ik/beelden/zet', { slot: 'living/hoofd', image: null }, lid.token)).status, 200);
  const weer = await post('/api/ik/beelden/zet', keuze, lid.token);
  assert.equal(weer.status, 200);
  const stand = (await post('/api/ik/beelden', {}, lid.token)).body.images;
  assert.ok(stand['living/hoofd'], 'de opnieuw gekozen foto staat er: ' + JSON.stringify(stand));
  assert.equal(stand['living/hoofd'].file, up.body.id);
});
