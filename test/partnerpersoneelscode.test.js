/* HET PARTNERKANAAL GESPLITST (besluit B14, partnerkanaal.personeels_en_partnercode),
   tegen een echte server. De partnercode is een openbare attributielink die
   niets opent; de personeelscode is een 128-bit credential per medewerker die het
   kantoor op naam uitgeeft, roteert en intrekt, en die bij een boeking atomair een
   gebruik verbruikt. Het register zonder server: test/partnerpersoneelscode-register.test.js.
   Draai los: node --test test/partnerpersoneelscode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const CODE = 'PARTNERKANAAL-KANTOOR';
const VORM = /^PK\.[0-9A-F]{32}$/;
let srv, gedeeld, eig, map;
function api(pad, body, token, koppen) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, koppen || {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, kop: r.headers, body: await r.json().catch(() => ({})) }));
}
const boek = (extra) => api('/api/book', Object.assign({ tripId: 'gstaad-alpien', name: 'Test Reiziger', email: 'reiziger@test.nl' }, extra));
const plekVan = async (id) => (await api('/api/office/partnerkanaal/personeelscodes', { partner: 'ATLAS' }, eig)).body.codes.find(c => c.id === id);

test.before(async () => {
  map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-partnerpersoneel-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map, OFFICE_CODE: CODE } });
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  eig = await kantoorAlsPersoon(srv.base, CODE);
  assert.ok(gedeeld && eig);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
});

test('1. de partnercode is een attributie: geen tarief, geen bedrijfsgegevens, geen personeelsdeur', async () => {
  const p = await api('/api/partner', { code: 'atlas' });
  assert.equal(p.status, 200);
  assert.deepEqual(p.body.partner, { code: 'ATLAS', name: 'Atlas Executive Travel' }, 'alleen de naam voor "via ..."');
  for (const lijf of [{ code: 'ATLAS' }, { code: 'ATLAS', staffCode: 'ATLAS' }]) {
    const reizen = await api('/api/partnertrips', lijf);
    assert.equal(reizen.status, 200);
    assert.ok(reizen.body.trips.length);
    assert.ok(reizen.body.trips.every(t => !('staffPrice' in t)), 'geen personeelstarief op een partnercode: ' + JSON.stringify(lijf));
  }
  assert.equal((await api('/api/staff', { staffCode: 'ATLAS' })).status, 404, 'de partnercode is geen personeelscode');
  const zonder = await boek();
  const met = await boek({ code: 'ATLAS' });
  assert.equal(met.status, 200);
  assert.equal(met.body.partner, 'Atlas Executive Travel', 'de boeking weet wie hem stuurde');
  assert.equal(met.body.total, zonder.body.total, 'en het tarief is hetzelfde');
  assert.equal((await boek({ staffCode: 'ATLAS' })).status, 404, 'als personeelscode opent hij niets');
});

let A = null;
test('2. het kantoor geeft uit op naam: 128 bits, een keer getoond, en het overzicht draagt geen code', async () => {
  assert.equal((await api('/api/office/partnerkanaal/personeelscode', { partner: 'ATLAS' })).status, 401, 'zonder sessie');
  assert.equal((await api('/api/office/partnerkanaal/personeelscode', { partner: 'ATLAS' }, gedeeld)).status, 403, 'de gedeelde kantoorcode');
  assert.equal((await api('/api/office/partnerkanaal/personeelscodes', {}, gedeeld)).status, 403);
  assert.equal((await api('/api/office/partnerkanaal/personeelscode', { partner: 'NOVA' }, eig)).status, 409, 'geen personeelskanaal');
  assert.equal((await api('/api/office/partnerkanaal/personeelscode', { partner: 'NIEMAND' }, eig)).status, 404);
  assert.equal((await api('/api/office/partnerkanaal/personeelscode', { partner: 'ATLAS', dagen: 400 }, eig)).status, 400);
  const IK = { 'Idempotency-Key': 'partnerpersoneel-uitgifte-1' };
  const r = await api('/api/office/partnerkanaal/personeelscode', { partner: 'ATLAS', label: 'balie 1', maxGebruik: 2 }, eig, IK);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.kop.get('cache-control'), 'no-store');
  assert.match(r.body.code, VORM);
  assert.equal(r.body.max_gebruik, 2);
  const tweede = await api('/api/office/partnerkanaal/personeelscode', { partner: 'ATLAS', label: 'balie 1', maxGebruik: 2 }, eig, IK);
  assert.equal(tweede.status, 200);
  assert.notEqual(tweede.body.id, r.body.id, 'een tweede uitgifte met hetzelfde lijf is een tweede plek, geen herhaald antwoord');
  assert.notEqual(tweede.body.code, r.body.code, 'en geen heronthulde code');
  A = r.body;
  const o = await api('/api/office/partnerkanaal/personeelscodes', { partner: 'ATLAS' }, eig);
  assert.equal(o.status, 200);
  assert.equal(o.body.codes.length, 2);
  const tekst = JSON.stringify(o.body);
  assert.ok(!tekst.includes(A.code.slice(3)), 'geen code');
  assert.ok(!/code_hash|[0-9a-f]{64}/.test(tekst), 'geen hash');
});

test('3. de personeelscode opent het tarief en de partner, en een boeking verbruikt precies een gebruik', async () => {
  const s = await api('/api/staff', { staffCode: A.code });
  assert.equal(s.status, 200);
  assert.equal(s.body.partner.code, 'ATLAS');
  assert.ok(!JSON.stringify(s.body).includes(A.code.slice(3)), 'de code gaat niet terug in het antwoord');
  assert.equal(s.body.personeel.resterend, 2);
  const r = await api('/api/partnertrips', { staffCode: A.code.toLowerCase() });
  assert.ok(r.body.trips.length, 'er zijn reizen om te tonen');
  assert.ok(r.body.trips.every(t => Number.isFinite(t.staffPrice)), 'het personeelstarief staat erbij');
  assert.equal((await boek({ staffCode: A.code, email: 'geen-adres' })).status, 400);
  assert.equal((await plekVan(A.id)).gebruik, 0, 'een fout formulier kost geen boeking');
  const b = await boek({ staffCode: A.code });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.partner, 'Atlas Executive Travel');
  assert.equal((await plekVan(A.id)).gebruik, 1);
  assert.equal((await boek({ staffCode: A.code })).status, 200);
  assert.equal((await boek({ staffCode: A.code })).status, 404, 'opgebruikt');
  assert.equal((await api('/api/staff', { staffCode: A.code })).status, 404, 'en dan opent hij ook de partner niet meer');
  assert.equal((await plekVan(A.id)).stand, 'opgebruikt');
});

test('4. roteren trekt de vorige in, intrekken sluit, en een tweede intrekking verandert niets', async () => {
  const r = await api('/api/office/partnerkanaal/personeelscode', { partner: 'ATLAS' }, eig);
  const oud = r.body.code;
  assert.equal((await api('/api/office/partnerkanaal/personeelscode/roteer', { id: r.body.id }, gedeeld)).status, 403);
  const IK = { 'Idempotency-Key': 'partnerpersoneel-rotatie-1' };
  const n0 = await api('/api/office/partnerkanaal/personeelscode/roteer', { id: r.body.id }, eig, IK);
  const n = await api('/api/office/partnerkanaal/personeelscode/roteer', { id: r.body.id }, eig, IK);
  assert.equal(n.status, 200, JSON.stringify(n.body));
  assert.deepEqual([n0.body.rotatie, n.body.rotatie], [2, 3], 'geen antwoordcache: de tweede rotatie is een nieuwe');
  assert.equal((await api('/api/staff', { staffCode: n0.body.code })).status, 404, 'de tussenliggende code opent ook niets');
  assert.equal(n.kop.get('cache-control'), 'no-store');
  assert.match(n.body.code, VORM);
  assert.equal((await api('/api/staff', { staffCode: oud })).status, 404, 'de oude opent niets meer');
  assert.equal((await api('/api/staff', { staffCode: n.body.code })).status, 200);
  assert.equal((await api('/api/office/partnerkanaal/personeelscode/roteer', { id: 'pm_' + '0'.repeat(16) }, eig)).status, 404);
  assert.equal((await api('/api/office/partnerkanaal/personeelscode/intrek', { id: r.body.id }, gedeeld)).status, 403);
  const w = await api('/api/office/partnerkanaal/personeelscode/intrek', { id: r.body.id, reden: 'uit dienst' }, eig);
  assert.equal(w.body.ingetrokken, true);
  assert.equal((await api('/api/staff', { staffCode: n.body.code })).status, 404);
  assert.equal((await boek({ staffCode: n.body.code })).status, 404);
  assert.equal((await api('/api/office/partnerkanaal/personeelscode/intrek', { id: r.body.id }, eig)).body.ingetrokken, false);
});
