/* ============================================================================
   HET SALONGESPREK OVER DE ROUTES: /api/klets/zet, /api/klets/start en
   /api/klets/gesprek.

   test/klets.test.js toetst de drie sloten in het proces op een nagebouwde db.
   Over de route komen de sleutels uit de SESSIE en de vriendschap uit de echte
   vriendenlaag, en dat is wat hier wordt vastgelegd:

     - alleen tussen verbonden leden, en alleen als BEIDEN het aan hebben;
     - de ander leest hetzelfde gesprek, met "mij" vanuit zijn eigen kant;
     - een derde vindt het gesprek niet, en gasten komen er niet in;
     - zonder model (geen AI-sleutel) verzint hij geen "echt" gesprek.

   MUTATIE GEZIEN ZAKKEN: in server/kern/kletspraat/index.js de regel
   `if (!kletsAan(vriend)) return ...` weggehaald; de toets zakte op "de ander
   heeft het nog niet aan".

   Draai los: node --test test/klets-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kletsroutes-'));
let srv, B, a, b, derde, gast;
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(B + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let n = 0;
async function registreer() {
  const u = Date.now().toString(36) + (n++);
  const r = await api('/api/auth/register', { name: 'Klets Lid', email: 'klets' + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  const con = await api('/api/member/connections', {}, r.body.token);
  return { token: r.body.token, key: con.body.me };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  B = srv.base;
  a = await registreer(); b = await registreer(); derde = await registreer();
  assert.equal((await api('/api/member/connect', { key: b.key }, a.token)).status, 200);
  assert.equal((await api('/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token)).status, 200);
  gast = (await api('/api/login', { tier: 'guest' })).body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('alleen tussen vrienden die het allebei aan hebben', async () => {
  for (const pad of ['/api/klets/zet', '/api/klets/start', '/api/klets/gesprek']) {
    assert.equal((await api(pad, { aan: true, vriend: a.key, id: 'x' }, gast)).status, 403, pad + ': gasten niet');
    assert.equal((await api(pad, { aan: true }, null)).status, 401, pad + ': zonder sessie niet');
  }
  const zet = await api('/api/klets/zet', { aan: true }, a.token);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.aan, true);
  assert.equal((await api('/api/klets', {}, a.token)).body.aan, true, 'de schakelaar is bewaard');

  const nogNiet = await api('/api/klets/start', { vriend: b.key }, a.token);
  assert.equal(nogNiet.status, 403, 'de ander heeft het nog niet aan');
  assert.match(nogNiet.body.error, /niet\) aan staan|nog\) niet aan/);

  await api('/api/klets/zet', { aan: true }, derde.token);
  assert.equal((await api('/api/klets/start', { vriend: derde.key }, a.token)).status, 403, 'geen vrienden, geen gesprek');
  assert.equal((await api('/api/klets/start', { vriend: a.key }, a.token)).status, 400, 'niet met jezelf');
});

test('het gesprek is van hen tweeen: beiden lezen het, ieder vanuit de eigen kant, een derde niet', async () => {
  await api('/api/klets/zet', { aan: true }, a.token);
  await api('/api/klets/zet', { aan: true }, b.token);
  const g = await api('/api/klets/start', { vriend: b.key }, a.token);
  assert.equal(g.status, 200, JSON.stringify(g.body).slice(0, 200));
  assert.equal(g.body.echt, false, 'zonder model geen echt gesprek');
  assert.ok(g.body.beurten.length > 0, 'er staan beurten in');
  assert.match(g.body.noot, /verzonnen/);

  const bijB = await api('/api/klets/gesprek', { id: g.body.id }, b.token);
  assert.equal(bijB.status, 200);
  assert.equal(bijB.body.beurten.length, g.body.beurten.length, 'hetzelfde gesprek');
  for (let i = 0; i < bijB.body.beurten.length; i++) {
    assert.equal(bijB.body.beurten[i].mij, !g.body.beurten[i].mij, 'wie "mij" is hangt af van wie kijkt');
  }
  assert.equal((await api('/api/klets/gesprek', { id: g.body.id }, derde.token)).status, 404, 'een derde vindt het niet');

  // uitzetten sluit de deur voor een volgend gesprek
  assert.equal((await api('/api/klets/zet', { aan: false }, b.token)).body.aan, false);
  assert.equal((await api('/api/klets/start', { vriend: a.key }, b.token)).status, 403, 'wie uit staat, start niets');
});
