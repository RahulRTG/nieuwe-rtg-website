/* ============================================================================
   BUSINESS PRIVATE-OPERATIES OVER DE ROUTES.

   test/ov-operatie.test.js toetst de kern van kern/ov/operatie.js in het
   proces, met de pas als losse parameter. Over de route komt die pas uit de
   SESSIE, en dat is precies wat hier wordt vastgelegd: een RTG-lid krijgt bij
   /api/ov/operaties een 403 en kan niets aanmaken, een Business-lid (na een
   menselijk besluit, via elevateTier) wel. Daarnaast:

     - /api/ov/operaties toont alleen de EIGEN operaties;
     - /api/ov/operatie/segment werkt pas na activeren met de eenmalige code,
       vraagt per segment een expliciet akkoord en betaalt niets;
     - een ander Business-lid vindt andermans operatie niet.

   MUTATIE GEZIEN ZAKKEN: in server/kern/ov/operatie.js de grendel
   `data.akkoord !== true` in segment() op `false`; de toets zakte op "zonder
   akkoord geen aanvraag".

   Draai los: node --test test/ov-operatie-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, elevateTier } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ovoperatie-'));
let srv, base, rtgLid, zakelijk, ander;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let n = 0;
async function lid() {
  const u = Date.now() + '-' + (n++);
  const r = await api('/api/auth/register', { name: 'Reiziger ' + u, email: 'ovop' + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
  return r.body.token;
}
async function business() {
  const tok = await lid();
  await elevateTier(base, tok, 'business');
  // na het besluit opnieuw de sessie lezen: de pas staat nu op business
  const me = await api('/api/auth/me', {}, tok);
  assert.equal(me.body.user && me.body.user.tier, 'business', 'het lid is Business na het menselijke besluit');
  return tok;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  rtgLid = await lid();
  zakelijk = await business();
  ander = await business();
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een RTG-lid ontsluit geen private operaties via de route', async () => {
  assert.equal((await api('/api/ov/operaties', {}, rtgLid)).status, 403);
  assert.equal((await api('/api/ov/operatie/concept', { van: 'A', naar: 'B' }, rtgLid)).status, 403);
  assert.equal((await api('/api/ov/operaties', {}, null)).status, 401);
});

test('concept, activeren en per segment akkoord: de keten over de route, en alleen voor de eigenaar', async () => {
  const leeg = await api('/api/ov/operaties', {}, zakelijk);
  assert.equal(leeg.status, 200);
  assert.ok(leeg.body.grenzen.length > 0, 'de grenzen staan erbij');

  const c = await api('/api/ov/operatie/concept', { van: 'Hotel', naar: 'Stadion', modi: ['chauffeur', 'bus'], personen: 6 }, zakelijk);
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 160));
  const id = c.body.operatie.id;
  const lijst = (await api('/api/ov/operaties', {}, zakelijk)).body.operaties;
  assert.ok(lijst.some(o => o.id === id), 'de eigen operatie staat in het overzicht');
  assert.ok(!(await api('/api/ov/operaties', {}, ander)).body.operaties.some(o => o.id === id), 'een ander Business-lid ziet hem niet');

  const seg = c.body.operatie.segmenten[0];
  assert.equal((await api('/api/ov/operatie/segment', { id, segmentId: seg.id, actie: 'vraag-aan', akkoord: true }, zakelijk)).status, 409,
    'een concept vraagt nog niets aan');
  assert.equal((await api('/api/ov/operatie/bevestig', { id, code: c.body.bevestigCode }, ander)).status, 404);
  const act = await api('/api/ov/operatie/bevestig', { id, code: c.body.bevestigCode }, zakelijk);
  assert.equal(act.status, 200);

  assert.equal((await api('/api/ov/operatie/segment', { id, segmentId: seg.id, actie: 'vraag-aan', akkoord: true }, ander)).status, 404,
    'andermans operatie bestaat hier niet');
  const zonder = await api('/api/ov/operatie/segment', { id, segmentId: seg.id, actie: 'vraag-aan' }, zakelijk);
  assert.equal(zonder.status, 409, 'zonder akkoord geen aanvraag');
  assert.equal((await api('/api/ov/operatie/segment', { id, segmentId: seg.id, actie: 'teleporteer' }, zakelijk)).status, 400);
  const aan = await api('/api/ov/operatie/segment', { id, segmentId: seg.id, actie: 'vraag-aan', akkoord: true }, zakelijk);
  assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
  assert.equal(aan.body.segment.status, 'aangevraagd');
  assert.equal(aan.body.segment.betaald, false, 'aanvragen is niet betalen');
  assert.equal(aan.body.operatie.status, 'in-regie');

  const terug = (await api('/api/ov/operaties', {}, zakelijk)).body.operaties.find(o => o.id === id);
  assert.equal(terug.segmenten.find(s => s.id === seg.id).status, 'aangevraagd', 'de aanvraag is bewaard');
});
