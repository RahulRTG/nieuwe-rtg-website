/* EEN SLEUTEL PER ZAAKDOOS (AUTHORITY.md fase 7, in de schaduw).

   Vijf dingen die niet mogen sneuvelen:
   1. alleen de eigenaar geeft een doossleutel; de gedeelde code niet, en ook
      niet wie boardroomtoegang kreeg;
   2. met een eigen sleutel is de naam van de doos BEWEZEN: hij komt uit het
      register en een andere naam in het verzoek verandert daar niets aan;
   3. met de gedeelde sleutel blijft het werken (schaduw), maar de naam heet dan
      onbewezen -- het wereldbord laat het verschil zien;
   4. een ingetrokken of verkeerde eigen sleutel is niets waard;
   5. elke geldige aanroep telt mee onder de weg waarlangs hij kwam, en de
      sleutel zelf staat niet in de opslag.

   Draai los: node --test test/doossleutels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');
const { maakDoosSleutels } = require('../server/kern/zaakdoos/sleutels');
const { doosKoppen } = require('../server/kern/zaakdoos/koppen');

const CODE = 'DOOS-KANTOOR';
const GEDEELD = 'gedeelde-doos-sleutel-voor-de-toets';
const mappen = [];
let MEDE = null; // een medewerker met boardroomtoegang die NIET de eigenaar is (toets 1)
let srv, gedeeld, eig;
function api(pad, body, token, koppen) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, koppen || {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const meet = (naam, koppen) => api('/api/doos/meting', { doos: naam, rtt: 12, modus: 'cloud' }, null, koppen);
const opBord = async (naam) => ((await api('/api/office/wereld', {}, gedeeld)).body.items || []).find(i => i.soort === 'doos' && i.naam === naam);

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

test('1-4. uitgeven, bewezen naam, schaduw en intrekken', async () => {
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-a' }, gedeeld)).status, 403, 'de gedeelde code geeft geen doossleutel');
  // ook wie boardroomtoegang KREEG, is de eigenaar niet
  const reg = (await api('/api/auth/register', { name: 'Doos Toets', email: 'doos' + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  await api('/api/auth/me', {}, reg.token);
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, reg.token), reg.token)).status, 200);
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: reg.state.user.codename }, eig)).status, 200);
  const mede = MEDE = (await api('/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
  assert.equal((await api('/api/office/doos/sleutels', {}, mede)).status, 200, 'hij komt de boardroom in');
  assert.equal((await api('/api/office/doos/sleutel', { doos: 'doos-a' }, mede)).status, 403, 'maar geeft geen doossleutel');
  const r = await api('/api/office/doos/sleutel', { doos: 'doos-a' }, eig);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.sleutel, /^[0-9a-f]{48}$/);
  const eigen = { 'x-doos-id': 'doos-a', 'x-doos-eigen-sleutel': r.body.sleutel };

  assert.equal((await meet('iemand-anders', eigen)).status, 200);
  const a = await opBord('doos-a');
  assert.ok(a, 'de meting staat onder de BEWEZEN naam, niet onder wat het verzoek zei');
  assert.equal(a.bewezen, true);
  assert.equal(await opBord('iemand-anders'), undefined, 'de naam in het verzoek telt niet bij een eigen sleutel');

  assert.equal((await meet('doos-b', { 'x-doos-sleutel': GEDEELD })).status, 200, 'de gedeelde sleutel werkt nog (schaduw)');
  assert.equal((await opBord('doos-b')).bewezen, false, 'maar die naam is een zelfopgave');

  assert.equal((await meet('doos-a', { 'x-doos-id': 'doos-a', 'x-doos-eigen-sleutel': '0'.repeat(48) })).status, 403,
    'een verkeerde eigen sleutel zonder gedeelde sleutel komt er niet in');
  assert.equal((await api('/api/office/doos/sleutel/weg', { doos: 'doos-a' }, eig)).body.ingetrokken, true);
  assert.equal((await meet('doos-a', eigen)).status, 403, 'een ingetrokken sleutel is niets meer waard');

  const o = await api('/api/office/doos/sleutels', {}, eig);
  assert.equal(o.status, 200);
  assert.equal(o.body.wegen.eigen, 1);
  assert.equal(o.body.wegen.gedeeld, 1);
  assert.ok(!/hash|[0-9a-f]{48}/.test(JSON.stringify(o.body)), 'het overzicht draagt geen sleutel en geen hash');
  /* Welke dozen melden nog met de gedeelde sleutel: dat bepaalt wanneer die dicht
     kan (besluit van 23 september 2026). doos-a meldde alleen met een eigen sleutel. */
  assert.deepEqual(o.body.nogGedeeld.map(d => [d.doos, d.aantal, d.heeftEigen]), [['doos-b', 1, false]]);
});

