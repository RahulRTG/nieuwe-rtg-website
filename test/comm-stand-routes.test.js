/* ============================================================================
   HET COMMUNICATIEPLATFORM: ZOEKEN EN HET CONCEPT -- /api/comm/zoek en
   /api/comm/concept.

   De andere comm-deuren lopen via de schermsuite (comm.e2e.js); deze twee riep
   geen Node-toets aan. Wat er moet kloppen:

     - zoeken vindt alleen in gesprekken waar het lid zelf in zit; een derde
       vindt met dezelfde zoekterm niets, en een zoekterm van een letter is geen
       zoekopdracht;
     - het concept (een half getypt bericht) is van het lid zelf en van dit
       gesprek; wie er niet in zit, zet er geen concept in, en leegmaken haalt
       het weg.

   MUTATIE GEZIEN ZAKKEN: in server/kern/comm/tonen.js de regel
   `if (!magErin(g, mij)) continue;` in zoek() weggehaald; de toets zakte op "een
   derde vindt niets".

   Draai los: node --test test/comm-stand-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-commstand-'));
let srv, B, a, b, derde, gid;
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(B + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let n = 0;
async function registreer() {
  const u = Date.now().toString(36) + (n++);
  const r = await api('/api/auth/register', { name: 'Comm Lid', email: 'comm' + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const con = await api('/api/member/connections', {}, r.body.token);
  return { token: r.body.token, key: con.body.me };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  B = srv.base;
  a = await registreer(); b = await registreer(); derde = await registreer();
  assert.equal((await api('/api/member/connect', { key: b.key }, a.token)).status, 200);
  assert.equal((await api('/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token)).status, 200);
  const g = await api('/api/comm/begin', { met: b.key }, a.token);
  assert.equal(g.status, 200, JSON.stringify(g.body).slice(0, 160));
  gid = g.body.gesprek.id;
  assert.equal((await api('/api/comm/stuur', { id: gid, tekst: 'Zullen we donderdag om acht uur eten?' }, a.token)).status, 200);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zoeken vindt alleen in de eigen gesprekken', async () => {
  const z = await api('/api/comm/zoek', { vraag: 'donderdag' }, b.token);
  assert.equal(z.status, 200);
  assert.ok(z.body.treffers.length > 0, 'de ontvanger vindt het bericht');
  assert.equal(z.body.treffers[0].gesprekId, gid);
  assert.equal(z.body.treffers[0].vanMij, false);
  const bijA = await api('/api/comm/zoek', { vraag: 'DONDERDAG' }, a.token);
  assert.equal(bijA.body.treffers[0].vanMij, true, 'hoofdletters maken niet uit, en de afzender ziet dat het van hem is');

  const vreemd = await api('/api/comm/zoek', { vraag: 'donderdag' }, derde.token);
  assert.equal(vreemd.status, 200);
  assert.equal(vreemd.body.totaal, 0, 'een derde vindt niets');
  assert.equal((await api('/api/comm/zoek', { vraag: 'd' }, b.token)).body.treffers.length, 0, 'een letter is geen zoekopdracht');
  assert.equal((await api('/api/comm/zoek', { vraag: 'donderdag' }, null)).status, 401);
});

test('het concept is van het lid en van dit gesprek', async () => {
  const c = await api('/api/comm/concept', { id: gid, tekst: 'Prima, ik reserveer' }, b.token);
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 160));
  assert.equal(c.body.stand.concept, 'Prima, ik reserveer');
  assert.equal((await api('/api/comm/concept', { id: gid, tekst: 'ingebroken' }, derde.token)).status, 400,
    'wie niet in het gesprek zit, zet er geen concept in');
  const leeg = await api('/api/comm/concept', { id: gid, tekst: '' }, b.token);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.stand.concept, undefined, 'leegmaken haalt het concept weg');
});
