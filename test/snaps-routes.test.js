/* ============================================================================
   SNAPS EN VERHALEN AAN DE RTG-LEDENKANT: /api/member/snaps, /api/member/snap/view,
   /api/member/story/view en /api/member/snap/opdracht.

   test/foundation.test.js loopt dezelfde kern af via de gezinskant
   (/api/rtf/social/...); de ledendeuren riep niemand aan. Wat hier moet kloppen:

     - een snap is KIJK-EEN-KEER: na het openen is hij weg uit de lijst en een
       tweede keer openen geeft niets;
     - alleen de ontvanger opent hem, ook de afzender niet;
     - een verhaal zien vrienden, een buitenstaander niet;
     - de dagopdracht is voor iedereen dezelfde.

   MUTATIE GEZIEN ZAKKEN: in server/kern/sociaal/snaps.js de regel die de snap na
   openen uit db.data.snaps filtert weggehaald; de toets zakte op "na het openen
   is hij weg".

   Draai los: node --test test/snaps-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-snaproutes-'));
const FOTO = 'data:image/png;base64,' + Buffer.from('x'.repeat(60)).toString('base64');
let srv, B, a, b, vreemd;
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(B + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let n = 0;
async function registreer() {
  const u = Date.now().toString(36) + (n++);
  const r = await api('/api/auth/register', { name: 'Snap Lid', email: 'snap' + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const con = await api('/api/member/connections', {}, r.body.token);
  return { token: r.body.token, key: con.body.me, codenaam: con.body.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  B = srv.base;
  a = await registreer(); b = await registreer(); vreemd = await registreer();
  assert.equal((await api('/api/member/connect', { key: b.key }, a.token)).status, 200);
  assert.equal((await api('/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token)).status, 200);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een snap is kijk-een-keer, en alleen voor de ontvanger', async () => {
  assert.equal((await api('/api/member/snap/send', { toKey: b.key, foto: FOTO, tekst: 'kiek' }, a.token)).status, 200);
  const lijst = await api('/api/member/snaps', {}, b.token);
  assert.equal(lijst.status, 200);
  assert.equal(lijst.body.snaps.length, 1, 'de snap staat klaar');
  const snap = lijst.body.snaps[0];
  assert.equal(snap.van, a.codenaam, 'op codenaam');
  assert.equal((await api('/api/member/snaps', {}, a.token)).body.snaps.length, 0, 'de afzender heeft hem niet in zijn lijst');

  assert.equal((await api('/api/member/snap/view', { id: snap.id }, a.token)).status, 404, 'ook de afzender opent hem niet');
  assert.equal((await api('/api/member/snap/view', { id: snap.id }, null)).status, 401);
  const open = await api('/api/member/snap/view', { id: snap.id }, b.token);
  assert.equal(open.status, 200);
  assert.match(open.body.foto, /^data:image\//, 'de foto komt een keer terug');
  assert.equal(open.body.tekst, 'kiek');
  assert.equal((await api('/api/member/snaps', {}, b.token)).body.snaps.length, 0, 'na het openen is hij weg');
  assert.equal((await api('/api/member/snap/view', { id: snap.id }, b.token)).status, 404, 'een tweede keer openen kan niet');
});

test('een verhaal zien vrienden en niet een buitenstaander; de dagopdracht is voor iedereen gelijk', async () => {
  assert.equal((await api('/api/member/story/post', { foto: FOTO, tekst: 'zonsondergang' }, a.token)).status, 200);
  const st = (await api('/api/member/stories', {}, b.token)).body.stories;
  const verhaal = st.find(s => s.van === a.codenaam);
  assert.ok(verhaal, 'de vriend ziet het verhaal');
  assert.equal(verhaal.gezien, false);

  assert.equal((await api('/api/member/story/view', { id: verhaal.id }, vreemd.token)).status, 404, 'een buitenstaander niet');
  const kijk = await api('/api/member/story/view', { id: verhaal.id }, b.token);
  assert.equal(kijk.status, 200);
  assert.equal(kijk.body.tekst, 'zonsondergang');
  assert.match(kijk.body.foto, /^data:image\//);
  assert.equal((await api('/api/member/stories', {}, b.token)).body.stories.find(s => s.id === verhaal.id).gezien, true,
    'na het kijken staat hij als gezien');

  const o1 = await api('/api/member/snap/opdracht', {}, a.token);
  const o2 = await api('/api/member/snap/opdracht', {}, vreemd.token);
  assert.equal(o1.status, 200);
  assert.ok(o1.body.opdracht && o1.body.opdracht.dag, 'er is een opdracht voor vandaag');
  assert.deepEqual(o1.body.opdracht, o2.body.opdracht, 'voor iedereen dezelfde');
  assert.equal((await api('/api/member/snap/opdracht', {}, null)).status, 401);
});
