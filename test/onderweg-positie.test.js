/* ONDERWEG VERZINT GEEN POSITIE (NAVIGATIE.md par. 12, gebrek 11).

   Wie Onderweg start zonder een positie mee te sturen, kreeg er een: het hotel
   van de eigen reis, of anders de bestemming plus een vaste verschuiving -- ruim
   een kilometer ernaast. Die punt werd daarna als live-positie van de gast
   gebruikt: in het eigen beeld, voor de afstand en de aankomsttijd, en bij een
   rit voor de zaak. De app zelf stuurde bij het starten nooit een positie mee,
   dus elke start begon zo.

   De regel die hier bewaakt wordt komt uit NAVIGATIE.md (N11): de server mag
   een positie kennen voor een uitdrukkelijke functie, en nooit een positie
   VERZINNEN. Onbekend is onbekend, met de reden erbij.

   Draai los: node --test test/onderweg-positie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onderwegpositie-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  assert.ok(lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. starten zonder positie laat de positie LEEG, met de reden erbij', async () => {
  /* ZAKT OP: de oude regel in routes/member/onderweg.js die zonder positie de
     bestemming plus (0,012; -0,014) invulde, of het hotel van de eigen reis. */
  const start = await api('live/start', { destCode: 'PONTO', mode: 'driving' }, lid);
  assert.equal(start.status, 200, JSON.stringify(start.body).slice(0, 200));
  assert.equal(start.body.live.active, true, 'Onderweg start gewoon, ook zonder positie');
  assert.equal(start.body.live.me, null, 'er is geen positie gedeeld, dus er staat er geen');
  assert.match(String(start.body.live.positie || ''), /niet gedeeld/i,
    'een lege positie draagt haar reden, zodat het scherm kan vragen in plaats van te raden');
  const dest = start.body.live.partners.find(p => p.code === 'PONTO');
  assert.ok(dest, 'de bestemming staat er');
  assert.equal(dest.distance, null, 'zonder positie is er geen afstand -- ook geen verzonnen');
  assert.equal(dest.etaMin, null, 'en geen aankomsttijd');
  await api('live/stop', {}, lid);
});

test('2. een gedeelde positie wordt precies zo overgenomen', async () => {
  const start = await api('live/start', { destCode: 'PONTO', mode: 'driving', lat: 38.99, lng: 1.30 }, lid);
  assert.equal(start.status, 200);
  assert.deepEqual([start.body.live.me.lat, start.body.live.me.lng], [38.99, 1.30]);
  assert.equal(start.body.live.positie, null, 'met een positie is er niets te melden');
  await api('live/stop', {}, lid);
});

test('3. de eerste echte positie komt later binnen en vult de lege aan', async () => {
  await api('live/start', { destCode: 'PONTO', mode: 'walking' }, lid);
  const upd = await api('live/update', { lat: 38.91, lng: 1.43 }, lid);
  assert.equal(upd.status, 200);
  assert.deepEqual([upd.body.live.me.lat, upd.body.live.me.lng], [38.91, 1.43]);
  assert.equal(upd.body.live.positie, null);
  const zonder = await api('live/update', {}, lid);
  assert.equal(zonder.status, 200, 'een update zonder positie is geen fout');
  assert.deepEqual([zonder.body.live.me.lat, zonder.body.live.me.lng], [38.91, 1.43],
    'en verandert de laatst gedeelde positie niet');
  await api('live/stop', {}, lid);
});
