/* Tests voor de live-/geo-laag (server/kern/live.js).
   De functies dragen db + de bus + SSE-routers + geo + i18n; we voeren stubs op
   en gebruiken de echte geo-helpers. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../server/lib/geo');
const { maakLive } = require('../server/kern/live');

const PERSONAS = { rtg: { codename: 'De Reiziger' } };

// Twee partners: een restaurant (bestemming) en een taxi (lopende rit).
function opstelling() {
  const spied = { customer: [], supplier: [], office: 0 };
  const db = { data: {
    live: {}, orders: [], rides: [],
    supplierTypes: { horeca: { label: 'Restaurant', icon: '🍽' }, taxi: { label: 'Taxi', icon: '🚕' } },
    suppliers: [
      { code: 'KIKUNOI', name: 'Kikunoi', type: 'horeca', loc: { lat: 52.37, lng: 4.90, label: 'Amsterdam' }, doors: [] },
      { code: 'RTGCARS', name: 'RTG Cars', type: 'taxi', loc: { lat: 52.30, lng: 4.76 } }
    ]
  } };
  const live = maakLive({
    db, bus: { publish: (_ch, msg) => spied.customer.push(msg) },
    nextSseId: () => 1, PERSONAS,
    sseToSupplier: (code) => spied.supplier.push(code),
    sseToOffice: () => { spied.office++; },
    findSupplier: (code) => db.data.suppliers.find(s => s.code === code) || null,
    haversine: geo.haversine, etaMinutes: geo.etaMinutes,
    i18n: { localize: (v) => v }
  });
  return { db, live, spied };
}

test('liveCodename: account-codenaam wint, anders de persona', () => {
  const { live } = opstelling();
  assert.equal(live.liveCodename({ tier: 'rtg', account: { codename: 'Nova' } }), 'Nova');
  assert.equal(live.liveCodename({ tier: 'rtg' }), 'De Reiziger');
});

test('connectedSupplierCodes: bestemming plus lopende bestelling en rit', () => {
  const { db, live } = opstelling();
  db.data.live.k1 = { active: true, destCode: 'KIKUNOI', lat: 52.36, lng: 4.89 };
  db.data.orders.push({ customerKey: 'k1', supplierCode: 'KIKUNOI', status: 'nieuw' });
  db.data.rides.push({ customerKey: 'k1', supplierCode: 'RTGCARS', status: 'onderweg' });
  db.data.orders.push({ customerKey: 'k1', supplierCode: 'OUD', status: 'geserveerd' }); // afgerond -> niet mee
  const codes = live.connectedSupplierCodes('k1');
  assert.ok(codes.includes('KIKUNOI') && codes.includes('RTGCARS'));
  assert.ok(!codes.includes('OUD'), 'afgeronde order telt niet mee');
});

test('pushLive: signaleert lid (bus), betrokken partners en de backoffice', () => {
  const { db, live, spied } = opstelling();
  db.data.live.k1 = { active: true, destCode: 'KIKUNOI' };
  live.pushLive('k1');
  assert.ok(spied.customer.some(m => m.match === 'k1' && m.data.scope === 'live'), 'lid via bus');
  assert.ok(spied.supplier.includes('KIKUNOI'), 'partner gesignaleerd');
  assert.equal(spied.office, 1, 'backoffice gesignaleerd');
});

test('liveStateFor: afstand, ETA en de bestemming voor het lid', () => {
  const { db, live } = opstelling();
  db.data.live.k1 = { active: true, destCode: 'KIKUNOI', lat: 52.36, lng: 4.89, mode: 'driving', updatedAt: 'nu' };
  db.data.orders.push({ customerKey: 'k1', supplierCode: 'KIKUNOI', status: 'nieuw', ref: 'A1', items: [{ qty: 2 }], total: 40, paid: true });
  const st = live.liveStateFor('k1', 'nl');
  assert.equal(st.active, true);
  assert.equal(st.destCode, 'KIKUNOI');
  const kiku = st.partners.find(p => p.code === 'KIKUNOI');
  assert.ok(kiku.distance > 0, 'afstand berekend');
  assert.equal(typeof kiku.etaMin, 'number');
  assert.equal(kiku.order.items, 2, 'aantal artikelen opgeteld');
  assert.equal(st.dest.code, 'KIKUNOI');
});

test('guestsFor: reizende leden bij een partner, gesorteerd op ETA', () => {
  const { db, live } = opstelling();
  db.data.live.dichtbij = { active: true, destCode: 'KIKUNOI', lat: 52.371, lng: 4.901, mode: 'walking', codename: 'Dichtbij' };
  db.data.live.verweg = { active: true, destCode: 'KIKUNOI', lat: 52.10, lng: 4.50, mode: 'driving', codename: 'Verweg' };
  db.data.live.inactief = { active: false, destCode: 'KIKUNOI', lat: 52.37, lng: 4.90, codename: 'Slaapt' };
  const gasten = live.guestsFor('KIKUNOI');
  assert.deepEqual(gasten.map(g => g.codename), ['Dichtbij', 'Verweg'], 'inactief valt weg, dichtstbij eerst');
  assert.ok(gasten[0].heading, 'op weg naar deze partner');
});
