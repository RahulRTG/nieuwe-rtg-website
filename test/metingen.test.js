/* De dagmetingen (kern/metingen.js): slaap, beweging en water, zelf ingevuld.
   Wat hier bewezen wordt: een dag heeft EEN waarde en geen stapel, het beeld
   zegt over hoeveel dagen het gaat (een gemiddelde over een enkele nacht is
   geen weekbeeld), een herkomst die er niet is wordt geweigerd, en een lid ziet
   alleen zijn eigen dagen.
   Draai los: node --experimental-sqlite --test test/metingen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { beeldVan, ONDERWERPEN, VENSTER } = require('../server/kern/metingen');
const { magHerkomst, BESCHIKBAAR } = require('../server/kern/herkomst');

let srv, base, lid, lid2;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-metingen-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  assert.ok(lid && lid2);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---- de herkomst, want die is nu gedeeld met de doelenmotor ---- */

test('de herkomst staat op een plek, en wat er niet is wordt geweigerd', () => {
  assert.ok(magHerkomst('zelf'));
  assert.ok(magHerkomst('apparaat'), 'sinds er toestellen zijn, is dit een echte herkomst');
  assert.ok(!magHerkomst('horoscoop'));
  assert.ok(!BESCHIKBAAR.includes('behandelaar'),
    'wat niet gebouwd is, staat niet als beschikbaar: er is geen deur waardoor een behandelaar iets vastlegt');
});

/* ---- het beeld, puur ---- */

test('het beeld zegt over hoeveel dagen het gaat, en telt buiten het venster niet mee', () => {
  const nu = new Date('2026-08-09T12:00:00Z');
  const rijen = [
    { op: '2026-08-01', waarde: 99, bron: 'zelf' },   // buiten het venster van 7 dagen
    { op: '2026-08-08', waarde: 6, bron: 'zelf' },
    { op: '2026-08-09', waarde: 8, bron: 'zelf' }
  ];
  const b = beeldVan(rijen, 'slaap', nu);
  assert.equal(b.gemeten, true);
  assert.equal(b.dagen, 2, 'de oude nacht telt niet mee');
  assert.equal(b.gemiddelde, 7, 'en dus ook niet in het gemiddelde');
  assert.equal(b.vandaag, 8);
  assert.equal(VENSTER, 7);

  const leeg = beeldVan([], 'slaap', nu);
  assert.equal(leeg.gemeten, false);
  assert.equal(leeg.dagen, 0);
  assert.equal(leeg.gemiddelde, undefined, 'zonder invulling is er geen gemiddelde, ook geen 0');
});

/* ---- de route-kant ---- */

test('een dag heeft een waarde: twee keer invullen overschrijft, en stapelt niet', async () => {
  const eerst = await api('metingen/zet', { onderwerp: 'slaap', waarde: 6 }, lid);
  assert.equal(eerst.status, 200);
  assert.equal(eerst.body.beeld.dagen, 1);
  assert.equal(eerst.body.beeld.gemiddelde, 6);

  const gecorrigeerd = await api('metingen/zet', { onderwerp: 'slaap', waarde: 8 }, lid);
  assert.equal(gecorrigeerd.body.beeld.dagen, 1, 'een correctie is geen tweede nacht');
  assert.equal(gecorrigeerd.body.beeld.gemiddelde, 8, 'en het gemiddelde is de correctie, niet het gemiddelde van beide');
});

test('een gemiddelde over meer dagen klopt, en het aantal dagen gaat mee', async () => {
  await api('metingen/zet', { onderwerp: 'slaap', waarde: 6, op: overDagen(-1) }, lid);
  await api('metingen/zet', { onderwerp: 'slaap', waarde: 7, op: overDagen(-2) }, lid);
  const b = (await api('metingen', {}, lid)).body.beeld.slaap;
  assert.equal(b.dagen, 3, 'drie nachten');
  assert.equal(b.gemiddelde, 7, '(8 + 6 + 7) / 3');
  assert.equal(b.vandaag, 8, 'en vandaag staat er apart bij');
});

test('onmogelijke invoer wordt geweigerd in plaats van bewaard', async () => {
  assert.equal((await api('metingen/zet', { onderwerp: 'dromen', waarde: 3 }, lid)).status, 404);
  assert.equal((await api('metingen/zet', { onderwerp: 'slaap', waarde: 30 }, lid)).status, 400,
    'dertig uur slaap past niet in een nacht');
  assert.equal((await api('metingen/zet', { onderwerp: 'slaap', waarde: -2 }, lid)).status, 400);
  assert.equal((await api('metingen/zet', { onderwerp: 'slaap', waarde: 'veel' }, lid)).status, 400);
  assert.equal((await api('metingen/zet', { onderwerp: 'slaap', waarde: 7, op: overDagen(1) }, lid)).status, 400,
    'een nacht die nog moet komen valt niet in te vullen');
  const b = (await api('metingen', {}, lid)).body.beeld.slaap;
  assert.equal(b.dagen, 3, 'na vijf mislukte pogingen staan er nog steeds drie nachten');
  assert.equal(b.vandaag, 8, 'en die van vandaag is niet stilletjes veranderd');
});

test('de herkomst komt uit de deur: zelf invullen blijft zelf, wat je ook meestuurt', async () => {
  /* Dit is de scherpste regel van deze laag. Wie via de eigen-invoerdeur een
     bron meestuurt, krijgt die niet: anders kan een lid zijn schatting als
     apparaatmeting boeken en is het hele onderscheid weg. */
  const r = await api('metingen/zet', { onderwerp: 'water', waarde: 5, bron: 'apparaat' }, lid);
  assert.equal(r.status, 200, 'de meting gaat gewoon door');
  assert.equal(r.body.bron, 'zelf', 'maar hij staat als zelf ingevuld');
  assert.deepEqual(r.body.beeld.herkomsten, ['zelf'], 'en het beeld kent geen apparaat');
});

test('weghalen kan, en raakt alleen die ene dag', async () => {
  const weg = await api('metingen/weg', { onderwerp: 'slaap', op: overDagen(-1) }, lid);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.beeld.dagen, 2);
  assert.equal((await api('metingen/weg', { onderwerp: 'slaap', op: overDagen(-1) }, lid)).status, 404,
    'een dag die er niet is, kan niet nog een keer weg');
});

test('een lid ziet alleen zijn eigen dagen', async () => {
  const b2 = (await api('metingen', {}, lid2)).body.beeld;
  assert.equal(b2.slaap.gemeten, false, 'lid2 vulde niets in en ziet dus niets');
  assert.equal(b2.beweging.gemeten, false);

  await api('metingen/zet', { onderwerp: 'beweging', waarde: 45 }, lid2);
  assert.equal((await api('metingen', {}, lid)).body.beeld.beweging.gemeten, false,
    'wat lid2 invult komt niet bij lid terecht');
});

test('de onderwerpen komen uit een plek, zodat het scherm ze niet hoeft te kennen', async () => {
  const d = (await api('metingen', {}, lid)).body;
  assert.deepEqual(Object.keys(d.onderwerpen).sort(), Object.keys(ONDERWERPEN).sort());
  assert.equal(d.onderwerpen.slaap.eenheid, 'uur');
  assert.ok(d.onderwerpen.water.vraag, 'elk onderwerp draagt zijn eigen vraag voor het scherm');
});
