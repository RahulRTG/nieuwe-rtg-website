/* Instant Reality over de routes: /api/instant-reality, /api/instant-reality/event
   en /api/instant-reality/partner. test/instant-reality.test.js toetst de kern
   in het proces; hier komt de eigenaar uit de SESSIE, en dat is wat moet kloppen:

     - elk lid heeft zijn eigen wereld; een ander lid ziet of wijzigt die niet;
     - een gebeurtenis op een verouderde versie is een 409 met de actuele stand,
       een onbekende gebeurtenis een 400, en dezelfde idempotentiesleutel twee
       keer is een herhaling en geen tweede wijziging;
     - de partnerweergave draagt geen intentie en geen toestemmingen.

   MUTATIE GEZIEN ZAKKEN: in server/kern/instant-reality.js de versiecontrole
   (`Number(body.version)!==u.version`) op `false`; de toets zakte op "een
   verouderde versie is een 409".

   Draai los: node --test test/instant-reality-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-instantroutes-'));
let srv, base, a, b;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let n = 0;
const lid = async () => (await api('/api/auth/register', { name: 'Wereld ' + n, email: 'ir' + Date.now() + (n++) + '@x.nl',
  password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  a = await lid(); b = await lid();
  assert.ok(a && b, 'twee leden');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een eigen wereld per lid, met versies en een idempotente sleutel', async () => {
  assert.equal((await api('/api/instant-reality', {}, null)).status, 401);
  const w = await api('/api/instant-reality', {}, a);
  assert.equal(w.status, 200);
  const v0 = w.body.version;
  assert.ok(Number.isInteger(v0));

  const zet = await api('/api/instant-reality/event', { type: 'intent.delta', value: 'Kyoto in oktober', version: v0, key: 'k-1' }, a);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  assert.equal(zet.body.universe.version, v0 + 1);
  assert.equal(zet.body.universe.intent, 'Kyoto in oktober');

  const oud = await api('/api/instant-reality/event', { type: 'world.selected', value: 'ideal', version: v0 }, a);
  assert.equal(oud.status, 409, 'een verouderde versie is een 409');
  assert.equal(oud.body.universe.version, v0 + 1, 'met de actuele stand erbij');
  assert.equal((await api('/api/instant-reality/event', { type: 'verzonnen', version: v0 + 1 }, a)).status, 400);

  const nogEens = await api('/api/instant-reality/event', { type: 'intent.delta', value: 'iets anders', key: 'k-1' }, a);
  assert.equal(nogEens.body.replayed, true, 'dezelfde sleutel is een herhaling');
  assert.equal(nogEens.body.universe.intent, 'Kyoto in oktober', 'en wijzigt niets');

  const vanB = await api('/api/instant-reality', {}, b);
  assert.notEqual(vanB.body.id, w.body.id, 'een ander lid heeft een eigen wereld');
  assert.equal(vanB.body.intent, '', 'en ziet de intentie van de eerste niet');
});

test('de partnerweergave draagt geen intentie en geen toestemmingen', async () => {
  const p = await api('/api/instant-reality/partner', {}, a);
  assert.equal(p.status, 200);
  assert.equal(p.body.intent, undefined);
  assert.equal(p.body.permissions, undefined);
  assert.ok(p.body.intentSummary, 'alleen een samenvatting');
});
