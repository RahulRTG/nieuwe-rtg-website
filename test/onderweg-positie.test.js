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

test('4. stoppen wist de positie (NAVIGATIE.md N14)', async () => {
  /* ZAKT OP: `delete L.lat; delete L.lng` uit /api/live/stop halen -- dan bleef
     de laatste positie zeven dagen staan tot de bewaarveger kwam. */
  await api('live/start', { destCode: 'PONTO', mode: 'walking', lat: 38.92, lng: 1.44 }, lid);
  const stop = await api('live/stop', {}, lid);
  assert.equal(stop.status, 200);
  assert.equal(stop.body.live.active, false);
  assert.equal(stop.body.live.me, null, 'de taak is voorbij, dus de positie ook');
  const later = await api('live/state', {}, lid);
  assert.equal(later.body.live.me, null, 'ook bij het teruglezen');
});

/* AANKOMST WORDT BEVESTIGD, NIET GEMETEN (NAVIGATIE.md N3 en N13). */
const zaakToken = async (code) => {
  const roster = await fetch(base + '/api/supplier/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }) }).then(r => r.json());
  const man = roster.staff.find(x => x.role === 'manager');
  const r = await fetch(base + '/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, staffId: man.id, pin: '1234' }) }).then(r => r.json());
  return r.token;
};

test('5. op de stoep staan is een VOORSTEL: nabij, geen aankomst, en de deur blijft dicht', async () => {
  /* ZAKT OP: de oude automatische aankomst binnen 150 m in /api/live/update. */
  const start = await api('live/start', { destCode: 'PONTO', mode: 'walking' }, lid);
  const dest = start.body.live.partners.find(p => p.code === 'PONTO');
  const upd = await api('live/update', { lat: dest.loc.lat, lng: dest.loc.lng }, lid);
  assert.equal(upd.status, 200);
  assert.equal(upd.body.live.arrived, false, 'een positie bewijst geen aankomst');
  assert.equal(upd.body.live.nabij, true, 'maar het scherm mag vragen of je er bent');
  const deur = await api('live/door', {}, lid);
  assert.notEqual(deur.status, 200, 'en geen deur gaat open op een positie');
  await api('live/stop', {}, lid);
});

test('6. het lid bevestigt zelf -- ook zonder gedeelde positie', async () => {
  await api('live/start', { destCode: 'PONTO', mode: 'walking' }, lid);
  const hier = await api('live/aangekomen', {}, lid);
  assert.equal(hier.status, 200);
  assert.equal(hier.body.live.arrived, true);
  assert.equal(hier.body.live.aankomstDoor, 'lid');
  assert.equal(hier.body.live.me, null, 'er was geen positie, en die is ook niet nodig');
  /* EEN TWEEDE BEVESTIGING DOET NIETS (het contract PROTECTED): niet nog eens de
     tijd, niet een andere bevestiger, en dus ook geen tweede bericht aan de zaak. */
  const nogeens = await api('live/aangekomen', {}, lid);
  assert.equal(nogeens.status, 200);
  assert.equal(nogeens.body.live.aankomstAt, hier.body.live.aankomstAt, 'de aankomsttijd staat vast');
  const ponto = await zaakToken('PONTO');
  const g = (((await api('supplier/state', {}, ponto)).body.state || {}).guests || []).find(x => x.heading);
  const zaak = await api('supplier/guest/aangekomen', { codename: g.codename }, ponto);
  assert.equal(zaak.status, 200);
  const na = await api('live/state', {}, lid);
  assert.equal(na.body.live.aankomstDoor, 'lid', 'wie het eerst bevestigde, blijft de bevestiger');
  assert.equal(na.body.live.aankomstAt, hier.body.live.aankomstAt);
  await api('live/stop', {}, lid);
});

test('7. de bestemming bevestigt; een andere zaak kan dat niet', async () => {
  await api('live/start', { destCode: 'PONTO', mode: 'walking' }, lid);
  const state = await api('live/state', {}, lid);
  assert.equal(state.body.live.arrived, false);
  const ponto = await zaakToken('PONTO');
  const stand = await api('supplier/state', {}, ponto);
  const g = ((stand.body.state || {}).guests || []).find(x => x.heading) || null;
  assert.ok(g && g.codename, 'de zaak ziet de gast die naar haar onderweg is');
  const naam = g.codename;
  const ander = await zaakToken('KIKUNOI');
  const nee = await api('supplier/guest/aangekomen', { codename: naam }, ander);
  assert.equal(nee.status, 404, 'een zaak die niet de bestemming is, bevestigt niets');
  const ja = await api('supplier/guest/aangekomen', { codename: naam }, ponto);
  assert.equal(ja.status, 200, JSON.stringify(ja.body).slice(0, 200));
  const na = await api('live/state', {}, lid);
  assert.equal(na.body.live.arrived, true);
  assert.equal(na.body.live.aankomstDoor, 'zaak');
  await api('live/stop', {}, lid);
});

test('8. de stormjourney bewijst nabijheid, menselijke bevestiging en blijvende aankomst', async () => {
  const journey = require('../scripts/verhalen').VERHALEN.find(v => v.id === 'onderweg-en-aankomen');
  const stappen = [];
  const wb = {
    async stap(naam, method, route, token, body) {
      assert.equal(method, 'POST');
      const r = await api(route.slice('/api/'.length), body, token);
      assert.equal(r.status, 200, naam + ': ' + JSON.stringify(r.body));
      stappen.push(route);
      return { data: r.body };
    },
    eis(naam, waar, reden) { assert.ok(waar, naam + ': ' + reden); }
  };
  await journey.doe(wb, { ploeg: { gast: { token: lid } }, supCode: 'PONTO' });
  assert.equal(stappen.filter(p => p === '/api/live/aangekomen').length, 2, 'bevestiging en retry zijn werkelijk uitgevoerd');
  assert.ok(stappen.includes('/api/live/state'), 'de opgeslagen aankomst is teruggelezen');
  const resultaat = await api('live/state', {}, lid);
  assert.equal(resultaat.body.live.arrived, true);
  assert.equal(resultaat.body.live.aankomstDoor, 'lid');
  await api('live/stop', {}, lid);
});
