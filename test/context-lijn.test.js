/* De dagcontext (tijd, seizoen, temperatuur voor elke AI) en de
   lijnbezetting (aanmelden per kant; de schermen en de coach rekenen met
   het aantal aangemelde koks).
   Draai: node --experimental-sqlite --test test/context-lijn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const { dagContext } = require('../server/kern/context');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ctx-'));
let child, kokToken, kok2Token, kokId, kok2Id;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test('dagcontext: seizoen, dagdeel en temperatuur kloppen met de kalender', () => {
  const zomer = dagContext(new Date('2026-07-20T20:00:00'));
  assert.equal(zomer.seizoen, 'zomer');
  assert.equal(zomer.dagdeel, 'avond');
  assert.ok(zomer.temperatuurC >= 20, 'een zomeravond is warm: ' + zomer.temperatuurC);
  const winter = dagContext(new Date('2026-01-12T09:00:00'));
  assert.equal(winter.seizoen, 'winter');
  assert.equal(winter.dagdeel, 'ochtend');
  assert.ok(winter.temperatuurC < zomer.temperatuurC, 'de winter is kouder dan de zomer');
  assert.ok(zomer.zin.includes('zomer') && zomer.zinEn.includes('summer'), 'de promptzinnen noemen het seizoen');
  // een warme avond stuwt de drukte-factor, een gure dag drukt hem
  assert.ok(zomer.factor >= 1, 'warm weer betekent meer drukte');
  assert.ok(winter.factor <= 1, 'koud weer betekent minder drukte');
});

test('dagcontext: RTG_TEMPERATUUR overschrijft het temperatuurbeeld (hittegolf)', () => {
  process.env.RTG_TEMPERATUUR = '38';
  const heet = dagContext(new Date('2026-04-01T14:00:00'));
  assert.equal(heet.temperatuurC, 38);
  assert.equal(heet.factor, 1.15);
  delete process.env.RTG_TEMPERATUUR;
});

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const staf = roster.staff.filter(x => x.role !== 'manager');
  kokId = staf[0].id; kok2Id = (staf[1] || roster.staff.find(x => x.role === 'manager')).id;
  kokToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: kokId, pin: '5678' }))).token;
  const pin2 = (staf[1] ? '5678' : '1234');
  kok2Token = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: kok2Id, pin: pin2 }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('spoedbon: een enkel gerecht komt als gewone bon op de lijn en telt gewoon mee', async () => {
  // de bediening zet 2x gazpacho met spoed op de lijn voor tafel T1
  const z = await json(await api('/api/supplier/order/spoed', { itemId: 'm1', qty: 2, table: 'T1' }, kokToken));
  assert.ok(z.order.ref.startsWith('SP'));
  assert.equal(z.order.items[0].qty, 2);
  assert.equal(z.order.status, 'nieuw');                     // een gewone bon, geen apart kanaal
  assert.ok(z.order.intern && z.order.spoed, 'als spoedbon herkenbaar, maar verder gewoon');
  // elk scherm ziet hem als bon tussen de bonnen
  const st = await json(await api('/api/supplier/state', {}, kokToken));
  const bon = st.state.orders.find(o => o.ref === z.order.ref);
  assert.ok(bon, 'de spoedbon staat tussen de gewone bonnen');
  assert.equal(bon.table, 'T1');
  // de kant meldt hem klaar via de gewone weg
  const klaar = await json(await api('/api/supplier/order/sectie', { ref: z.order.ref, sectie: 'koud', phase: 'klaar' }, kokToken));
  assert.equal(klaar.order.stations.keuken, 'klaar');
  // intrekken kan alleen zolang hij niet klaar is
  assert.equal((await api('/api/supplier/order/spoed', { ref: z.order.ref, op: false }, kokToken)).status, 409);
  // een tweede spoedbon intrekken werkt wel
  const z2 = await json(await api('/api/supplier/order/spoed', { itemId: 'm1' }, kokToken));
  const weg = await json(await api('/api/supplier/order/spoed', { ref: z2.order.ref, op: false }, kokToken));
  assert.equal(weg.order.status, 'geweigerd');
  // een onbekend gerecht wordt geweigerd
  assert.equal((await api('/api/supplier/order/spoed', { itemId: 'bestaat-niet' }, kokToken)).status, 404);
});

test('lijnbezetting: aanmelden, verkassen en afmelden per kant', async () => {
  // kok 1 meldt zich aan op warm; kok 2 ook: twee koks op de kant
  const a1 = await json(await api('/api/supplier/lijn', { sectie: 'warm' }, kokToken));
  assert.equal(a1.aangemeld, true);
  const a2 = await json(await api('/api/supplier/lijn', { sectie: 'warm' }, kok2Token));
  assert.equal(a2.lijn.warm.length, 2);
  // de bezetting staat in de state, dus elk scherm rekent ermee
  const st = await json(await api('/api/supplier/state', {}, kokToken));
  assert.equal(st.state.lijn.warm.length, 2);
  // kok 1 verkast naar koud: automatisch weg bij warm (een kok staat op een kant)
  const v = await json(await api('/api/supplier/lijn', { sectie: 'koud' }, kokToken));
  assert.equal(v.lijn.warm.length, 1);
  assert.equal(v.lijn.koud.length, 1);
  // nog een keer tikken op koud is afmelden
  const af = await json(await api('/api/supplier/lijn', { sectie: 'koud' }, kokToken));
  assert.equal(af.aangemeld, false);
  assert.equal(af.lijn.koud.length, 0);
  // een onbekende kant wordt geweigerd
  assert.equal((await api('/api/supplier/lijn', { sectie: 'zolder' }, kokToken)).status, 400);
});
