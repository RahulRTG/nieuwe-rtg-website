/* RTG Synergie: zaken maken samen deals en pakketten. Pas als elke
   deelnemer heeft getekend staat het pakket live; RTG Pay splitst elke
   aankoop exact volgens de afgesproken aandelen (de som moet kloppen).
   Draai los: node --experimental-sqlite --test test/synergie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-synergie-'));
let srv, base, kikunoi, sakura, lid, dealId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  kikunoi = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const rooster = await api('/api/supplier/roster', { code: 'SAKURA' });
  const manager = (rooster.body.staff || []).find(s => s.role === 'manager');
  sakura = (await api('/api/supplier/login', { code: 'SAKURA', staffId: manager.id, pin: '1234' })).body.token;
  const reg = await api('/api/auth/register', { name: 'Pakket Lid', email: 'pakket@x.nl', phone: '0644455566',
    password: 'geheim123', geboortedatum: '1987-07-07', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(kikunoi && sakura && lid, 'twee zaken en een lid ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een deal waarvan de aandelen niet optellen wordt eerlijk geweigerd', async () => {
  const r = await api('/api/supplier/synergie/maak', { naam: 'Scheve deal', prijsCenten: 10000,
    aandelen: [{ code: 'KIKUNOI', centen: 6000 }, { code: 'SAKURA', centen: 3000 }] }, kikunoi);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /exact/i);
});

test('2. deal maken: voorstel staat klaar en de partner is nog niet akkoord', async () => {
  const r = await api('/api/supplier/synergie/maak', { naam: 'Avond aan zee',
    omschrijving: 'Overnachting bij Villa Bahia met diner bij Sal de Mar.',
    prijsCenten: 25000, aandelen: [{ code: 'KIKUNOI', centen: 9000 }, { code: 'SAKURA', centen: 16000 }] }, kikunoi);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  dealId = r.body.deal.id;
  assert.equal(r.body.deal.status, 'voorstel');
  assert.equal(r.body.deal.aandelen.find(a => a.code === 'SAKURA').akkoord, false);
  // zolang niet iedereen tekende, is er geen pakket voor leden
  const p = await api('/api/pakketten', {}, lid);
  assert.equal((p.body.pakketten || []).length, 0);
});

test('3. de partner tekent: de deal wordt actief en het pakket staat live', async () => {
  const r = await api('/api/supplier/synergie/reageer', { id: dealId, akkoord: true }, sakura);
  assert.equal(r.body.deal.status, 'actief');
  const p = await api('/api/pakketten', {}, lid);
  assert.equal(p.body.pakketten.length, 1);
  assert.equal(p.body.pakketten[0].naam, 'Avond aan zee');
  assert.deepEqual(p.body.pakketten[0].zaken.sort(), ['Sal de Mar', 'Villa Bahia Ibiza']);
});

test('4. kopen splitst de betaling exact volgens de aandelen', async () => {
  await api('/api/pay/oplaad', { centen: 30000, idem: 'syn-op' }, lid);
  const k = await api('/api/pakket/koop', { id: dealId, idem: 'syn-koop-1' }, lid);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  assert.equal(k.body.betaald, 25000);
  // idempotent: dezelfde idem-sleutel boekt niet dubbel
  const k2 = await api('/api/pakket/koop', { id: dealId, idem: 'syn-koop-1' }, lid);
  assert.equal(k2.body.alBetaald, true);
  const o = await api('/api/pay/overzicht', {}, lid);
  assert.equal(o.body.saldo, 5000, 'een keer betaald, exact de pakketprijs');
  const rijen = o.body.geschiedenis.filter(r => r.soort === 'pakket');
  assert.equal(rijen.length, 2, 'twee grootboekregels: een per zaak');
  assert.deepEqual(rijen.map(r => -r.centen).sort((a, b) => a - b), [9000, 16000]);
});

test('5. een gestopte deal verdwijnt uit het ledenaanbod', async () => {
  await api('/api/supplier/synergie/stop', { id: dealId }, sakura);
  const p = await api('/api/pakketten', {}, lid);
  assert.equal(p.body.pakketten.length, 0);
  const k = await api('/api/pakket/koop', { id: dealId, idem: 'syn-koop-2' }, lid);
  assert.equal(k.status, 404);
});

test('6. de deuren: zonder inlog dicht, gasten mogen niet boeken', async () => {
  assert.equal((await api('/api/supplier/synergie', {})).status, 401);
  assert.equal((await api('/api/pakketten', {})).status, 401);
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  const k = await api('/api/pakket/koop', { id: 'x', idem: 'g1' }, gast);
  assert.equal(k.status, 403);
});
