/* HET BANKSALDO VAN RTG -- server/kern/bankpositie.js (besluit C4), tegen een
   echte server, want dit zijn twee nieuwe routes.

   VIJF BEWERINGEN, en ze kunnen alle vijf zakken:
   1. zonder ingevoerd saldo staat er geen getal, maar een reden;
   2. een saldo zonder bron, of met een afschriftdag buiten de maand, komt er niet in;
   3. een saldo is `vermoed`, en de plek voor RTG-bonnen staat op nul MET reden;
   4. wie het zette komt uit de sessie, niet uit het verzoek, en een correctie
      laat de vorige stand zien;
   5. de bedrijfsmaat cash.rtg-bankpositie leest hetzelfde saldo.

   Draai: node --test test/bankpositie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const CODE = 'BANKPOSITIE-KANTOOR';
let srv, eig, gedeeld;
const mappen = [];
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bankpositie-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eig && gedeeld);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
});

test('1. zonder saldo geen getal, wel een reden -- en de deur is de boardroom', async () => {
  assert.equal((await api('/api/office/bankpositie', {})).status, 401);
  assert.equal((await api('/api/office/bankpositie/zet', { maand: '2026-08' }, gedeeld)).status, 403);
  const r = await api('/api/office/bankpositie', { maand: '2026-08' }, eig);
  assert.equal(r.status, 200);
  assert.equal(r.body.saldo, null);
  assert.equal(r.body.vrij, null);
  assert.equal(r.body.graad, 'onbekend');
  assert.match(r.body.reden, /geen getal waar er geen is/);
});

test('2. geen saldo zonder bron, en de afschriftdag hoort in de maand', async () => {
  const zonder = await api('/api/office/bankpositie/zet', { maand: '2026-08', centen: 100, peildatum: '2026-08-31' }, eig);
  assert.equal(zonder.status, 400);
  const buiten = await api('/api/office/bankpositie/zet', { maand: '2026-08', centen: 100, peildatum: '2026-09-01', bron: 'afschrift 12' }, eig);
  assert.equal(buiten.status, 400);
  const halve = await api('/api/office/bankpositie/zet', { maand: '2026-08', centen: 10.5, peildatum: '2026-08-31', bron: 'afschrift 12' }, eig);
  assert.equal(halve.status, 400, 'een saldo is een heel aantal centen');
});

test('3 en 4. een saldo is vermoed, bonnen staan op nul met reden, en wie het zette komt uit de sessie', async () => {
  const r = await api('/api/office/bankpositie/zet', { maand: '2026-08', centen: 1234500, peildatum: '2026-08-31',
    bron: 'afschrift zakelijke rekening, 31 augustus', wie: 'iemand anders' }, eig);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const s = r.body.stand;
  assert.equal(s.graad, 'vermoed');
  assert.equal(s.saldo.centen, 1234500);
  assert.notEqual(s.saldo.gezetDoor, 'iemand anders', 'de naam komt uit de sessie, niet uit het verzoek');
  assert.equal(s.bonnenVerplichting.centen, 0);
  assert.match(s.bonnenVerplichting.reden, /geen eigen cadeaubon/, 'de reden komt uit het register van de bon (C14)');
  assert.equal(s.vrij.centen, 1234500);
  const c = await api('/api/office/bankpositie/zet', { maand: '2026-08', centen: 1200000, peildatum: '2026-08-31',
    bron: 'gecorrigeerd afschrift' }, eig);
  assert.equal(c.body.stand.saldo.vorige.centen, 1234500, 'een correctie laat de vorige stand zien');
  /* Een gelijke tweede oproep vangt de platformlaag al (zelfdeVerzoek); het verschil
     dat telt is dat de vorige stand daarna nog die van VOOR de correctie is. */
  const nog = await api('/api/office/bankpositie/zet', { maand: '2026-08', centen: 1200000, peildatum: '2026-08-31',
    bron: 'gecorrigeerd afschrift' }, eig);
  assert.equal(nog.body.stand.saldo.vorige.centen, 1234500, 'een dubbelklik wist de echte vorige stand niet');
});

test('5. de bedrijfsmaat leest hetzelfde saldo', async () => {
  const b = (await api('/api/office/bedrijfsmaat', { maand: '2026-08' }, eig)).body;
  const m = (b.maten || []).find(x => x.id === 'cash.rtg-bankpositie');
  assert.ok(m, 'de maat staat niet in de stand');
  assert.equal(m.stand, 'TOONBAAR');
  assert.equal(m.waarde, 1200000);
  assert.equal(m.graad, 'vermoed');
});

/* De kern moet het ook zelf weten, buiten het venster van de platformlaag om:
   hetzelfde saldo van hetzelfde afschrift raakt de vorige stand niet. */
test('4b. de kern: hetzelfde saldo nog eens verandert niets, ook de vorige stand niet', () => {
  const db = { data: {} };
  const k = require('../server/kern/bankpositie')({ db, save: () => {}, nu: () => '2026-09-27T10:00:00Z' });
  const z = { maand: '2026-08', peildatum: '2026-08-31', wie: 'user-1' };
  k.bankpositieZet(Object.assign({ centen: 500, bron: 'afschrift 1' }, z));
  k.bankpositieZet(Object.assign({ centen: 700, bron: 'afschrift 2' }, z));
  const nog = k.bankpositieZet(Object.assign({ centen: 700, bron: 'afschrift 2' }, z));
  assert.equal(nog.ongewijzigd, true);
  assert.equal(nog.stand.saldo.vorige.centen, 500, 'de echte vorige stand blijft staan');
});
