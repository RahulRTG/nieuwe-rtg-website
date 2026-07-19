/* RTG Hardwarelab: het eigen hardware-ontwerpbureau van de kantoren
   (apparaten, schermen, sensoren, edge & servers, accessoires). Een AI
   tekent het concept uit (behuizing, chip, materialen, gedempt palet,
   poorten, verhaal), levert een stuklijst en de blik van de chef-engineer,
   en per serie een productblad.
   Draai los: node --experimental-sqlite --test test/hardware.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hardware-'));
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het lab staat klaar met vijf disciplines en gezaaide concepten', async () => {
  const r = await api('/api/office/hardware', {}, office);
  assert.equal(r.status, 200);
  for (const id of ['apparaat', 'scherm', 'sensor', 'edge', 'accessoire']) {
    assert.ok(r.body.disciplines.some(x => x.id === id), id + ' is een discipline');
  }
  assert.ok(r.body.ontwerpen.length >= 2, 'er staan al concepten in het lab');
  assert.equal((await api('/api/office/hardware', {}, null)).status, 401);
});

test('2. een concept maken; de AI tekent het uit met chip, palet en verhaal', async () => {
  const mk = await api('/api/office/hardware/maak', { discipline: 'apparaat', naam: 'RTG PDA Pro', brief: 'Compacte PDA, robuust, RTG-passlezer, lange batterij', huis: 'RTG Hardwarelab' }, office);
  assert.equal(mk.status, 200);
  const oid = mk.body.ontwerp.id;
  assert.equal(mk.body.ontwerp.discipline, 'apparaat');
  const con = await api('/api/office/hardware/concept', { id: oid }, office);
  assert.equal(con.status, 200);
  const c = con.body.ontwerp.concept;
  assert.ok(c && c.behuizing && c.chip, 'behuizing en chip');
  assert.ok(Array.isArray(c.kleuren) && c.kleuren.length >= 2, 'een palet van tinten');
  assert.ok(c.kleuren.every(k => /^#[0-9a-fA-F]{6}$/.test(k.hex)), 'elke tint heeft een geldige hex');
  assert.ok(c.verhaal.length > 30, 'en een verhaal bij het concept');
});

test('3. de stuklijst: onderdelen met spec, verbruik, afmetingen en controle', async () => {
  const mk = await api('/api/office/hardware/maak', { discipline: 'edge', naam: 'Zaakdoos Pro' }, office);
  const oid = mk.body.ontwerp.id;
  await api('/api/office/hardware/concept', { id: oid }, office);
  const sp = await api('/api/office/hardware/stuklijst', { id: oid }, office);
  assert.equal(sp.status, 200);
  const p = sp.body.ontwerp.stuklijst;
  assert.ok(Array.isArray(p.onderdelen) && p.onderdelen.length >= 4, 'er zijn onderdelen');
  assert.ok(p.onderdelen.every(m => m.naam && m.spec), 'elk onderdeel heeft een spec');
  assert.ok(p.verbruik && p.afmetingen, 'met verbruik en afmetingen');
  assert.ok(Array.isArray(p.controle) && p.controle.length, 'en een controlelijst');
});

test('4. de chef-engineer geeft kritiek', async () => {
  const r = await api('/api/office/hardware', {}, office);
  const oid = r.body.ontwerpen[0].id;
  const k = await api('/api/office/hardware/kritiek', { id: oid, q: 'Waar kan dit scherper?' }, office);
  assert.equal(k.status, 200);
  assert.ok(k.body.kritiek && k.body.kritiek.length > 20, 'er is een leesbare kritiek');
});

test('5. status doorschakelen, serie aanmaken en het lab is een kantoorafdeling', async () => {
  const mk = await api('/api/office/hardware/maak', { discipline: 'sensor', naam: 'RTG SenseTag' }, office);
  const oid = mk.body.ontwerp.id;
  assert.equal((await api('/api/office/hardware/zet', { id: oid, status: 'maquette' }, office)).body.ontwerp.status, 'maquette');
  assert.equal((await api('/api/office/hardware/zet', { id: oid, status: 'onzin' }, office)).body.ontwerp.status, 'maquette', 'onbekende status verandert niets');
  const col = await api('/api/office/hardware/serie', { naam: 'RTG One', seizoen: 'Gen 1' }, office);
  assert.equal(col.status, 200);
  // het lab hoort als afdeling bij het kantoor
  const kamers = await api('/api/office/kamers', {}, office);
  assert.ok(kamers.body.kamers.some(k => k.id === 'hardware'), 'het Hardwarelab is een kantoorafdeling');
});

test('6. productblad per serie: toegewezen concepten komen samen in een blad', async () => {
  await api('/api/office/hardware/serie', { naam: 'RTG Edge', seizoen: 'Gen 1' }, office);
  const mk = await api('/api/office/hardware/maak', { discipline: 'edge', naam: 'Edge Kubus' }, office);
  const oid = mk.body.ontwerp.id;
  await api('/api/office/hardware/concept', { id: oid }, office);
  const zet = await api('/api/office/hardware/zet', { id: oid, collectie: 'RTG Edge' }, office);
  assert.equal(zet.body.ontwerp.collectie, 'RTG Edge');
  const pb = await api('/api/office/hardware/productblad', { naam: 'RTG Edge' }, office);
  assert.equal(pb.status, 200);
  assert.equal(pb.body.serie.naam, 'RTG Edge');
  assert.ok(pb.body.ontwerpen.some(o => o.id === oid), 'het toegewezen concept staat in het productblad');
  assert.ok(pb.body.ontwerpen.every(o => o.collectie === 'RTG Edge'), 'het productblad bevat alleen concepten van deze serie');
  assert.ok(pb.body.disciplines.length >= 1, 'de betrokken disciplines staan erbij');
  assert.equal((await api('/api/office/hardware/productblad', { naam: 'Bestaat Niet' }, office)).status, 404);
  assert.equal((await api('/api/office/hardware/productblad', { naam: 'RTG Edge' }, null)).status, 401);
});
