/* RTG Eye: de camerabril van de werkvloer. De visielaag draait op het toestel;
   de server bewaart compacte, gecodeerde regels: nulmetingen en schouwen per
   voertuig, aangeleerde spullen en het knoploze uitgifteregister (richting
   volgt het item: mee -> terug). Draai los:
   node --experimental-sqlite --test test/oog.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, pda, manager;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-oog-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// een schouw-handtekening: 9 zones x [helderheid, randenergie]
const vlak = () => Array.from({ length: 18 }, (x, i) => i % 2 ? 0.1 : 1);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: 'MKKX' });
  const staff = roster.body.staff || [];
  const login = async (wie, pin) => (await api('/api/supplier/login', { code: 'MKKX', staffId: wie.id, pin })).body.token;
  pda = await login(staff.find(x => x.role !== 'manager') || staff[0], '5678');
  manager = await login(staff.find(x => x.role === 'manager') || staff[0], '1234');
  assert.ok(pda && manager);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de startstand: de vloot van de zaak, nog zonder nulmeting', async () => {
  const r = await api('/api/staff/oog', {}, pda);
  assert.equal(r.status, 200);
  assert.ok((r.body.voertuigen || []).some(v => /Mercedes/.test(v.naam)), 'de eigen vloot staat klaar voor de schouw');
  assert.equal(r.body.voertuigen[0].nulmeting, false, 'er is nog geen nulmeting vastgelegd');
});

test('2. schouw: nulmeting vastleggen, daarna een schouw met afwijking als journaalregel', async () => {
  const v = (await api('/api/staff/oog', {}, pda)).body.voertuigen[0];
  const slecht = await api('/api/staff/oog/nulmeting', { voertuigId: v.id, sig: ['x', 'y'] }, pda);
  assert.equal(slecht.status, 400, 'alleen een compacte getallenvector telt als meting (nooit beeld)');
  const nul = await api('/api/staff/oog/nulmeting', { voertuigId: v.id, sig: vlak() }, pda);
  assert.equal(nul.status, 200);
  const terug = await api('/api/staff/oog/nulmeting/van', { voertuigId: v.id }, pda);
  assert.equal(terug.body.nulmeting.sig.length, 18, 'de nulmeting is deelbaar tussen alle PDA\'s van de zaak');

  const zones = [{ zone: 'linksvoor', score: 62, oordeel: 'afwijking' }, { zone: 'midden', score: 4, oordeel: 'schoon' }];
  const s = await api('/api/staff/oog/schouw', { voertuigId: v.id, voertuigNaam: v.naam, zones }, pda);
  assert.equal(s.status, 200);
  assert.equal(s.body.regel.oordeel, 'afwijking');
  assert.equal(s.body.regel.afwijkingen, 1);
  const lijst = await api('/api/staff/oog/schouwen', { voertuigId: v.id }, pda);
  assert.ok(lijst.body.schouwen.some(x => x.id === s.body.regel.id), 'de schouw staat in het register van het voertuig');
});

test('3. de schouw staat als activiteit bij de zaak (de journaallijn)', async () => {
  const r = await api('/api/supplier/oog/overzicht', {}, manager);
  assert.ok((r.body.schouwen || []).length >= 1);
  assert.ok(/afwijking/.test(r.body.schouwen[0].oordeel));
});

test('4. werkvloer: aanleren, en het knoploze register waarvan de richting het item volgt', async () => {
  const leer = await api('/api/staff/oog/leer', { naam: 'Kist gereedschap 2', sig: [0.4, 0.1, 0.5] }, pda);
  assert.equal(leer.status, 200);
  const itemId = leer.body.item.id;
  const onbekend = await api('/api/staff/oog/uitgifte', { itemId: 'nep' }, pda);
  assert.equal(onbekend.status, 404, 'alleen aangeleerde spullen komen in het register');

  const mee = await api('/api/staff/oog/uitgifte', { itemId }, pda);
  assert.equal(mee.body.regel.richting, 'mee', 'de eerste waarneming is meenemen');
  const dubbel = await api('/api/staff/oog/uitgifte', { itemId }, pda);
  assert.equal(dubbel.body.dubbel, true, 'dezelfde waarneming vlak erna telt niet dubbel');

  const buiten = await api('/api/supplier/oog/overzicht', {}, manager);
  assert.ok(buiten.body.nogBuiten.some(x => /Kist gereedschap 2/.test(x.itemNaam)), 'de zaak ziet wat er nog buiten is');

  // een collega toont het item later: het is buiten, dus tonen = terugbrengen
  const terug = await api('/api/staff/oog/uitgifte', { itemId }, manager);
  assert.equal(terug.body.regel.richting, 'terug');
  const daarna = await api('/api/supplier/oog/overzicht', {}, manager);
  assert.ok(!daarna.body.nogBuiten.some(x => /Kist gereedschap 2/.test(x.itemNaam)), 'na terugbrengen is niets meer buiten');
});
