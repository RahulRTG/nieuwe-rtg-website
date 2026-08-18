/* RTF-golf 6 (deel 1): het gevoelsdagboek. Opt-in (de server bewaart alleen
   wat het kind zelf instuurt), prive per profiel (ook dicht voor gasten),
   een woord per dag (vandaag herzien mag, gisteren blijft staan), en
   nooit een score of streak.
   Draai los: node --test test/rtfwelzijn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-welzijn-'));
let child;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const wz = (actie, body) => fetch(BASE + '/api/rtf/welzijn/' + actie, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let g, kind, ouder, gast;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  const gz = await api('/gezin/maak', { gezinsnaam: 'Fam Gevoel', naam: 'Mam', pin: '1234' });
  g = gz.body;
  ouder = { code: g.code, token: g.token };
  const k = await api('/gezin/profiel/maak', Object.assign({}, ouder, { naam: 'Juno', rol: 'kind', groep: 'kind' }));
  kind = { code: g.code, token: (await api('/gezin/profiel/kies', { code: g.code, profielId: k.body.profiel.id })).body.token };
  const ga = await api('/gezin/profiel/maak', Object.assign({}, ouder, { naam: 'Oppas Bo', rol: 'gast' }));
  gast = { code: g.code, token: (await api('/gezin/profiel/kies', { code: g.code, profielId: ga.body.profiel.id })).body.token };
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. opt-in en een woord per dag: bewaren, herzien, en nooit een cijfer', async () => {
  let d = await wz('dagboek', kind);
  assert.equal(d.body.stemmingen.length, 0, 'zonder eigen keuze bewaart de server niets');
  const r = await wz('stemming', Object.assign({}, kind, { gevoel: 'verdrietig' }));
  assert.equal(r.status, 200);
  assert.equal(r.body.dag.gevoel, 'verdrietig', 'een gevoel is een woord, geen score');
  // vandaag herzien mag: een ochtend en een avond voelen anders
  await wz('stemming', Object.assign({}, kind, { gevoel: 'blij', notitie: 'toch een fijne middag' }));
  d = await wz('dagboek', kind);
  assert.equal(d.body.stemmingen.length, 1, 'een dag heeft hooguit een gevoel');
  assert.equal(d.body.dagVandaag.gevoel, 'blij');
  assert.equal(d.body.dagVandaag.notitie, 'toch een fijne middag');
  // een cijfer of een verzonnen woord komt er niet in
  assert.equal((await wz('stemming', Object.assign({}, kind, { gevoel: 5 }))).status, 400);
  assert.equal((await wz('stemming', Object.assign({}, kind, { gevoel: 'geweldigst' }))).status, 400);
});

test('2. prive per profiel: de ouder heeft zijn EIGEN dagboek en ziet dat van het kind nooit', async () => {
  const d = await wz('dagboek', ouder);
  assert.equal(d.body.stemmingen.length, 0,
    'het dagboek van het kind is onzichtbaar voor de ouder -- er bestaat geen route naartoe');
  await wz('stemming', Object.assign({}, ouder, { gevoel: 'moe' }));
  const dk = await wz('dagboek', kind);
  assert.equal(dk.body.dagVandaag.gevoel, 'blij', 'en andersom lekt er ook niets');
});

test('3. een gast (oppas) heeft hier niets te zoeken', async () => {
  assert.equal((await wz('dagboek', gast)).status, 403);
  assert.equal((await wz('stemming', Object.assign({}, gast, { gevoel: 'blij' }))).status, 403);
});
