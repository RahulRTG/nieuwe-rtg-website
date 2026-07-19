/* RTG Ontwerpstudio: het voertuig- en vaartuig-ontwerpbureau van de
   kantoren (automotive, jachten, luchtvaart, helikopters). Een AI tekent
   het concept uit (silhouet, aandrijving, materialen, gedempt palet,
   uitrusting, verhaal), levert een specsheet en de blik van de
   chef-ontwerper.
   Draai los: node --experimental-sqlite --test test/studio.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-studio-'));
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

test('1. de studio staat klaar met vier disciplines en gezaaide concepten', async () => {
  const r = await api('/api/office/studio', {}, office);
  assert.equal(r.status, 200);
  for (const id of ['automotive', 'jacht', 'vliegtuig', 'helikopter']) {
    assert.ok(r.body.disciplines.some(x => x.id === id), id + ' is een discipline');
  }
  assert.ok(r.body.ontwerpen.length >= 2, 'er staan al concepten in de studio');
  assert.equal((await api('/api/office/studio', {}, null)).status, 401);
});

test('2. een concept maken; de AI tekent het uit met aandrijving, palet en verhaal', async () => {
  const mk = await api('/api/office/studio/maak', { discipline: 'jacht', naam: 'Serena 60', brief: 'Superjacht van 60 meter, stille modus, warm en licht interieur', huis: 'RTG Ontwerpstudio' }, office);
  assert.equal(mk.status, 200);
  const oid = mk.body.ontwerp.id;
  assert.equal(mk.body.ontwerp.discipline, 'jacht');
  const con = await api('/api/office/studio/concept', { id: oid }, office);
  assert.equal(con.status, 200);
  const c = con.body.ontwerp.concept;
  assert.ok(c && c.silhouet && c.aandrijving, 'silhouet en aandrijving');
  assert.ok(Array.isArray(c.kleuren) && c.kleuren.length >= 2, 'een palet van tinten');
  assert.ok(c.kleuren.every(k => /^#[0-9a-fA-F]{6}$/.test(k.hex)), 'elke tint heeft een geldige hex');
  assert.ok(c.verhaal.length > 30, 'en een verhaal bij het concept');
});

test('3. de specsheet: modules met spec, prestaties, afmetingen en controle', async () => {
  const mk = await api('/api/office/studio/maak', { discipline: 'automotive', naam: 'Meridiaan Roadster' }, office);
  const oid = mk.body.ontwerp.id;
  await api('/api/office/studio/concept', { id: oid }, office);
  const sp = await api('/api/office/studio/specsheet', { id: oid }, office);
  assert.equal(sp.status, 200);
  const p = sp.body.ontwerp.specsheet;
  assert.ok(Array.isArray(p.modules) && p.modules.length >= 4, 'er zijn modules');
  assert.ok(p.modules.every(m => m.naam && m.spec), 'elke module heeft een spec');
  assert.ok(p.prestaties && p.afmetingen, 'met prestaties en afmetingen');
  assert.ok(Array.isArray(p.controle) && p.controle.length, 'en een controlelijst');
});

test('4. de chef-ontwerper geeft kritiek', async () => {
  const r = await api('/api/office/studio', {}, office);
  const oid = r.body.ontwerpen[0].id;
  const k = await api('/api/office/studio/kritiek', { id: oid, q: 'Waar kan dit scherper?' }, office);
  assert.equal(k.status, 200);
  assert.ok(k.body.kritiek && k.body.kritiek.length > 20, 'er is een leesbare kritiek');
});

test('5. status doorschakelen, programma aanmaken en de studio is een kantoorafdeling', async () => {
  const mk = await api('/api/office/studio/maak', { discipline: 'helikopter', naam: 'Aria VIP Twin' }, office);
  const oid = mk.body.ontwerp.id;
  assert.equal((await api('/api/office/studio/zet', { id: oid, status: 'maquette' }, office)).body.ontwerp.status, 'maquette');
  assert.equal((await api('/api/office/studio/zet', { id: oid, status: 'onzin' }, office)).body.ontwerp.status, 'maquette', 'onbekende status verandert niets');
  const col = await api('/api/office/studio/collectie', { naam: 'Horizon', seizoen: '2027' }, office);
  assert.equal(col.status, 200);
  // de studio hoort als afdeling bij het kantoor
  const kamers = await api('/api/office/kamers', {}, office);
  assert.ok(kamers.body.kamers.some(k => k.id === 'studio'), 'de studio is een kantoorafdeling');
});
