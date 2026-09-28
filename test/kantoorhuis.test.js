/* ============================================================================
   WELKE ENTITEIT IS RTG, EN WERKT DEZE KANTOORMENS DAAR? (besluit B1,
   PERSONEEL.md par. 12; kern/kantoor/huis.js)

   Vier dingen die niet mogen sneuvelen:
   1. zonder aanwijzing is het werkverband `onbekend` MET reden -- nooit "niemand
      is in dienst";
   2. alleen de EIGENAAR wijst de huisentiteit aan, en een entiteit die niet
      bestaat wordt geweigerd;
   3. een lopend dienstverband bij de huisentiteit heet `loopt`; een mandaat is
      geen dienstverband; een dienstverband dat op een DATUM eindigde telt de
      dag erna niet meer mee (uitgerekend, niet opgeslagen);
   4. de review blijft schaduw: hij toont het werkverband en verandert niets aan
      de deuren.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakHuis } = require('../server/kern/kantoor/huis');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');

function nepHuis() {
  const db = { data: {} };
  return maakHuis({ db, save() {}, nu: () => '2026-09-27T10:00:00.000Z' });
}

test('1. de rekensom: onbekend zonder aanwijzing, dan loopt / geen / alleen mandaat', () => {
  const h = nepHuis();
  const bron = (lijst) => ({ codenaamVan: () => 'Stille Reiger', employmentVanPersoon: () => lijst });
  const leeg = h.werkverband('user-1', bron([]));
  assert.equal(leeg.stand, 'onbekend');
  assert.match(leeg.reden, /nog niet aangewezen/, 'zonder aanwijzing zegt hij waarom, en niet "geen"');

  assert.equal(h.wijsAan('ent_x', 'user-9', () => false).status, 404, 'een entiteit die niet bestaat wordt geweigerd');
  assert.equal(h.wijsAan('', 'user-9', () => true).status, 400);
  assert.equal(h.wijsAan('ent_rtg', 'user-9', () => true).ok, true);
  assert.equal(h.aanwijzing().entiteit, 'ent_rtg');
  /* dezelfde aanwijzing nog een keer (ook buiten het venster van de idem-poort)
     verandert niets: niet wie, en niet sinds wanneer */
  const voor = h.aanwijzing();
  const nogEens = h.wijsAan('ent_rtg', 'user-7', () => true);
  assert.equal(nogEens.ongewijzigd, true);
  assert.deepEqual(h.aanwijzing(), voor);

  assert.deepEqual(h.werkverband('user-1', bron([{ entiteit: 'ent_rtg', telt: true, rol: 'Kantine' }])),
    { stand: 'loopt', rollen: ['Kantine'] });
  assert.deepEqual(h.werkverband('user-1', bron([{ entiteit: 'ent_ander', telt: true, rol: 'Kok' }])),
    { stand: 'geen', alleenMandaat: false }, 'in dienst bij een ANDERE entiteit is geen werkverband bij RTG');
  assert.deepEqual(h.werkverband('user-1', bron([{ entiteit: 'ent_rtg', telt: false, rol: 'Accountant' }])),
    { stand: 'geen', alleenMandaat: true }, 'een mandaat is geen dienstverband, en dat staat erbij');
  assert.equal(h.werkverband('user-1', { codenaamVan: () => null, employmentVanPersoon: () => [] }).stand, 'onbekend');
  assert.equal(h.werkverband('user-1', { codenaamVan: () => 'X', employmentVanPersoon: () => { throw new Error('stuk'); } }).stand,
    'onbekend', 'een bron die niet antwoordt wordt geen nee');
});

