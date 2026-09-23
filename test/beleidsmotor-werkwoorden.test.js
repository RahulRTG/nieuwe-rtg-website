/* DE BOARDROOM ALS WERKRUIMTE, DE KAMERS APART (AUTHORITY.md fase 4, schaduw).

   Vier dingen die niet mogen sneuvelen:
   1. elke route achter boardroomAuth valt onder precies een werkwoord, en elk
      werkwoord raakt minstens een route -- een nieuwe boardroomroute zonder
      werkwoord laat dit zakken, een verzonnen werkwoord ook;
   2. de kamersoorten zijn gelijk aan het LEVENDE kamerregister, en alleen een
      bestuurlijke kamer kan een bevoegdheid dragen (KANTOORMACHT.md par. 3);
   3. elke kamerroute bestaat echt;
   4. tegen een echte server telt de motor gebruik per werkwoord en per kamer,
      en een verzonnen kamer-id wordt NIET geteld (de opslag groeit niet op
      invoer van buiten).

   Draai los: node --test test/beleidsmotor-werkwoorden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { alleRoutes } = require('../scripts/lib/routes');
const { WERKWOORDEN, werkwoordVan, KAMERSOORT, KAMERROUTES, kamerVan } = require('../server/kern/beleidsmotor/werkwoorden');

const routes = alleRoutes();

test('1. elke boardroomroute heeft een werkwoord, en elk werkwoord een route', () => {
  const br = routes.filter(r => (r.bewakers || []).includes('boardroomAuth'));
  assert.ok(br.length > 100, 'de boardroomroutes zijn gevonden (' + br.length + ')');
  const zonder = br.filter(r => !werkwoordVan(r.pad)).map(r => r.pad);
  assert.deepEqual(zonder, [], 'boardroomroutes zonder werkwoord');
  const geraakt = new Set(br.map(r => werkwoordVan(r.pad)));
  for (const w of Object.keys(WERKWOORDEN)) assert.ok(geraakt.has(w), 'werkwoord zonder route: ' + w);
  assert.equal(werkwoordVan('/api/office/boardroom/toegang/geef'), 'toegang', 'het specifieke voor het algemene');
  assert.equal(werkwoordVan('/api/office/boardroom/schakel'), 'instellingen');
  assert.equal(werkwoordVan('/api/office/journaalbeeld'), null, 'een voorvoegsel zonder slash is geen woorddeel');
  for (const w of Object.values(WERKWOORDEN)) assert.ok(['geen', 'tonen', 'klaarzetten', 'uitvoeren'].includes(w.trede));
});

test('2. de kamersoorten zijn het levende register', () => {
  const s = { d: () => 0, lijst: () => [], tel: () => 0, recent: () => [], ledenGeteld: () => 0, functies: {}, accounts: {} };
  const reg = Object.assign(require('../server/kern/afdelingen/register')(s), require('../server/kern/afdelingen/register2')(s));
  assert.deepEqual(Object.keys(KAMERSOORT).sort(), Object.keys(reg).sort());
  const tel = (soort) => Object.values(KAMERSOORT).filter(x => x === soort).length;
  assert.deepEqual([tel('bestuurlijk'), tel('sociaal'), tel('product')], [18, 1, 7]);
});

test('3. elke kamerroute bestaat, en alleen een echte kamer telt', () => {
  const bestaat = new Set(routes.map(r => r.methode + ' ' + r.pad));
  for (const k of Object.keys(KAMERROUTES)) assert.ok(bestaat.has(k), 'kamerroute bestaat niet: ' + k);
  assert.equal(kamerVan('POST /api/office/kamer', { id: 'sales' }), 'sales');
  assert.equal(kamerVan('POST /api/office/kamer', { id: 'constructor' }), null, 'geen prototype-sleutel');
  assert.equal(kamerVan('POST /api/office/kamer', { id: 'verzonnen' }), null);
  assert.equal(kamerVan('POST /api/office/state', { id: 'sales' }), null, 'een route die niet over een kamer gaat');
});

const mappen = [];
let srv, gedeeld, eig;
function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkwoord-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: 'WERKWOORD-KANTOOR' } });
  gedeeld = (await api('/api/office/login', { code: 'WERKWOORD-KANTOOR' })).body.token;
  eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(gedeeld && eig);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('4. de motor telt gebruik per werkwoord en per kamer, en niets verzonnens', async () => {
  assert.equal((await api('/api/office/kamer', { id: 'sales' }, gedeeld)).status, 200);
  assert.equal((await api('/api/office/kamer', { id: 'sales' }, gedeeld)).status, 200);
  await api('/api/office/kamer', { id: 'verzonnen-kamer' }, gedeeld);
  assert.equal((await api('/api/office/kosten/overzicht', {}, eig)).status, 200);
  assert.equal((await api('/api/office/kosten/overzicht', {}, gedeeld)).status, 403, 'de gedeelde code komt de boardroom niet in');
  const st = await api('/api/office/beleidsmotor', {}, eig);
  assert.equal(st.status, 200);
  const kamer = Object.fromEntries(st.body.kamers.map(k => [k.kamer, k]));
  assert.equal(kamer.sales.gebruik, 2, 'twee keer in de salesroom');
  assert.equal(kamer.sales.kanBevoegdheidDragen, true);
  assert.equal(kamer.kantine.kanBevoegdheidDragen, false);
  assert.equal(st.body.kamers.length, 26, 'een verzonnen kamer komt er niet bij');
  const ww = Object.fromEntries(st.body.werkwoorden.map(w => [w.werkwoord, w]));
  assert.equal(ww.kosten.gebruik, 1, 'alleen de aanroep die door de boardroom kwam telt');
  assert.equal(st.body.zonderWerkwoord, 0);
  assert.equal(st.body.deuren.find(d => d.deur === 'kantoor').oneens, 0, 'de kamertelling raakt de deurtelling niet');
});
