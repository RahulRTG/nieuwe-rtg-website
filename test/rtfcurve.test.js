/* RTF-golf 3: de eerlijke vergeetcurve op de overhoorlijsten (Leitner).
   Goed = een bakje omhoog en langer rust, fout = terug naar bakje 1 en
   vandaag nog een keer; de dagstapel loopt over alle lijsten heen en
   andermans lijsten blijven dicht.
   Draai los: node --test test/rtfcurve.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-curve-'));
let child;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const leren = (actie, body) => fetch(BASE + '/api/rtf/leren/' + actie, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const json = r => r.json();
const plus = n => { const d = new Date(Date.now() + n * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

let g, kind, broer, lijstId;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam Curve', naam: 'Mam', pin: '1234' }));
  const k = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Isa', rol: 'kind', groep: 'tiener' }));
  kind = { code: g.code, token: (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: k.profiel.id }))).token };
  const b = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tom', rol: 'kind', groep: 'tiener' }));
  broer = { code: g.code, token: (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: b.profiel.id }))).token };
  const l = await leren('lijst-maak', Object.assign({}, kind, { naam: 'Frans H3',
    paren: [{ v: 'de hond', a: 'le chien' }, { v: 'de kat', a: 'le chat' }, { v: 'het brood', a: 'le pain' }] }));
  lijstId = l.body.id;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de dagstapel: nieuw = vandaag; goed gaat vooruit, fout blijft vandaag', async () => {
  let d = await leren('herhaal', kind);
  assert.equal(d.body.aantal, 3, 'nieuwe paren staan vandaag klaar, in bakje 1');
  assert.ok(d.body.stapel.every(k => k.bak === 1));
  const eerste = d.body.stapel.find(k => k.v === 'de hond');
  // goed: een bakje omhoog en pas over twee dagen weer
  const r1 = await leren('herhaal-antwoord', Object.assign({}, kind, { lijstId, idx: eerste.idx, goed: true }));
  assert.equal(r1.body.bak, 2);
  assert.equal(r1.body.weer, plus(2), 'bakje 2 rust twee dagen');
  // fout: terug naar bakje 1, vandaag nog een keer
  const kat = d.body.stapel.find(k => k.v === 'de kat');
  const r2 = await leren('herhaal-antwoord', Object.assign({}, kind, { lijstId, idx: kat.idx, goed: false }));
  assert.equal(r2.body.bak, 1);
  assert.equal(r2.body.weer, plus(0), 'fout komt vandaag nog een keer terug');
  d = await leren('herhaal', kind);
  assert.equal(d.body.aantal, 2, 'de goede is uit de stapel van vandaag, de foute niet');
  assert.ok(!d.body.stapel.find(k => k.v === 'de hond'));
  assert.ok(d.body.stapel.find(k => k.v === 'de kat'));
});

test('2. de bakjes klimmen tot 5 en nooit verder, en de stand telt eerlijk mee', async () => {
  const d = await leren('herhaal', kind);
  const brood = d.body.stapel.find(k => k.v === 'het brood');
  let r;
  for (let n = 0; n < 6; n++) r = await leren('herhaal-antwoord', Object.assign({}, kind, { lijstId, idx: brood.idx, goed: true }));
  assert.equal(r.body.bak, 5, 'bakje 5 is het hoogste');
  assert.equal(r.body.weer, plus(14), 'en komt elke twee weken gewoon terug -- nooit "voor altijd klaar"');
  const st = await leren('herhaal-stand', kind);
  const l = st.body.lijsten.find(x => x.id === lijstId);
  assert.deepEqual(l.bakken.reduce((a, b) => a + b, 0), 3, 'elke vraag zit in precies een bakje');
  assert.equal(l.bakken[4], 1, 'het brood zit in bakje 5');
  assert.equal(st.body.vandaag, l.vandaag, 'de teller telt wat er echt klaarstaat');
});

test('3. andermans lijst blijft dicht: een broertje heeft zijn eigen curve', async () => {
  const d = await leren('herhaal', broer);
  assert.equal(d.body.aantal, 0, 'de stapel van Tom is leeg; de lijst is van Isa');
  const r = await leren('herhaal-antwoord', Object.assign({}, broer, { lijstId, idx: 0, goed: true }));
  assert.equal(r.status, 404, 'antwoorden op andermans lijst kan niet');
});