test('6. de lijst dozen op de gedeelde sleutel: zelfopgave, zeven dagen, en begrensd', () => {
  let t = Date.parse('2026-09-23T09:00:00Z');
  const db = { data: {} };
  const s = maakDoosSleutels({ db, save: () => {}, crypto, nu: () => t });
  s.geef('doos-x');
  s.telWeg('gedeeld', 'Doos-X');
  s.telWeg('gedeeld', 'doos-x');
  s.telWeg('gedeeld', '../etc');
  s.telWeg('eigen', 'doos-y');
  let o = s.overzicht();
  assert.deepEqual(o.nogGedeeld.map(d => [d.doos, d.aantal, d.heeftEigen]),
    [['(geen geldige naam)', 1, false], ['doos-x', 2, true]], 'een eigen sleutel die nog niet op de doos staat, valt op');
  assert.match(o.nogGedeeldUitleg, /zelfopgave/);
  t += 8 * 86400000;
  assert.deepEqual(s.overzicht().nogGedeeld, [], 'na zeven dagen stilte staat hij niet meer op de lijst');
  t += 30 * 86400000;
  s.telWeg('gedeeld', 'doos-z');
  assert.deepEqual(Object.keys(db.data.doosGedeeldGezien), ['doos-z'], 'wat dertig dagen niet is gezien, valt uit de opslag');
  for (let i = 0; i < 250; i++) s.telWeg('gedeeld', 'verzonnen-' + i);
  assert.equal(Object.keys(db.data.doosGedeeldGezien).length, 200, 'wie de gedeelde sleutel heeft, laat de lijst niet groeien');
});

test('5. de sleutel staat niet in de opslag, en de koppen gaan mee als de doos er een heeft', () => {
  const db = { data: {} };
  const s = maakDoosSleutels({ db, save: () => {}, crypto });
  const r = s.geef('Doos-X');
  assert.equal(r.doos, 'doos-x');
  assert.ok(!JSON.stringify(db.data).includes(r.sleutel), 'alleen een hash in de opslag');
  assert.equal(s.welke('doos-x', r.sleutel), 'doos-x');
  assert.equal(s.welke('doos-y', r.sleutel), null, 'een sleutel hoort bij een doos');
  assert.equal(s.geef('../etc').status, 400);
  // een tweede sleutel voor dezelfde doos maakt de eerste ongeldig
  const tweede = s.geef('doos-x');
  assert.equal(s.welke('doos-x', r.sleutel), null, 'de oude sleutel is niets meer waard');
  assert.equal(s.welke('doos-x', tweede.sleutel), 'doos-x');
  // twee keer intrekken is hetzelfde als een keer
  assert.equal(s.trekIn('doos-x').ingetrokken, true);
  const na = JSON.stringify(db.data);
  assert.equal(s.trekIn('doos-x').ingetrokken, false);
  assert.equal(JSON.stringify(db.data), na, 'de tweede intrekking verandert niets');
  r.sleutel = tweede.sleutel;

  const oud = { id: process.env.RTG_DOOS_ID, s: process.env.RTG_DOOS_EIGEN_SLEUTEL };
  delete process.env.RTG_DOOS_ID; delete process.env.RTG_DOOS_EIGEN_SLEUTEL;
  assert.deepEqual(doosKoppen({ a: 1 }, 'g'), { a: 1, 'x-doos-sleutel': 'g' }, 'zonder eigen sleutel verandert er niets');
  process.env.RTG_DOOS_ID = 'doos-x'; process.env.RTG_DOOS_EIGEN_SLEUTEL = r.sleutel;
  assert.deepEqual(doosKoppen({}, 'g'), { 'x-doos-sleutel': 'g', 'x-doos-id': 'doos-x', 'x-doos-eigen-sleutel': r.sleutel });
  if (oud.id) process.env.RTG_DOOS_ID = oud.id; else delete process.env.RTG_DOOS_ID;
  if (oud.s) process.env.RTG_DOOS_EIGEN_SLEUTEL = oud.s; else delete process.env.RTG_DOOS_EIGEN_SLEUTEL;
});

/* 7. DE GEDEELDE SLEUTEL DICHT (besluit van 23 september 2026: pas als elke doos
   er een heeft). Dichtzetten weigert zolang er nog een doos met de gedeelde
   sleutel meldt, met de namen erbij; is hij dicht, dan komt een GOEDE gedeelde
   sleutel niet meer binnen -- en een eigen sleutel wel. */
