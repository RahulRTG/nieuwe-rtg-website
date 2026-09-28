/* EEN SLEUTEL PER ZAAKDOOS, GEBONDEN AAN ZIJN ZAAK (devices.zaakdoos_sleutel, B12).
   Uitgeven doet een mens op naam (de eigenaar of een manager van DE zaak); met
   een eigen sleutel zijn doos en zaak bewezen, niet opgegeven; scope per familie,
   rotatie en intrekken; een manager raakt alleen zijn eigen zaak; de gedeelde
   sleutel telt buiten productie nog als zelfopgave. Het register zonder server:
   test/doossleutels-register.test.js. Draai los: node --test test/doossleutels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');
const { FAMILIES, MAX_DAGEN } = require('../server/kern/zaakdoos/sleutels');

const CODE = 'DOOS-KANTOOR';
const GEDEELD = 'gedeelde-doos-sleutel-voor-de-toets';
const VORM = /^ZD\.[0-9A-F]{32}$/;
const mappen = [];
let MEDE = null; // een medewerker met boardroomtoegang die NIET de eigenaar is
let srv, gedeeld, eig;
function api(pad, body, token, koppen) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, koppen || {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const eigen = (doos, sleutel) => ({ 'x-doos-id': doos, 'x-doos-eigen-sleutel': sleutel });
const meet = (naam, koppen) => api('/api/doos/meting', { doos: naam, rtt: 12, modus: 'cloud' }, null, koppen);
const opBord = async (naam) => ((await api('/api/office/wereld', {}, eig)).body.items || []).find(i => i.soort === 'doos' && i.naam === naam);
const kloon = (koppen, q) => fetch(srv.base + '/api/doos/kloon' + (q || ''), { headers: koppen })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doossleutel-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE, RTG_DOOS_SLEUTEL: GEDEELD } });
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  eig = await kantoorAlsPersoon(srv.base, CODE);
  assert.ok(gedeeld && eig);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

let A = null; // de sleutel van doos-a bij KIKUNOI

test('1. uitgeven: de eigenaar, met een zaak, 128 bits, een keer getoond', async () => {
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-a', zaak: 'KIKUNOI' }, gedeeld)).status, 403, 'gedeelde code');
  const reg = (await api('/api/auth/register', { name: 'Doos Toets', email: 'doos' + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  await api('/api/auth/me', {}, reg.token);
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, reg.token), reg.token)).status, 200);
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: reg.state.user.codename }, eig)).status, 200);
  MEDE = (await api('/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
  assert.equal((await api('/api/office/doos/sleutels', {}, MEDE)).status, 200, 'hij komt de boardroom in');
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-a', zaak: 'KIKUNOI' }, MEDE)).status, 403, 'maar geeft geen doossleutel');
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-a' }, eig)).status, 400, 'zonder zaak geen sleutel');
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-a', zaak: 'BESTAATNIET' }, eig)).status, 400);
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-a', zaak: 'KIKUNOI', dagen: MAX_DAGEN + 1 }, eig)).status, 400,
    'max ' + MAX_DAGEN + ' dagen');
  const r = await fetch(srv.base + '/api/office/doos/sleutel', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + eig }, body: JSON.stringify({ doos: 'doos-a', zaak: 'kikunoi' }) });
  const b = await r.json();
  assert.equal(r.status, 200, JSON.stringify(b));
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(b.sleutel, VORM);
  assert.equal(b.zaak, 'KIKUNOI');
  assert.deepEqual(b.scope, FAMILIES.slice());
  const dagen = (Date.parse(b.expires_at) - Date.now()) / 86400000;
  assert.ok(dagen > 179 && dagen <= 180, 'standaard 180 dagen, niet ' + dagen);
  A = b.sleutel;
  const o = await api('/api/office/doos/sleutels', {}, eig);
  assert.ok(!JSON.stringify(o.body).includes(A.slice(3)), 'het overzicht draagt de sleutel niet');
  assert.ok(!/code_hash|[0-9a-f]{64}/.test(JSON.stringify(o.body)), 'en geen hash');
});

test('2. doos en zaak bewezen, niet opgegeven', async () => {
  assert.equal((await meet('iemand-anders', eigen('doos-a', A))).status, 200);
  const a = await opBord('doos-a');
  assert.ok(a, 'onder de BEWEZEN naam');
  assert.equal(a.bewezen, true);
  assert.equal(await opBord('iemand-anders'), undefined);
  // het rapport: de doos meldt alleen over zichzelf en haar zaak
  const rap = { doos: 'doos-van-hoshi', datum: '2026-09-27', pings: 3 };
  assert.equal((await api('/api/doos/rapport', rap, null, eigen('doos-a', A))).status, 200);
  assert.equal((await api('/api/doos/rapport', Object.assign({ zaak: 'HOSHI' }, rap), null, eigen('doos-a', A))).status, 403,
    'niet voor HOSHI');
  assert.equal((await meet('doos-a', eigen('doos-a', 'ZD.' + '0'.repeat(32)))).status, 403, 'verkeerde sleutel');
  assert.equal((await meet('doos-a', eigen('doos-b', A))).status, 403, 'een sleutel hoort bij een doos');
});

test('3. de kloon: de positieve lijst, de zaak van de sleutel', async () => {
  const { KLOON, ZAAK_VELDEN } = require('../server/kern/zaakdoos/kloon');
  const k = await kloon(eigen('doos-a', A));
  assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 200));
  assert.equal(k.body.zaak, 'KIKUNOI');
  assert.deepEqual(Object.keys(k.body.data).sort(), Object.keys(KLOON).sort(), 'precies de collecties uit de lijst');
  assert.deepEqual(k.body.data.suppliers.map(s => s.code), ['KIKUNOI'], 'geen andere zaak');
  for (const v of Object.keys(k.body.data.suppliers[0])) assert.ok(ZAAK_VELDEN.includes(v), 'veld buiten de lijst: ' + v);
  const plat = JSON.stringify(k.body);
  assert.ok(!plat.includes('HOSHI') && !plat.includes('SAKURA'), 'geen spoor van een andere zaak');
  assert.equal((await kloon(eigen('doos-a', A), '?zaak=HOSHI')).status, 403, 'een andere zaak vragen wordt geweigerd');
  assert.equal((await kloon(eigen('doos-a', A), '?zaak=kikunoi')).status, 200, 'de eigen zaak noemen mag');
  assert.equal((await kloon({})).status, 403, 'zonder sleutel niets');
});

test('4. scope per familie, rotatie en intrekken', async () => {
  const m = await api('/api/office/doos/sleutel', { doos: 'doos-m', zaak: 'KIKUNOI', scope: ['meting'], dagen: 30 }, eig);
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.equal((await meet('doos-m', eigen('doos-m', m.body.sleutel))).status, 200);
  const ks = await kloon(eigen('doos-m', m.body.sleutel));
  assert.equal(ks.status, 403);
  assert.equal(ks.body.code, 'doos-sleutel-scope-ontbreekt', 'de doos hoort waarom');
  assert.equal((await api('/api/doos/rapport', {}, null, eigen('doos-m', m.body.sleutel))).status, 403);
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-m', zaak: 'KIKUNOI', scope: ['alles'] }, eig)).status, 400);

  // roteren: de oude sleutel is meteen niets meer waard
  const IK = { 'Idempotency-Key': 'doos-a-rot-1' };
  const r0 = await api('/api/office/doos/sleutel', { doos: 'doos-a', zaak: 'KIKUNOI' }, eig, IK);
  const r = await api('/api/office/doos/sleutel', { doos: 'doos-a', zaak: 'KIKUNOI' }, eig, IK);
  assert.deepEqual([r0.body.rotatie, r.body.rotatie], [2, 3], 'geen antwoordcache');
  assert.notEqual(r.body.sleutel, r0.body.sleutel);
  for (const oud of [A, r0.body.sleutel]) assert.equal((await meet('doos-a', eigen('doos-a', oud))).status, 403, 'oud opent niets');
  assert.equal((await meet('doos-a', eigen('doos-a', r.body.sleutel))).status, 200);
  A = r.body.sleutel;

  // intrekken
  assert.equal((await api('/api/office/doos/sleutel/weg', { doos: 'doos-m' }, eig)).body.ingetrokken, true);
  const na = await meet('doos-m', eigen('doos-m', m.body.sleutel));
  assert.equal(na.status, 403);
  assert.equal(na.body.code, 'doos-sleutel-ingetrokken');
  assert.equal((await api('/api/office/doos/sleutel/weg', { doos: 'doos-m' }, eig)).body.ingetrokken, false, 'twee keer is een keer');
});

test('5. de manager: alleen zijn eigen zaak, en alleen op naam', async () => {
  // een doos van een ANDERE zaak, uitgegeven door het kantoor
  const b = await api('/api/office/doos/sleutel', { doos: 'doos-b', zaak: 'HOSHI' }, eig);
  assert.equal(b.status, 200);
  const zaak = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.equal((await api('/api/supplier/doos/sleutel', { doos: 'doos-k' }, zaak)).status, 403, 'geen naam');
  // een manager met een eigen account, langs de gewone weg
  const stamp = Date.now(), login = 'doosbaas' + stamp + '@e.test';
  await api('/api/auth/register', { name: 'Doos Baas', email: login, phone: '06' + String(stamp).slice(-8),
    password: 'geheim123', geboortedatum: '1985-01-01', tier: 'rtg' });
  const inv = await api('/api/supplier/staff/invite', { name: 'Doos Baas', role: 'manager', func: 'Directie' }, zaak);
  assert.equal(inv.status, 200, JSON.stringify(inv.body).slice(0, 200));
  const join = await api('/api/supplier/staff/join', { bedrijf: inv.body.bedrijf, kassacode: inv.body.invite.kassacode, login, password: 'geheim123' });
  assert.equal(join.status, 200, JSON.stringify(join.body).slice(0, 200));
  const baas = (await api('/api/supplier/mijn/login', { login, password: 'geheim123' })).body.token;
  assert.ok(baas, 'manager ingelogd');

  const k = await api('/api/supplier/doos/sleutel', { doos: 'doos-k', zaak: 'HOSHI' }, baas);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  assert.equal(k.body.zaak, 'KIKUNOI', 'zaak uit de sessie');
  assert.match(k.body.sleutel, VORM);
  assert.equal((await kloon(eigen('doos-k', k.body.sleutel))).body.zaak, 'KIKUNOI');

  assert.equal((await api('/api/supplier/doos/sleutel/weg', { doos: 'doos-b' }, baas)).status, 404, 'andere zaak: 404');
  assert.equal((await api('/api/supplier/doos/sleutel', { doos: 'doos-b' }, baas)).status, 409, 'niet overnemen');
  assert.equal((await meet('doos-b', eigen('doos-b', b.body.sleutel))).status, 200, 'HOSHI werkt door');
  const lijst = await api('/api/supplier/doos/sleutels', {}, baas);
  assert.deepEqual(lijst.body.dozen.map(d => d.doos).sort(), ['doos-a', 'doos-k', 'doos-m'], 'alleen de eigen dozen');
  assert.ok(!/code_hash|ZD\./.test(JSON.stringify(lijst.body)));
  assert.equal((await api('/api/supplier/doos/sleutel/weg', { doos: 'doos-k' }, baas)).body.ingetrokken, true);
  assert.equal((await meet('doos-k', eigen('doos-k', k.body.sleutel))).status, 403);
});

test('6. de schaduw: de gedeelde sleutel buiten productie', async () => {
  assert.equal((await meet('doos-g', { 'x-doos-sleutel': GEDEELD })).status, 200);
  assert.equal((await opBord('doos-g')).bewezen, false);
  const o = await api('/api/office/doos/sleutels', {}, eig);
  assert.ok(o.body.wegen.eigen >= 3 && o.body.wegen.gedeeld >= 1, JSON.stringify(o.body.wegen));
  assert.deepEqual(o.body.nogGedeeld.map(d => d.doos), ['doos-g']);
});

test('7. de schakelaar van de gedeelde sleutel', async () => {
  assert.equal((await api('/api/office/doos/gedeeld/zet', { dicht: true }, gedeeld)).status, 403, 'de gedeelde code zet hem niet');
  assert.equal((await api('/api/office/doos/gedeeld/zet', { dicht: false }, MEDE)).status, 403, 'boardroomtoegang is niet de eigenaar');
  const r = await api('/api/office/doos/gedeeld/zet', { dicht: true }, eig);
  assert.equal(r.status, 409, 'doos-g meldde in toets 6 met de gedeelde sleutel: ' + JSON.stringify(r.body));
  assert.ok(r.body.nogGedeeld.includes('doos-g'));
  assert.equal((await api('/api/office/doos/gedeeld/zet', { dicht: false }, eig)).status, 200, 'openzetten kan altijd');
});
