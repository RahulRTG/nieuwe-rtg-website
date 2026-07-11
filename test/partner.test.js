/* Integratietests voor de PARTNER-app-flows (de leverancier-kant):
   - personeelslogin met PIN + rate-limiting (bescherming tegen raden)
   - restaurant/keuken (KDS): een order van nieuw naar klaar zetten
   - taxi: een rit slim laten toewijzen en de status vooruit bewegen
   - hotel: kamers toevoegen, housekeeping en beschikbaarheid
   - afscherming: leverancier-endpoints eisen een leverancier-sessie

   Zelfde aanpak als de andere integratietests: een echte server als kindproces
   in een tijdelijke datamap, aangestuurd via global fetch. Geen extra packages.

   Draai los: node --experimental-sqlite --test test/partner.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3700 + Math.floor(Math.random() * 200);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-partner-'));
let child;

function api(pad, body, token) {
  return fetch(BASE + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server startte niet op tijd');
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// Helper: log als lid in en geef het token terug.
async function lidToken(tier) { return (await json(await api('/login', { tier }))).token; }
// Helper: log als leverancier in op naam + persoonlijke pincode (manager, PIN 1234).
async function partnerToken(code) {
  const roster = await json(await api('/supplier/roster', { code }));
  const mgr = roster.staff.find(m => m.role === 'manager') || roster.staff[0];
  return (await json(await api('/supplier/login', { code, staffId: mgr.id, pin: '1234' }))).token;
}

test('personeelslogin: juiste PIN werkt, verkeerde niet, en na 5 pogingen volgt een slot', async () => {
  const roster = await json(await api('/supplier/roster', { code: 'KIKUNOI' }));
  assert.ok(Array.isArray(roster.staff) && roster.staff.length >= 2, 'KIKUNOI heeft personeel');
  const manager = roster.staff.find(m => m.role === 'manager');
  const medewerker = roster.staff.find(m => m.role !== 'manager');
  assert.ok(manager && medewerker, 'een manager en een medewerker in het rooster');

  // Juiste PIN van de manager (1234) geeft een sessie.
  const goed = await api('/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
  assert.equal(goed.status, 200);
  assert.ok((await json(goed)).token, 'juiste PIN geeft een token');

  // Verkeerde PIN op de medewerker: vijf keer 401, daarna een slot (429).
  let laatste;
  for (let i = 0; i < 5; i++) {
    laatste = await api('/supplier/login', { code: 'KIKUNOI', staffId: medewerker.id, pin: '0000' });
    assert.equal(laatste.status, 401, 'foute PIN geeft 401 (poging ' + (i + 1) + ')');
  }
  const naSlot = await api('/supplier/login', { code: 'KIKUNOI', staffId: medewerker.id, pin: '0000' });
  assert.equal(naSlot.status, 429, 'na vijf foute pogingen volgt een wachttijd');
});

test('leverancier-login: iedereen heeft een eigen code; inloggen met alleen de bedrijfscode kan niet', async () => {
  // Alleen de bedrijfscode geeft GEEN toegang meer (geen anonieme "Beheer").
  const alleenCode = await api('/supplier/login', { code: 'KIKUNOI' });
  assert.equal(alleenCode.status, 401, 'inloggen met alleen de code wordt geweigerd');
  // Met naam + persoonlijke pincode wel.
  const roster = await json(await api('/supplier/roster', { code: 'KIKUNOI' }));
  const mgr = roster.staff.find(m => m.role === 'manager');
  const ok = await api('/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' });
  assert.equal(ok.status, 200);
  assert.ok((await json(ok)).token, 'persoonlijke pincode geeft een sessie');
});

test('restaurant/keuken (KDS): een order loopt van nieuw naar klaar', async () => {
  const lid = await lidToken('business');
  const order = (await json(await api('/order', { supplierCode: 'KIKUNOI', items: [{ id: 'm2', qty: 2 }], table: 'Table 3' }, lid))).order;
  assert.ok(order && order.ref, 'order aangemaakt');
  // Betalen zodat de keuken hem als echte order ziet.
  await api('/order/pay', { ref: order.ref }, lid);

  const partner = await partnerToken('KIKUNOI');
  const inBereiding = await api('/supplier/order/status', { ref: order.ref, status: 'in bereiding' }, partner);
  assert.equal(inBereiding.status, 200);
  assert.equal((await json(inBereiding)).order.status, 'in bereiding');

  const klaar = await json(await api('/supplier/order/status', { ref: order.ref, status: 'klaar' }, partner));
  assert.equal(klaar.order.status, 'klaar');

  // Onbekende status wordt geweigerd, en een onbekende ref geeft 404.
  assert.equal((await api('/supplier/order/status', { ref: order.ref, status: 'onzin' }, partner)).status, 400);
  assert.equal((await api('/supplier/order/status', { ref: 'RTG-O-XXXXXX', status: 'klaar' }, partner)).status, 404);

  // Het lid ziet de nieuwe status in zijn eigen overzicht.
  const mijne = await json(await api('/orders/mine', {}, lid));
  const terug = (mijne.orders || []).find(o => o.ref === order.ref);
  assert.ok(terug && terug.status === 'klaar', 'het lid ziet de order als klaar');
});

test('taxi: een betaalde rit wordt toegewezen en beweegt alleen vooruit', async () => {
  const lid = await lidToken('business');
  const ride = (await json(await api('/ride/request', { supplierCode: 'MKKX', from: 'Aguamarina Ibiza', to: 'Sal de Mar', passengers: 2 }, lid))).ride;
  assert.ok(ride && ride.ref, 'rit aangevraagd');
  await api('/ride/pay', { ref: ride.ref }, lid); // na betaling: aangevraagd

  const partner = await partnerToken('MKKX');
  // Slimme suggestie: een vrije chauffeur (en eventueel voertuig).
  const suggestie = await json(await api('/supplier/ride/suggest', { ref: ride.ref }, partner));
  assert.ok(suggestie.staffId, 'er wordt een chauffeur voorgesteld');

  const toegewezen = await api('/supplier/ride/assign', { ref: ride.ref, staffId: suggestie.staffId, vehicleId: suggestie.vehicleId }, partner);
  assert.equal(toegewezen.status, 200);
  const na = (await json(toegewezen)).ride;
  assert.ok(na.driver && na.driver.staffId === suggestie.staffId, 'de chauffeur is toegewezen');
  assert.equal(na.status, 'geaccepteerd', 'toewijzen accepteert de rit');

  // Vooruit mag (onderweg), terug niet (409).
  assert.equal((await api('/supplier/ride/status', { ref: ride.ref, status: 'onderweg' }, partner)).status, 200);
  assert.equal((await api('/supplier/ride/status', { ref: ride.ref, status: 'geaccepteerd' }, partner)).status, 409, 'een rit kan niet terug in de keten');
});

test('hotel: kamer toevoegen, housekeeping en beschikbaarheid', async () => {
  const partner = await partnerToken('HOSHI');
  const toegevoegd = await api('/supplier/room/add', { name: 'Test Suite', price: 640, desc: 'Voor de test' }, partner);
  assert.equal(toegevoegd.status, 200);
  const rooms = (await json(toegevoegd)).rooms;
  const room = rooms.find(r => r.name === 'Test Suite');
  assert.ok(room && room.available, 'nieuwe kamer staat beschikbaar');

  // Defect melden haalt de kamer uit de verkoop.
  const defect = (await json(await api('/supplier/room/hk', { id: room.id, status: 'defect', note: 'lekkage' }, partner))).rooms.find(r => r.id === room.id);
  assert.equal(defect.available, false, 'een defecte kamer is niet boekbaar');
  assert.equal(defect.hk.status, 'defect');

  // Weer schoon zetten herstelt de beschikbaarheid.
  const schoon = (await json(await api('/supplier/room/hk', { id: room.id, status: 'schoon' }, partner))).rooms.find(r => r.id === room.id);
  assert.equal(schoon.available, true, 'na herstel is de kamer weer boekbaar');

  // Handmatig dichtzetten (toggle) werkt ook.
  const dicht = (await json(await api('/supplier/room/toggle', { id: room.id }, partner))).rooms.find(r => r.id === room.id);
  assert.equal(dicht.available, false);
});

test('ledenprijsgarantie: een lid betaalt nooit meer dan de eigen publieke prijs', async () => {
  const partner = await partnerToken('PONTO');
  // De partner probeert een ledenprijs (100) BOVEN de publieke prijs (60) te
  // zetten, en een tweede item met een ledenprijs (40) ONDER de publieke (50).
  const opslaan = await api('/supplier/menu', {
    menu: [
      { id: 'test1', cat: 'Test', name: 'Duur item', price: 100, publiekePrijs: 60, station: 'keuken' },
      { id: 'test2', cat: 'Test', name: 'Voordelig item', price: 40, publiekePrijs: 50, station: 'keuken' }
    ]
  }, partner);
  assert.equal(opslaan.status, 200);
  const menu = (await json(opslaan)).menu;
  const t1 = menu.find(m => m.id === 'test1');
  assert.equal(t1.publiekePrijs, 60);
  assert.equal(t1.price, 60, 'de ledenprijs wordt bij opslaan afgekapt op de publieke prijs');
  const t2 = menu.find(m => m.id === 'test2');
  assert.equal(t2.price, 40, 'een ledenprijs onder de publieke prijs blijft staan');

  // Een lid bestelt het dure item: het betaalt de publieke prijs (60), niet 100.
  const lid = await lidToken('business');
  const order = (await json(await api('/order', { supplierCode: 'PONTO', items: [{ id: 'test1', qty: 2 }] }, lid))).order;
  assert.equal(order.items[0].price, 60, 'het lid wordt de publieke prijs gerekend');
  assert.equal(order.total, 120, 'twee keer 60, niet twee keer 100');
});

test('rechten: alleen een manager kan terugbetalen, de kaart en prijzen wijzigen', async () => {
  // Een niet-manager medewerker (PIN 5678). HOSHI, want KIKUNOI's medewerker is
  // in de rate-limit-test hierboven kort op slot gezet.
  const roster = await json(await api('/supplier/roster', { code: 'HOSHI' }));
  const medew = roster.staff.find(m => m.role !== 'manager');
  const staffTok = (await json(await api('/supplier/login', { code: 'HOSHI', staffId: medew.id, pin: '5678' }))).token;

  // Een medewerker mag NIET terugbetalen, de kaart wijzigen of prijzen doorgeven.
  assert.equal((await api('/supplier/refund', { ref: 'RTG-O-NOPE' }, staffTok)).status, 403, 'medewerker kan niet terugbetalen');
  assert.equal((await api('/supplier/menu', { menu: [] }, staffTok)).status, 403, 'medewerker kan de kaart niet wijzigen');
  assert.equal((await api('/supplier/price', { service: 'X', price: 5 }, staffTok)).status, 403, 'medewerker kan geen prijs doorgeven');

  // Een manager komt WEL langs de rechtencheck (daarna pas body-/refvalidatie:
  // 404 voor een onbekende ref, 400 voor een ontbrekend menu; geen 403).
  const mgr = await partnerToken('HOSHI');
  assert.equal((await api('/supplier/refund', { ref: 'RTG-O-NOPE' }, mgr)).status, 404, 'manager mag terugbetalen (ref bestaat alleen niet)');
  assert.equal((await api('/supplier/menu', {}, mgr)).status, 400, 'manager mag de kaart wijzigen (body ontbreekt hier)');
});

test('afscherming: leverancier-endpoints eisen een leverancier-sessie', async () => {
  // Zonder token.
  assert.equal((await api('/supplier/order/status', { ref: 'x', status: 'klaar' })).status, 401);
  // Met een LID-token (geen leverancier-rol) mag het ook niet.
  const lid = await lidToken('business');
  assert.equal((await api('/supplier/order/status', { ref: 'x', status: 'klaar' }, lid)).status, 401);
});
