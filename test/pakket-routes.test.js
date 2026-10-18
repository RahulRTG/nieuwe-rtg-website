/* RTG Bedrijfspakketten over de routes: /api/pakket/typen en /api/pakket/advies.
   test/pakket.test.js toetst de catalogus in het proces; hier gaat het om de
   deur: alleen met een sessie, een onbekend type is een nette 404, en zonder
   AI-sleutel kleurt Rahul niets bij (opmaat blijft leeg) in plaats van advies te
   verzinnen. Het pakket dat de route geeft is precies het pakket uit de kern.

   MUTATIE GEZIEN ZAKKEN: in server/routes/member/pakket.js de 404-regel
   (`if (!a) return ...`) weggehaald; de toets zakte op "een onbekend type is
   een 404".

   Draai los: node --test test/pakket-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { advies } = require('../server/kern/pakketten');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pakketroutes-'));
let srv, base, lid;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Ondernemer', email: 'pk' + Date.now() + '@x.nl',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'een lid registreert');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('typen en advies: met sessie het pakket uit de kern, zonder sessie niets', async () => {
  assert.equal((await api('/api/pakket/typen', {}, null)).status, 401);
  assert.equal((await api('/api/pakket/advies', { type: 'horeca' }, null)).status, 401);

  const t = await api('/api/pakket/typen', {}, lid);
  assert.equal(t.status, 200);
  assert.ok(t.body.typen.length > 0, 'er zijn bedrijfstypen');
  assert.ok(t.body.typen.some(x => x.id === 'horeca'));

  const a = await api('/api/pakket/advies', { type: 'horeca' }, lid);
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.advies, JSON.parse(JSON.stringify(advies('horeca'))), 'de route geeft precies het kernpakket');

  const onbekend = await api('/api/pakket/advies', { type: 'ruimtevaart' }, lid);
  assert.equal(onbekend.status, 404, 'een onbekend type is een 404');
  assert.match(onbekend.body.error, /Onbekend bedrijfstype/);
});

test('advies met een situatie: zonder AI-sleutel blijft de opmaat leeg, het pakket staat er gewoon', async () => {
  const a = await api('/api/pakket/advies', { type: 'horeca', situatie: '40 couverts, twee bars, veel events' }, lid);
  assert.equal(a.status, 200);
  assert.equal(a.body.advies.opmaat, null, 'geen verzonnen advies zonder model');
  assert.ok(a.body.advies.werkplekken.length > 0, 'het pakket zelf staat er wel');
  assert.equal((await api('/api/pakket/advies', { type: '', situatie: 'x' }, lid)).status, 404);
});
