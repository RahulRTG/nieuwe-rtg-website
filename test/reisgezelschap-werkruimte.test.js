/* ============================================================================
   DE WERKRUIMTE PER DEELNEMER, over de draad (kern/reisgezelschap-werkruimte.js).

   Stap 3 van "Five People. Five Private Contexts. One Shared Outcome". Dezelfde
   reis, vijf lezers, en de SERVER beslist per lezer welke blokken, gegevens en
   handelingen hij krijgt. Wat hier wordt vastgehouden:
   - de rol komt uit het gezelschap en nooit uit het verzoek;
   - een reisgenoot krijgt de groepsvoortgang en de optieknoppen niet;
   - Rahul legt uit wat DEZE lezer al ziet, en niets van een ander;
   - vijf mensen die tegelijk iets veranderen, eindigen bij een groepsbeeld dat
     voor iedereen gelijk is en klopt met wat ze opgaven;
   - na een wijziging verandert de vingerafdruk, zodat een scherm weet dat wat
     het toont niet meer actueel is.
   Draai los: node --test test/reisgezelschap-werkruimte.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const R = require('../server/kern/reisgezelschap-opties');
const W = require('../server/kern/reisgezelschap-werkruimte');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reiswerk-'));
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let srv, base, REIS;
let A, B, C, D, G, E, F;
const opties = {};

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function nieuwLid(naam) {
  const u = naam + Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 5);
  const r = await api('/api/auth/register', { name: naam, email: u + '@x.nl',
    phone: '06' + String(Date.now()).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01' });
  assert.equal(r.status, 200, naam + ': ' + JSON.stringify(r.body));
  const lid = { naam, token: r.body.token, codenaam: r.body.state.user.codename };
  await api('/api/reis/gezelschap/kring', {}, lid.token);
  return lid;
}
async function doeMee(lid, rol) {
  const uit = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: lid.codenaam, rol }, A.token);
  assert.equal(uit.status, 200, JSON.stringify(uit.body));
  assert.equal((await api('/api/reis/gezelschap/antwoord', { id: uit.body.lid.id, ja: true }, lid.token)).status, 200);
  return uit.body.lid.id;
}
const beeld = async (wie) => {
  const r = await api('/api/reis/gezelschap/opties', { reis: REIS }, wie.token);
  assert.equal(r.status, 200, wie.naam + ': ' + JSON.stringify(r.body));
  return r.body;
};
const gedeeld = (b) => JSON.stringify(Object.assign({}, b.groep, { voortgang: undefined }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const kantoor = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  A = await nieuwLid('Anna'); B = await nieuwLid('Bram'); C = await nieuwLid('Cees');
  D = await nieuwLid('Dirk'); G = await nieuwLid('Gijs'); E = await nieuwLid('Eva'); F = await nieuwLid('Frits');
  assert.equal(new Set([A, B, C, D, G, E, F].map(x => x.codenaam)).size, 7, 'twee leden delen een codenaam');
  const zet = await api('/api/office/reisbureau/klaarzetten', { onderdelen: [
    { soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' }
  ] }, kantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal((await api('/api/reis/uitnodiging/eisop', { code: zet.body.link.split('code=')[1] }, A.token)).status, 200);
  REIS = (await api('/api/reis/reizen', {}, A.token)).body.reizen[0].id;
  for (const x of [B, C, D, G]) x.uitnodiging = await doeMee(x, 'reisgenoot');
  E.uitnodiging = await doeMee(E, 'meekijker');
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });


test('1. de server kiest de werkruimte bij de rol, en de rol komt niet uit het verzoek', async () => {
  for (const [wie, o] of [[A, { plafond: 150000 }], [B, { plafond: 120000, nietGraag: ['nachtleven'] }],
    [C, { plafond: 200000 }], [D, {}], [G, { plafond: 180000 }]]) {
    assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: o }, wie.token)).status, 200, wie.naam);
  }
  const z = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Boutiquehotel', prijsPP: 130000, van: dag(60), tot: dag(64) } }, A.token);
  opties.duur = z.body.optie.id;
  const anna = await beeld(A), bram = await api('/api/reis/gezelschap/opties', { reis: REIS, rol: 'eigenaar' }, B.token);
  assert.equal(anna.rol, 'eigenaar');
  assert.deepEqual(anna.werkruimte.blokken, W.BLOKKEN.eigenaar);
  assert.equal(bram.body.rol, 'reisgenoot', 'een rol in het verzoek telt niet');
  assert.deepEqual(bram.body.werkruimte.handelingen, ['opgave.zet', 'opgave.wis']);
  assert.equal(bram.body.groep.voortgang, undefined, 'de groepsvoortgang is van de reiziger');
  assert.deepEqual(anna.groep.voortgang, { deelnemers: 5, ingevuld: 5 });
  assert.equal(bram.body.jij.opgave.plafond, 120000, 'Bram ziet zijn eigen opgave terug');
  assert.equal(anna.jij.opgave.plafond, 150000);
});

test('2. een vervalste verwijzing of sessie opent niets', async () => {
  const vreemd = await api('/api/reis/gezelschap/opties', { reis: 'R-van-iemand-anders' }, B.token);
  assert.equal(vreemd.status, 404);
  assert.equal((await api('/api/reis/gezelschap/opties', { reis: REIS }, 'verlopen-token')).status, 401);
  assert.equal((await api('/api/reis/gezelschap/opties', { reis: REIS }, F.token)).status, 404, 'een buitenstaander');
  assert.equal((await api('/api/reis/gezelschap/opties', { reis: REIS }, E.token)).status, 404, 'een meekijker reist niet mee');
  const zet = await api('/api/reis/gezelschap/opties/zet', { reis: REIS, rol: 'eigenaar',
    optie: { titel: 'Kaping', prijsPP: 1000, van: dag(60), tot: dag(61) } }, B.token);
  assert.equal(zet.status, 404, 'een reisgenoot zet geen opties klaar, ook niet met een rol in het verzoek');
});

test('3. Rahul legt uit wat deze lezer ziet en niets van een ander', async () => {
  const per = {};
  for (const wie of [A, B, C, D, G]) per[wie.naam] = await beeld(wie);
  assert.match(per.Anna.uitleg[0], /Er is nog geen optie die voor iedereen past\. U kunt de reisdata of het voorstel aanpassen\./);
  assert.match(per.Cees.uitleg[0], /De reiziger kan het voorstel aanpassen/);
  assert.ok(per.Bram.uitleg.some(z => /Voor u past Boutiquehotel .* niet: De prijs per persoon ligt boven uw plafond/.test(z)),
    'Bram hoort zijn eigen reden: ' + per.Bram.uitleg.join(' | '));
  for (const naam of ['Anna', 'Cees', 'Dirk', 'Gijs']) {
    const t = per[naam].uitleg.join(' ');
    assert.ok(!/uw plafond|120000|1\.200/.test(t), naam + ' hoort iets over het plafond van Bram: ' + t);
    for (const x of [A, B, C, D, G]) assert.ok(!t.includes(x.codenaam), naam + ' hoort een codenaam');
  }
});

test('4. vijf wijzigingen tegelijk eindigen bij een gelijk en kloppend groepsbeeld, en de vingerafdruk beweegt', async () => {
  const voor = (await beeld(A)).kenmerk;
  const nieuw = [[A, { plafond: 140000 }], [B, { plafond: 135000 }], [C, { plafond: 160000 }],
    [D, { plafond: 300000 }], [G, { plafond: 131000 }]];
  const t0 = Date.now();
  const r = await Promise.all(nieuw.map(([wie, o]) => api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: o }, wie.token)));
  r.forEach((x, i) => assert.equal(x.status, 200, nieuw[i][0].naam));
  const per = await Promise.all([A, B, C, D, G].map(beeld));
  const duur = Date.now() - t0;
  const ijk = gedeeld(per[0]);
  per.forEach((b, i) => assert.equal(gedeeld(b), ijk, [A, B, C, D, G][i].naam + ' zag een ander groepsbeeld'));
  const verwacht = nieuw.every(([, o]) => R.pastBij({ prijsPP: 130000, van: dag(60), tot: dag(64), kenmerken: [] }, o).past);
  assert.equal(per[0].groep.opties.find(x => x.id === opties.duur).voorIedereen, verwacht, 'het beeld klopt met de opgaven');
  assert.equal(verwacht, true, 'na de verhogingen past het hotel');
  assert.notEqual(per[0].kenmerk, voor, 'na een wijziging die de uitkomst verandert, verandert de vingerafdruk');
  assert.ok(per[0].berekendOp, 'het beeld zegt wanneer het berekend is');
  assert.ok(duur < 5000, 'vijf wijzigingen en vijf beelden in ' + duur + ' ms');
});

test('5. de uitleg als regel: nooit meer dan de lezer ziet', () => {
  const groep = { vastTeStellen: true, waaromNiet: null, venster: [{ van: '2027-01-04', tot: '2027-01-05' }],
    opties: [{ id: 'O-1', titel: 'Villa', prijsPP: 100000, voorIedereen: false }] };
  const z = W.uitlegVoor('reisgenoot', groep, { opgave: { plafond: 90000 }, opties: { 'O-1': { past: false, redenen: ['De prijs per persoon ligt boven uw plafond.'] } } }, null);
  assert.match(z[0], /nog geen optie/); assert.match(z[1], /van 2027-01-04 tot 2027-01-05/); assert.match(z[2], /Voor u past Villa/);
  assert.equal(W.uitlegVoor.length, 4, 'de uitleg krijgt rol, groep, jij en voortgang -- geen opgaven van anderen');
});