test('7a. dichtzetten wacht tot geen doos meer de gedeelde sleutel gebruikt', () => {
  let t = Date.parse('2026-09-24T09:00:00Z');
  const db = { data: {} };
  const s = maakDoosSleutels({ db, save: () => {}, crypto, nu: () => t });
  assert.equal(s.gedeeld().dicht, false, 'standaard open');
  s.telWeg('gedeeld', 'doos-oud');
  const te = s.gedeeldZet({ dicht: true, wie: 'eigenaar' });
  assert.equal(te.status, 409, JSON.stringify(te));
  assert.deepEqual(te.nogGedeeld, ['doos-oud'], 'de weigering noemt de doos');
  assert.equal(s.gedeeldZet({ dicht: 'ja' }).status, 400);
  t += 8 * 86400000;
  const ok = s.gedeeldZet({ dicht: true, wie: 'eigenaar' });
  assert.equal(ok.dicht, true, JSON.stringify(ok));
  assert.equal(s.overzicht().gedeeldeSleutel.dicht, true);
  assert.match(s.overzicht().uitleg, /is dicht/);
  assert.equal(s.gedeeldZet({ dicht: false, wie: 'eigenaar' }).dicht, false, 'weer open kan altijd');
});

test('7b. dicht: de goede gedeelde sleutel komt niet binnen, een eigen sleutel wel', () => {
  const vorig = process.env.RTG_DOOS_SLEUTEL;
  process.env.RTG_DOOS_SLEUTEL = GEDEELD;
  try {
    const db = { data: {} };
    const s = require('../server/kern/zaakdoos/sleutels').doosSleutelsVan({ db, save: () => {}, crypto });
    const eigenSleutel = s.geef('doos-q').sleutel;
    const wacht = require('../server/routes/doos-wacht')({ db, save: () => {}, crypto, beveilig: null, noteerAfketser: () => {} });
    const roep = (koppen) => {
      const uit = { status: 200, body: null };
      const res = { status(c) { uit.status = c; return this; }, json(b) { uit.body = b; return this; } };
      const req = { ip: '10.0.0.' + Math.floor(Math.random() * 200), body: {}, get: (k) => koppen[k] };
      return { door: wacht(req, res), uit, req };
    };
    assert.equal(roep({ 'x-doos-sleutel': GEDEELD, 'x-doos-id': 'doos-q' }).door, true, 'open: de gedeelde sleutel werkt');
    db.data.doosGedeeldGezien = {};
    assert.equal(s.gedeeldZet({ dicht: true, wie: 'eigenaar' }).dicht, true);
    const g = roep({ 'x-doos-sleutel': GEDEELD, 'x-doos-id': 'doos-q' });
    assert.equal(g.door, false);
    assert.equal(g.uit.status, 403);
    assert.match(g.uit.body.error, /eigen sleutel nodig/, 'de doos hoort waarom');
    assert.deepEqual(s.overzicht().nogGedeeld.map(d => d.doos), ['doos-q'], 'en blijft zichtbaar als doos die nog om moet');
    const e = roep({ 'x-doos-id': 'doos-q', 'x-doos-eigen-sleutel': eigenSleutel });
    assert.equal(e.door, true, 'een eigen sleutel komt gewoon binnen');
    assert.equal(e.req.doosBewezen, 'doos-q');
  } finally {
    if (vorig === undefined) delete process.env.RTG_DOOS_SLEUTEL; else process.env.RTG_DOOS_SLEUTEL = vorig;
  }
});

test('7c. de schakelaar is van de eigenaar, en dicht weigert zolang een doos nog meldt', async () => {
  const code = await api('/api/office/doos/gedeeld/zet', { dicht: true }, gedeeld);
  assert.equal(code.status, 403, 'de gedeelde code zet hem niet');
  const mede = await api('/api/office/doos/gedeeld/zet', { dicht: false }, MEDE);
  assert.equal(mede.status, 403, 'wie de boardroom in mag, is de eigenaar nog niet: ' + JSON.stringify(mede.body));
  const r = await api('/api/office/doos/gedeeld/zet', { dicht: true }, eig);
  assert.equal(r.status, 409, 'doos-b meldde in toets 1 met de gedeelde sleutel: ' + JSON.stringify(r.body));
  assert.ok(r.body.nogGedeeld.includes('doos-b'));
  assert.equal((await api('/api/office/doos/sleutels', {}, eig)).body.gedeeldeSleutel.dicht, false, 'hij staat nog open');
  assert.equal((await api('/api/office/doos/gedeeld/zet', { dicht: false }, eig)).status, 200, 'openzetten kan altijd');
});
