/* De Kassa: een kassa-app voor elke zaak, met een omschakelbare modus per
   sector. De werkgever kiest de modus en beheert het eigen assortiment
   (met prijs per stuk of per kilo); afrekenen loopt door de bestaande
   pos/sale, dus het dagoverzicht doet vanzelf mee.
   Draai: node --experimental-sqlite --test test/kassa-modus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kas-'));
let child, managerToken, stafToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const staf = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  stafToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: staf.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de modus: zes werkvormen, alleen de werkgever schakelt, en de kaart reist mee als sneltoetsen', async () => {
  const eerste = await json(await api('/api/supplier/kassa/instel', {}, stafToken));
  assert.equal(eerste.modi.length, 6);
  assert.deepEqual(eerste.modi.map(m => m.id), ['bakker', 'restaurant', 'discotheek', 'sportkantine', 'personeelskantine', 'groenteboer']);
  assert.ok(eerste.sneltoetsen.some(x => x.bron === 'menukaart'), 'de menukaart van de zaak staat als sneltoetsen op de kassa');
  // personeel schakelt de modus niet, de werkgever wel; onzin bestaat niet
  assert.equal((await api('/api/supplier/kassa/instel', { modus: 'restaurant' }, stafToken)).status, 403);
  assert.equal((await api('/api/supplier/kassa/instel', { modus: 'frituurboot' }, managerToken)).status, 400);
  const rest = await json(await api('/api/supplier/kassa/instel', { modus: 'restaurant' }, managerToken));
  assert.equal(rest.modus, 'restaurant');
  assert.ok(rest.modi.find(m => m.id === 'restaurant').tafels, 'de restaurantmodus kent tafels');
  assert.ok(Array.isArray(rest.tafels) && rest.tafels.length, 'de tafels van de zaak reizen mee');
});

test('het eigen assortiment: de werkgever voegt toe (ook per kilo), personeel niet', async () => {
  assert.equal((await api('/api/supplier/kassa/artikel', { naam: 'Tomaten', prijs: 4, perKg: true }, stafToken)).status, 403);
  assert.equal((await api('/api/supplier/kassa/artikel', { naam: '', prijs: 4 }, managerToken)).status, 400);
  const r = await json(await api('/api/supplier/kassa/artikel', { naam: 'Tomaten', prijs: 4, perKg: true }, managerToken));
  const tomaat = r.artikelen.find(a => a.naam === 'Tomaten');
  assert.ok(tomaat && tomaat.perKg, 'het weeg-artikel staat erin met prijs per kilo');
  await api('/api/supplier/kassa/instel', { modus: 'groenteboer' }, managerToken);
  const gr = await json(await api('/api/supplier/kassa/instel', {}, stafToken));
  assert.ok(gr.modi.find(m => m.id === 'groenteboer').gewicht, 'de groenteboermodus rekent met gewicht');
});

test('de weegverkoop: 0,75 kg tomaten a EUR 4/kg rekent EUR 3,00 af op de gewone kassastroom', async () => {
  const sale = await json(await api('/api/supplier/pos/sale', {
    total: 3, method: 'contant', desc: 'De Kassa (Groenteboer & markt)',
    items: [{ name: 'Tomaten 0,75 kg', qty: 1, price: 3 }]
  }, stafToken));
  assert.equal(sale.sale.total, 3);
  assert.ok(sale.sale.bon, 'de bon heeft een bonnummer');
});

test('de personeelskantine: de bon draagt de naam van de collega (interne verrekening)', async () => {
  await api('/api/supplier/kassa/instel', { modus: 'personeelskantine' }, managerToken);
  const sale = await json(await api('/api/supplier/pos/sale', {
    total: 2.5, method: 'contant', desc: 'De Kassa (Personeelskantine) · Mees',
    codenaam: 'Mees', items: [{ name: 'Lunch', qty: 1, price: 2.5 }]
  }, stafToken));
  assert.match(sale.sale.desc, /Mees/, 'de collega staat op de bon');
});
