/* De gereedschappen die elke zaak krijgt: reageren op reviews (met melding
   aan de gast) en de lichte voorraad met drempelmeldingen.
   Draai: node --experimental-sqlite --test test/zaaktools.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tools-'));
let child, lidToken, managerToken, staffToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  lidToken = (await json(await api('/api/login', { username: 'Rahul', password: 'Imran' }))).token;
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const med = roster.staff.find(x => x.role !== 'manager') || roster.staff[0];
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  staffToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: med.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('reviews: de zaak reageert (een AI-concept staat klaar) en de gast ziet de reactie', async () => {
  // een afgeronde bestelling, dan de review
  const o = (await json(await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: 'm1', qty: 1 }] }, lidToken))).order;
  await api('/api/order/pay', { ref: o.ref }, lidToken);
  await api('/api/supplier/order/status', { ref: o.ref, status: 'geserveerd' }, managerToken);
  await api('/api/review', { soort: 'order', ref: o.ref, score: 2, tekst: 'De soep was koud.' }, lidToken);
  // de zaak ziet de review met id in de eigen state
  const st = await json(await api('/api/supplier/state', {}, managerToken));
  const rev = st.state.reviews.recent.find(r => r.tekst === 'De soep was koud.');
  assert.ok(rev && rev.id, 'de review staat met id in de zaak-state');
  // het AI-concept past de toon aan de lage score aan
  const c = await json(await api('/api/supplier/review/concept', { id: rev.id }, managerToken));
  assert.match(c.concept, /spijt|oplos|goed|sorry/i);
  // reageren, en de reactie is publiek zichtbaar bij de reviews van de partner
  const re = await api('/api/supplier/review/reageer', { id: rev.id, tekst: 'Dat spijt ons; de volgende soep staat dampend voor u klaar.' }, managerToken);
  assert.equal(re.status, 200);
  const pub = await json(await api('/api/reviews', { supplierCode: 'KIKUNOI' }, lidToken));
  const mijn = pub.reviews.find(r => r.tekst === 'De soep was koud.');
  assert.ok(mijn.reactie && /dampend/.test(mijn.reactie.tekst), 'de gast ziet de reactie van de zaak');
  // lege reactie en onbekende review worden geweigerd
  assert.equal((await api('/api/supplier/review/reageer', { id: rev.id, tekst: '  ' }, managerToken)).status, 400);
  assert.equal((await api('/api/supplier/review/reageer', { id: 'nep', tekst: 'x' }, managerToken)).status, 404);
});

test('voorraad: management beheert, iedereen telt, en de drempel meldt een keer', async () => {
  // een medewerker mag geen items aanmaken; het management wel
  assert.equal((await api('/api/supplier/voorraad/zet', { naam: 'Cava brut', aantal: 6, min: 4, eenheid: 'fles' }, staffToken)).status, 403);
  const nieuw = await json(await api('/api/supplier/voorraad/zet', { naam: 'Cava brut', aantal: 6, min: 4, eenheid: 'fles' }, managerToken));
  const id = nieuw.item.id;
  assert.equal(nieuw.item.aantal, 6);
  // de vloer telt af: onder het minimum gaat de melding uit (laagGemeld)
  await api('/api/supplier/voorraad/zet', { id, delta: -1 }, staffToken);
  const laag = await json(await api('/api/supplier/voorraad/zet', { id, delta: -1 }, staffToken));
  assert.equal(laag.item.aantal, 4);
  assert.equal(laag.item.laagGemeld, true, 'onder of op het minimum: melding gewapend');
  // bijvullen wapent de melding opnieuw
  const vol = await json(await api('/api/supplier/voorraad/zet', { id, aantal: 12 }, staffToken));
  assert.equal(vol.item.laagGemeld, false);
  // de voorraad staat in de zaak-state; weg kan alleen het management
  const st = await json(await api('/api/supplier/state', {}, staffToken));
  assert.ok(st.state.voorraad.find(v => v.id === id));
  assert.equal((await api('/api/supplier/voorraad/zet', { id, weg: true }, staffToken)).status, 403);
  assert.equal((await api('/api/supplier/voorraad/zet', { id, weg: true }, managerToken)).status, 200);
});
