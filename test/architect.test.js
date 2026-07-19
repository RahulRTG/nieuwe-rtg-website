/* RTG Architectenbureau: het huizen-ontwerpbureau van de kantoren (villa's,
   penthouses, landgoederen, chalets, paviljoens). Een AI tekent het concept
   uit (typologie, constructie, materialen, gedempt palet, voorzieningen,
   verhaal), levert een bouwstaat en de blik van de chef-architect, en per
   project een portfolio.
   Draai los: node --experimental-sqlite --test test/architect.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-architect-'));
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

test('1. het bureau staat klaar met vijf disciplines en gezaaide concepten', async () => {
  const r = await api('/api/office/architect', {}, office);
  assert.equal(r.status, 200);
  for (const id of ['villa', 'penthouse', 'landgoed', 'chalet', 'paviljoen']) {
    assert.ok(r.body.disciplines.some(x => x.id === id), id + ' is een discipline');
  }
  assert.ok(r.body.ontwerpen.length >= 2, 'er staan al concepten in het bureau');
  assert.equal((await api('/api/office/architect', {}, null)).status, 401);
});

test('2. een concept maken; de AI tekent het uit met constructie, palet en verhaal', async () => {
  const mk = await api('/api/office/architect/maak', { discipline: 'penthouse', naam: 'Penthouse Horizon', brief: 'Dubbelhoog penthouse met dakterras, veel licht, warm interieur', huis: 'RTG Architectenbureau' }, office);
  assert.equal(mk.status, 200);
  const oid = mk.body.ontwerp.id;
  assert.equal(mk.body.ontwerp.discipline, 'penthouse');
  const con = await api('/api/office/architect/concept', { id: oid }, office);
  assert.equal(con.status, 200);
  const c = con.body.ontwerp.concept;
  assert.ok(c && c.typologie && c.constructie, 'typologie en constructie');
  assert.ok(Array.isArray(c.kleuren) && c.kleuren.length >= 2, 'een palet van tinten');
  assert.ok(c.kleuren.every(k => /^#[0-9a-fA-F]{6}$/.test(k.hex)), 'elke tint heeft een geldige hex');
  assert.ok(c.verhaal.length > 30, 'en een verhaal bij het concept');
});

test('3. de bouwstaat: delen met spec, oppervlak, kavel en controle', async () => {
  const mk = await api('/api/office/architect/maak', { discipline: 'villa', naam: 'Villa Duin' }, office);
  const oid = mk.body.ontwerp.id;
  await api('/api/office/architect/concept', { id: oid }, office);
  const sp = await api('/api/office/architect/bouwstaat', { id: oid }, office);
  assert.equal(sp.status, 200);
  const p = sp.body.ontwerp.bouwstaat;
  assert.ok(Array.isArray(p.delen) && p.delen.length >= 4, 'er zijn bouwdelen');
  assert.ok(p.delen.every(m => m.naam && m.spec), 'elk deel heeft een spec');
  assert.ok(p.oppervlak && p.kavel, 'met oppervlak en kavel');
  assert.ok(Array.isArray(p.controle) && p.controle.length, 'en een controlelijst');
});

test('4. de chef-architect geeft kritiek', async () => {
  const r = await api('/api/office/architect', {}, office);
  const oid = r.body.ontwerpen[0].id;
  const k = await api('/api/office/architect/kritiek', { id: oid, q: 'Waar kan dit scherper?' }, office);
  assert.equal(k.status, 200);
  assert.ok(k.body.kritiek && k.body.kritiek.length > 20, 'er is een leesbare kritiek');
});

test('5. status doorschakelen, project aanmaken en het bureau is een kantoorafdeling', async () => {
  const mk = await api('/api/office/architect/maak', { discipline: 'chalet', naam: 'Chalet Piste' }, office);
  const oid = mk.body.ontwerp.id;
  assert.equal((await api('/api/office/architect/zet', { id: oid, status: 'maquette' }, office)).body.ontwerp.status, 'maquette');
  assert.equal((await api('/api/office/architect/zet', { id: oid, status: 'onzin' }, office)).body.ontwerp.status, 'maquette', 'onbekende status verandert niets');
  const col = await api('/api/office/architect/project', { naam: 'Kustlijn', seizoen: '2027' }, office);
  assert.equal(col.status, 200);
  const kamers = await api('/api/office/kamers', {}, office);
  assert.ok(kamers.body.kamers.some(k => k.id === 'architect'), 'het bureau is een kantoorafdeling');
});

test('6. portfolio per project: toegewezen concepten komen samen', async () => {
  await api('/api/office/architect/project', { naam: 'Bergdorp', seizoen: '2028' }, office);
  const mk = await api('/api/office/architect/maak', { discipline: 'chalet', naam: 'Chalet Aurora' }, office);
  const oid = mk.body.ontwerp.id;
  await api('/api/office/architect/concept', { id: oid }, office);
  const zet = await api('/api/office/architect/zet', { id: oid, collectie: 'Bergdorp' }, office);
  assert.equal(zet.body.ontwerp.collectie, 'Bergdorp');
  const pf = await api('/api/office/architect/portfolio', { naam: 'Bergdorp' }, office);
  assert.equal(pf.status, 200);
  assert.equal(pf.body.project.naam, 'Bergdorp');
  assert.ok(pf.body.ontwerpen.some(o => o.id === oid), 'het toegewezen concept staat in het portfolio');
  assert.ok(pf.body.ontwerpen.every(o => o.collectie === 'Bergdorp'), 'het portfolio bevat alleen concepten van dit project');
  assert.equal((await api('/api/office/architect/portfolio', { naam: 'Bestaat Niet' }, office)).status, 404);
  assert.equal((await api('/api/office/architect/portfolio', { naam: 'Bergdorp' }, null)).status, 401);
});
