/* HET STREEFBEELD -- server/kern/streefbeeld.js (besluit C7): de machine stelt
   voor, de eigenaar tekent.

   1. het voorstel is het gemiddelde van drie afgesloten maanden met de spreiding
      als tolerantie, en een dimensie zonder drie toonbare maanden krijgt een reden;
   2. tekenen gaat over PRECIES dat voorstel: veranderen de getallen, dan weigert het;
   3. zonder handtekening mag er niets autonoom (leeg is dicht);
   4. EEN dimensie buiten de tolerantie of onbekend is genoeg om niet te mogen, en
      een betere omzet koopt geen slechtere churn af -- geen gewogen som;
   5. beter dan het doel is geen overtreding;
   6. over HTTP: de boardroom leest, alleen de eigenaar tekent, en een oud voorstel
      tekenen weigert.

   Draai: node --test test/streefbeeld.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

/* Een nagemaakte stand per maand: { 'JJJJ-MM': { maatId: waarde|null } }. */
function wereld(perMaand, nu = '2026-10-10T10:00:00Z') {
  const bedrijfsmaat = { stand: ({ maand }) => ({ maten: Object.entries(perMaand[maand] || {}).map(([id, w]) =>
    (w == null ? { id, stand: 'TE_KLEINE_GROEP' } : { id, stand: 'TOONBAAR', waarde: w })) }) };
  const db = { data: {} };
  return require('../server/kern/streefbeeld')({ db, save: () => {}, bedrijfsmaat, nu: () => nu }).streefbeeld;
}
const drie = { '2026-07': { 'omzet.leden-ontvangen': 900, 'churn.pas-naar-gast': 0.02, 'uitkomst.klantwaarde-travel': null },
  '2026-08': { 'omzet.leden-ontvangen': 1000, 'churn.pas-naar-gast': 0.03 },
  '2026-09': { 'omzet.leden-ontvangen': 1100, 'churn.pas-naar-gast': 0.04 } };

test('1. het voorstel: gemiddelde van drie maanden, spreiding als tolerantie, en een reden waar het niet kan', () => {
  const s = wereld(drie);
  const v = s.voorstel();
  assert.deepEqual(v.maanden, ['2026-07', '2026-08', '2026-09'], 'drie afgesloten maanden, niet de lopende');
  const omzet = v.dimensies.find(d => d.id === 'omzet.leden-ontvangen');
  assert.equal(omzet.voorstel.waarde, 1000);
  assert.equal(omzet.voorstel.tolerantie, 100);
  assert.equal(omzet.voorstel.grens, 900);
  const reis = v.dimensies.find(d => d.id === 'uitkomst.klantwaarde-travel');
  assert.equal(reis.voorstel, null);
  assert.match(reis.reden, /toonbaar/);
});

test('2 en 3. zonder handtekening niets autonoom, en tekenen gaat over precies dit voorstel', () => {
  const data = JSON.parse(JSON.stringify(drie));
  const s = wereld(data);
  assert.equal(s.toets().magAutonoom, false);
  assert.match(s.toets().reden, /leeg is dicht/);
  assert.equal(s.teken('verzonnen', 'eigenaar').status, 409);
  assert.equal(s.teken(s.voorstel().id, null).status, 403, 'niet zonder naam');
  const oud = s.voorstel().id;
  data['2026-09']['omzet.leden-ontvangen'] = 1200;
  assert.equal(s.teken(oud, 'eigenaar').status, 409, 'de getallen veranderden sinds het voorstel werd bekeken');
  assert.equal(s.teken(s.voorstel().id, 'eigenaar').ok, true);
});

test('4 en 5. een dimensie buiten is genoeg, beter is geen overtreding, en onbekend mag niet', () => {
  const data = JSON.parse(JSON.stringify(drie));
  const s = wereld(data, '2026-10-10T10:00:00Z');
  s.teken(s.voorstel().id, 'eigenaar');
  data['2026-10'] = { 'omzet.leden-ontvangen': 5000, 'churn.pas-naar-gast': 0.03 };
  assert.equal(s.toets('2026-10').magAutonoom, true, 'binnen, en een veel betere omzet is geen overtreding');
  data['2026-10']['churn.pas-naar-gast'] = 0.09;
  const t = s.toets('2026-10');
  assert.equal(t.magAutonoom, false, 'een hoge omzet koopt een slechte churn niet af');
  assert.match(t.reden, /churn/);
  data['2026-10']['churn.pas-naar-gast'] = null;
  assert.equal(s.toets('2026-10').magAutonoom, false, 'onbekend is geen binnen');
  assert.equal(s.intrek('eigenaar').ok, true);
  assert.equal(s.toets('2026-10').magAutonoom, false, 'ingetrokken is weer leeg');
});

test('4b. een van vijf buiten is net zo goed nee als drie van vijf -- geen meerderheid', () => {
  const m = (w) => ({ 'omzet.leden-ontvangen': 1000, 'acquisitie.nieuwe-leden': 50, 'uitkomst.klantwaarde-living': 200,
    'uitkomst.klantwaarde-work': 30, 'churn.pas-naar-gast': w });
  const data = { '2026-07': m(0.02), '2026-08': m(0.03), '2026-09': m(0.04) };
  const s = wereld(data);
  s.teken(s.voorstel().id, 'eigenaar');
  data['2026-10'] = m(0.03);
  assert.equal(s.toets('2026-10').magAutonoom, true);
  data['2026-10'] = m(0.2);
  assert.equal(s.toets('2026-10').magAutonoom, false, 'vier binnen en een buiten is nee');
});

test('6. over HTTP: de boardroom leest, een oud voorstel tekenen weigert', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-streefbeeld-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, t) => fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    assert.equal((await api('/api/office/streefbeeld', {})).status, 401);
    const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    const r = await api('/api/office/streefbeeld', {}, eig);
    assert.equal(r.status, 200);
    assert.equal(r.body.getekend, null);
    assert.equal(r.body.toets.magAutonoom, false);
    assert.equal(r.body.voorstel.dimensies.length, 8);
    assert.equal((await api('/api/office/streefbeeld/teken', { id: 'oud' }, eig)).status, 409);
    const weg = await api('/api/office/streefbeeld/intrek', {}, eig);
    assert.equal(weg.status, 200);
    assert.equal(weg.body.alLeeg, true, 'niets getekend, dus niets in te trekken');
  } finally { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } }
});
