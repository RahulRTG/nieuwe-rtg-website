/* RTF School: het niveau van een klas komt van de officiele ladder.

   Een klas had alleen een vrije naam ("3B", "Meester Jan"), en die naam ging
   als "niveau" de AI-bijles in en liet de toets-bibliotheek aan elke leraar
   alles aanbieden -- van groep 1 tot academisch schrijven. Deze toetsen
   leggen het contract vast: een klas kan een fase van de ladder dragen, de
   trap volgt daaruit, een fase buiten de ladder wordt geweigerd, en de
   bibliotheek van een klas MET niveau bevat alleen het eigen deel.
   Draai los: node --test test/schoolniveau.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-schoolniveau-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function office(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + '/api' + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* school -> goedgekeurde leraar, zonder klas (die maken de toetsen zelf) */
async function leraar(naam) {
  const sch = await json(await api('/school/school/maak', { naam: 'Het Kompas ' + naam, plaats: 'Zwolle' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf ' + naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  return { sch, p };
}

test('1. een klas draagt een fase van de ladder, en de trap volgt eruit', async () => {
  const { sch, p } = await leraar('Fase');
  const havo = await json(await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: '3B', fase: 'havo' }));
  assert.equal(havo.fase, 'havo');
  assert.equal(havo.trap, 'vo');
  const g7 = await json(await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: '7A', fase: 'po-g7' }));
  assert.equal(g7.trap, 'po');
  // het overzicht vertelt het niveau in mensentaal, met de schoolsoort erbij
  const st = await json(await api('/school/personeel/status', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken }));
  const rij = st.klassen.find(k => k.code === havo.code);
  assert.equal(rij.niveau, 'Havo (Voortgezet onderwijs)');
  // en de ladder voor het maakformulier komt mee: een waarheid, van de server
  assert.ok(st.ladder && st.ladder.trappen.length === 6 && st.ladder.fasen.length >= 25);
});

test('2. een fase buiten de ladder wordt geweigerd; zonder fase blijft alles werken', async () => {
  const { sch, p } = await leraar('Grens');
  const fout = await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'X', fase: 'groep-13' });
  assert.equal(fout.status, 400);
  const zonder = await json(await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Zonder niveau' }));
  assert.ok(zonder.ok && zonder.fase === null && zonder.trap === null);
});

test('3. de bibliotheek van een klas met niveau bevat alleen het eigen deel', async () => {
  const { sch, p } = await leraar('Bieb');
  const lr = (klas, body) => api('/school/toets/bibliotheek',
    Object.assign({ klasCode: klas.code, leraarToken: p.personeelToken }, body || {}));
  // een basisschoolklas ziet groepen en GEEN vervolg-fasen
  const po = await json(await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: '4A', fase: 'po-g4' }));
  const poBieb = await json(await lr(po));
  assert.ok(poBieb.groepen.length === 8 && poBieb.fasen.length === 0,
    'basisschoolklas: alleen groepen (kreeg ' + poBieb.fasen.length + ' fasen)');
  // een havo-klas ziet alleen vo-fasen en GEEN basisschoolgroepen
  const vo = await json(await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: '3B', fase: 'havo' }));
  const voBieb = await json(await lr(vo));
  assert.equal(voBieb.groepen.length, 0, 'vo-klas: geen basisschoolgroepen');
  assert.ok(voBieb.fasen.length >= 1 && voBieb.fasen.every(f => f.trap === 'vo'),
    'vo-klas: alleen vo-fasen (' + voBieb.fasen.map(f => f.fase).join(',') + ')');
  // een klas zonder niveau (bestaande klassen) houdt het volledige aanbod
  const los = await json(await api('/school/leraar/klas/maak',
    { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Oud' }));
  const losBieb = await json(await lr(los));
  assert.ok(losBieb.groepen.length === 8 && losBieb.fasen.length >= 4);
});