const CODE = 'HUIS-KANTOOR';
const REDEN = 'Kwartaalreview van de kantoortoegang';
const mappen = [];
function api(base, pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let srv, eigKantoor, eigLid;
test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-huis-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  eigKantoor = await kantoorAlsPersoon(srv.base, CODE);
  eigLid = (await api(srv.base, '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eigKantoor && eigLid);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('2-4. echte server: aanwijzen, in dienst, uit dienst -- en de review blijft schaduw', async () => {
  const base = srv.base;
  // een medewerker met de kantoorrol, zoals in productie: via een uitnodiging
  const reg = (await api(base, '/api/auth/register', { name: 'Huis Toets', email: 'huis' + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.ok(reg.token);
  assert.equal((await api(base, '/api/account/koppel', await kantoorKoppelBody(base, reg.token), reg.token)).status, 200);
  const u = reg.state.user;
  const key = 'user-' + u.id;
  const review = async () => {
    const r = await api(base, '/api/office/beleidsmotor/review', { reden: REDEN }, eigKantoor);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    return r.body;
  };

  const r0 = await review();
  const h0 = r0.houders.find(h => h.key === key);
  assert.ok(h0, 'de medewerker staat in de review');
  assert.equal(h0.werkverband.stand, 'onbekend', 'zonder aanwijzing is het onbekend');
  assert.equal(r0.werkverband.huis, null);

  // de eigenaar richt RTG in als entiteit, via de gewone weg
  const ent = (await api(base, '/api/concern/entiteit/nieuw', { naam: 'Rahul Travel Group', land: 'NL' }, eigLid)).body;
  assert.ok(ent.ok, JSON.stringify(ent).slice(0, 200));
  const entId = ent.entiteit.id;

  // alleen de eigenaar wijst aan
  const gedeeld = (await api(base, '/api/office/login', { code: CODE })).body.token;
  assert.equal((await api(base, '/api/office/beleidsmotor/huis/zet', { entiteit: entId }, gedeeld)).status, 403,
    'de gedeelde code komt niet eens in de boardroom');
  /* een vertrouweling met een boardroomsleutel is niet de eigenaar: ook hij
     wijst niet aan welke entiteit RTG is */
  assert.equal((await api(base, '/api/office/boardroom/toegang/geef', { codenaam: u.codename }, eigLid)).status, 200);
  const vertrouweling = (await api(base, '/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
  assert.ok(vertrouweling);
  const nietBaas = await api(base, '/api/office/beleidsmotor/huis/zet', { entiteit: entId }, vertrouweling);
  assert.equal(nietBaas.status, 403, 'alleen de eigenaar: ' + JSON.stringify(nietBaas.body));
  assert.match(nietBaas.body.error, /eigenaar/);
  assert.equal((await api(base, '/api/office/beleidsmotor/huis/zet', { entiteit: 'bestaat-niet' }, eigKantoor)).status, 404);
  const zet = await api(base, '/api/office/beleidsmotor/huis/zet', { entiteit: entId }, eigKantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  /* dezelfde aanwijzing nog een keer is een dubbeltik: niets verandert, ook de
     datum niet. Binnen het venster antwoordt de idem-poort
     (lib/idemsleutels-personeel.js), daarbuiten de route met `ongewijzigd`;
     de unittoets hierboven houdt die tweede weg vast. */
  const nogEens = await api(base, '/api/office/beleidsmotor/huis/zet', { entiteit: entId }, eigKantoor);
  assert.equal(nogEens.status, 200);
  assert.deepEqual(nogEens.body.huis, zet.body.huis, 'sinds en door blijven staan');

  const r1 = await review();
  assert.equal(r1.werkverband.huis.entiteit, entId);
  assert.equal(r1.houders.find(h => h.key === key).werkverband.stand, 'geen', 'aangewezen, maar nog niet in dienst');
  // vanaf hier verandert alleen het werkverband; de deuren horen gelijk te blijven
  const deurenVoor = JSON.stringify(r1.houders.find(h => h.key === key).deuren);

  // in dienst bij RTG, via de gewone concernroute
  const emp = (await api(base, '/api/concern/mens/nieuw',
    { entiteit: entId, persoon: u.codename, rol: 'Kantine', van: '2026-01-01' }, eigLid)).body;
  assert.ok(emp.ok, JSON.stringify(emp).slice(0, 200));
  const r2 = await review();
  const h2 = r2.houders.find(h => h.key === key);
  assert.deepEqual(h2.werkverband, { stand: 'loopt', rollen: ['Kantine'] });
  assert.ok(r2.werkverband.loopt >= 1);
  assert.equal(JSON.stringify(h2.deuren), deurenVoor, 'schaduw: de deuren besluiten precies hetzelfde als ervoor');

  // uit dienst per gisteren: de dag erna telt het niet meer, zonder dat iemand iets opslaat
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const uit = await api(base, '/api/concern/mens/uitdienst', { employment: emp.employment.id, per: gisteren }, eigLid);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 200));
  const r3 = await review();
  assert.equal(r3.houders.find(h => h.key === key).werkverband.stand, 'geen');
});
