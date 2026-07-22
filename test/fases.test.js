/* Uitrolfases: de gefaseerde uitrol als voorinstelling. Alles is gebouwd;
   lanceren is een fase kiezen in plaats van tientallen schakelaars omzetten.
   Draai los: node --experimental-sqlite --test test/fases.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fases-'));
let srv, base, office, lid;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  office = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Faselid', email: 'fa' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(office && lid, 'backoffice en lid ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de fases staan op het bord, met naam en omvang', async () => {
  const b = await api('/api/office/boardroom', {}, office);
  const ids = (b.body.fases || []).map(f => f.id);
  assert.deepEqual(ids, ['fundament', 'stad', 'alles'], 'drie stapelende fases');
  assert.ok(b.body.fases[0].aantalAan < b.body.fases[1].aantalAan, 'de stad is ruimer dan het fundament');
});

test('2. fase 1 (de wig): bestellen en betalen open, de rest dicht', async () => {
  const zet = await api('/api/office/boardroom/fase', { fase: 'fundament' }, office);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.uit > zet.body.aan, 'het merendeel van de kast gaat dicht');
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 503, 'Theater is dicht in de wig');
  assert.equal((await api('/api/vonk/selectie', {}, lid)).status, 503, 'Vonk ook');
  assert.equal((await api('/api/pay/overzicht', {}, lid)).status, 200, 'maar betalen werkt');
  const apps = await api('/api/member/apps', {}, lid);
  assert.ok(apps.body.uit.includes('theater'), 'de leden-app hoort welke apps hij moet verbergen');
});

test('3. fase 2 en 3: de stad opent vervoer, alles opent alles', async () => {
  await api('/api/office/boardroom/fase', { fase: 'stad' }, office);
  assert.equal((await api('/api/ov/kaart', { lat: 38.9, lng: 1.43 }, lid)).status, 200, 'OV is open in de stad');
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 503, 'Theater nog niet');
  await api('/api/office/boardroom/fase', { fase: 'alles' }, office);
  assert.equal((await api('/api/theater/zaal', {}, lid)).status, 200, 'alles open: ook Theater');
  assert.equal((await api('/api/office/boardroom/fase', { fase: 'bestaatniet' }, office)).status, 404, 'onbekende fase weigert netjes');
});
