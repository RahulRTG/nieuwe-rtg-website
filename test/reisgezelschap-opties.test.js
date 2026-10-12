/* ============================================================================
   DE GROEPSBEREKENING, over de draad (kern/reisgezelschap-opties.js).

   Stap 2 van "Five People. Five Private Contexts. One Shared Outcome". Vijf
   deelnemers geven elk privé iets op, de reiziger zet opties klaar, en elke
   deelnemer ziet per optie of hij voor iedereen past -- en alleen zijn EIGEN
   reden als hij voor hem niet past.

   DE DRAGENDE BEWERING STAAT IN TOETS 3: het groepsbeeld is voor elke deelnemer
   HETZELFDE, op het veld `voorJou` na. Als dat klopt, kan geen enkel lid uit
   zijn antwoord iets afleiden dat een ander niet ook ziet -- en dan bestaat er
   geen lezer die meer weet dan de rest. Toets 5 is de aanval: de reiziger
   probeert het laagste plafond uit te horen door steeds een andere prijs te
   laten toetsen.

   Anna reist, Bram, Cees, Dirk en Gijs reizen mee, Eva kijkt mee, Frits hoort
   er niet bij. Bram heeft het laagste plafond en houdt niet van nachtleven.

   Draai los: node --test test/reisgezelschap-opties.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const R = require('../server/kern/reisgezelschap-opties');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisopties-'));
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
const zonderJou = (b) => JSON.stringify(Object.assign({}, b, { opties: b.opties.map(o => Object.assign({}, o, { voorJou: undefined })) }));

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

test('1. de drie routes zitten achter een sessie; meekijker en buitenstaander zien niets, een reisgenoot zet niets klaar', async () => {
  for (const pad of ['/api/reis/gezelschap/opties', '/api/reis/gezelschap/opties/zet', '/api/reis/gezelschap/opties/wis']) {
    assert.equal((await api(pad, { reis: REIS })).status, 401, pad);
  }
  for (const wie of [E, F]) assert.equal((await api('/api/reis/gezelschap/opties', { reis: REIS }, wie.token)).status, 404, wie.naam);
  const doorBram = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Mijn idee', prijsPP: 50000, van: dag(60), tot: dag(64) } }, B.token);
  assert.equal(doorBram.status, 404, 'een reisgenoot zet geen opties klaar');
});

test('2. zolang niet iedereen iets opgaf, is er geen groepsuitkomst -- wel een eigen', async () => {
  const z = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Villa aan zee', prijsPP: 100000, van: dag(60), tot: dag(64), kenmerken: ['strand'] } }, A.token);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  opties.zee = z.body.optie.id;
  await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: { plafond: 150000 } }, A.token);
  const b = await beeld(A);
  assert.equal(b.vastTeStellen, false);
  assert.match(b.waaromNiet, /Nog niet iedereen/);
  assert.equal(b.opties[0].voorIedereen, null, 'een groepsuitkomst zonder alle opgaven is een gok');
  assert.equal(b.opties[0].voorJou.past, true, 'Anna ziet wel haar eigen uitkomst');
  assert.equal(b.stand, 'voorlopig');
});

test('3. vijf opgaven, drie opties: het beeld is voor iedereen gelijk op voorJou na, en alleen Bram hoort zijn reden', async () => {
  const venster = [{ van: dag(55), tot: dag(70) }];
  const opgaven = [
    [B, { plafond: 120000, data: [{ van: dag(58), tot: dag(66) }], nietGraag: ['nachtleven'] }],
    [C, { plafond: 200000, data: venster }],
    [D, { data: [{ van: dag(50), tot: dag(65) }] }],     // geen plafond: Dirk sloot op prijs niets uit
    [G, { plafond: 180000, data: venster, voorkeuren: ['eten'] }]
  ];
  for (const [wie, o] of opgaven) assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: o }, wie.token)).status, 200, wie.naam);
  const duur = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Boutiquehotel', prijsPP: 130000, van: dag(60), tot: dag(64) } }, A.token);
  const feest = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Feestweek', prijsPP: 90000, van: dag(60), tot: dag(64), kenmerken: ['nachtleven'] } }, A.token);
  opties.duur = duur.body.optie.id; opties.feest = feest.body.optie.id;

  const per = {};
  for (const wie of [A, B, C, D, G]) per[wie.naam] = await beeld(wie);
  const o = (b, id) => b.opties.find(x => x.id === id);

  assert.equal(per.Anna.vastTeStellen, true);
  assert.equal(o(per.Anna, opties.zee).voorIedereen, true, 'de villa past iedereen');
  assert.equal(o(per.Anna, opties.duur).voorIedereen, false, 'het hotel past niet iedereen');
  assert.equal(o(per.Anna, opties.feest).voorIedereen, false, 'de feestweek past niet iedereen');

  // DE DRAGENDE BEWERING: buiten voorJou is het beeld voor iedereen gelijk
  const ijk = zonderJou(per.Anna);
  for (const naam of Object.keys(per)) assert.equal(zonderJou(per[naam]), ijk, naam + ' kreeg een ander groepsbeeld');

  // Bram hoort zijn eigen redenen, en alleen hij
  assert.deepEqual(o(per.Bram, opties.duur).voorJou.redenen, ['De prijs per persoon ligt boven jouw plafond.']);
  assert.match(o(per.Bram, opties.feest).voorJou.redenen[0], /liever niet hebt: nachtleven/);
  for (const naam of ['Anna', 'Cees', 'Dirk', 'Gijs']) {
    const t = JSON.stringify(per[naam]);
    assert.ok(!/plafond\.|liever niet hebt/.test(t), naam + ' ziet de reden van een ander');
    assert.ok(!t.includes('120000'), naam + ' ziet het plafond van Bram');
    for (const x of [A, B, C, D, G]) assert.ok(!t.includes(x.codenaam), naam + ' ziet een codenaam in het groepsbeeld');
  }
  assert.deepEqual(per.Anna.venster, [{ van: dag(58), tot: dag(65) }], 'de dagen waarop iedereen die data opgaf kan');
});

test('4. de reiziger kan de grens van de groep niet ongelimiteerd uithoren', async () => {
  /* De aanval: dezelfde optie steeds met een andere prijs. Drie toetsingen zijn
     al gebruikt (toets 2 en 3); bij de zesde houdt het op. */
  const zelfde = await api('/api/reis/gezelschap/opties/zet', { reis: REIS, id: opties.duur,
    optie: { titel: 'Boutiquehotel', prijsPP: 130000, van: dag(60), tot: dag(64) } }, A.token);
  assert.equal(zelfde.body.getoetst, false, 'een ongewijzigde optie kost geen toetsing');
  const dubbeltik = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Villa aan zee', prijsPP: 100000, van: dag(60), tot: dag(64), kenmerken: ['strand'] } }, A.token);
  assert.equal(dubbeltik.body.optie.id, opties.zee, 'een tweede druk op nieuw maakt geen tweede villa');
  assert.equal(dubbeltik.body.getoetst, false);
  const uitkomst = [];
  for (const prijs of [125000, 122500, 121000]) {
    const r = await api('/api/reis/gezelschap/opties/zet', { reis: REIS, id: opties.duur,
      optie: { titel: 'Boutiquehotel', prijsPP: prijs, van: dag(60), tot: dag(64) } }, A.token);
    assert.equal(r.status, 200, 'proef ' + prijs);
    uitkomst.push((await beeld(A)).opties.find(x => x.id === opties.duur).voorIedereen);
  }
  // in stappen van EUR 50: 1225 en 1210 tellen allebei als 1250, dus het verschil is niet te zien
  assert.deepEqual(uitkomst, [false, false, false], 'onder de EUR 50 leert de proef niets');
  const geweigerd = await api('/api/reis/gezelschap/opties/zet', { reis: REIS, id: opties.duur,
    optie: { titel: 'Boutiquehotel', prijsPP: 120500, van: dag(60), tot: dag(64) } }, A.token);
  assert.equal(geweigerd.status, 429, 'de zevende proef in een etmaal wordt geweigerd');
  assert.match(geweigerd.body.error, /uithoren/);
  assert.ok(geweigerd.body.weerVanaf, 'en hij zegt wanneer het weer kan');
  // en Bram ziet dat er geprobeerd is
  const b = await beeld(B);
  assert.deepEqual(b.toetsingen, { afgelopenEtmaal: 6, max: R.MAX_TOETSEN });
  assert.match(b.grens, /niet zien van wie/, 'de rest van het lek staat er hardop bij');
});

test('5. wie vertrekt, telt niet meer mee', async () => {
  assert.equal((await api('/api/reis/gezelschap/weg', { id: B.uitnodiging }, B.token)).status, 200);
  const b = await beeld(A);
  assert.equal(b.deelnemers, 4);
  assert.equal(b.opties.find(x => x.id === opties.feest).voorIedereen, true, 'zonder Bram past de feestweek wel');
});

test('6. de rekenregels zelf: grove stappen, data binnen een periode, en de drempel', () => {
  const optie = { prijsPP: 120000, van: '2027-01-10', tot: '2027-01-12', kenmerken: [] };
  assert.equal(R.pastBij(optie, { plafond: 120000 }).past, true);
  assert.equal(R.pastBij(Object.assign({}, optie, { prijsPP: 120001 }), { plafond: 124999 }).past, false,
    'een prijs telt naar boven en een plafond naar beneden: bij twijfel past hij niet');
  assert.equal(R.pastBij(optie, { data: [{ van: '2027-01-11', tot: '2027-01-20' }] }).past, false);
  assert.equal(R.pastBij(optie, {}).past, true, 'wie niets opgaf, sloot niets uit');
  assert.deepEqual(R.gedeeldVenster([{ data: [{ van: '2027-01-01', tot: '2027-01-05' }] },
    { data: [{ van: '2027-01-04', tot: '2027-01-09' }] }, { data: [] }]), [{ van: '2027-01-04', tot: '2027-01-05' }]);
  // twee deelnemers die allebei iets opgaven: toch geen groepsuitkomst
  const db = { data: {} };
  const m = R.maakGezelschapOpties({ db, save() {}, klok: { datum: () => new Date('2027-01-01') }, crypto: require('crypto'),
    reisVan: (k) => k === 'a' ? {} : null,
    opgave: { VOORKEUREN: ['strand'], deelnameVan: () => ({ eigenaar: 'a' }),
      voorDeBerekening: () => [{ key: 'a', opgave: { plafond: 1 } }, { key: 'b', opgave: { plafond: 2 } }] } });
  m.zetOptie('a', 'r', { titel: 'x', prijsPP: 100, van: '2027-02-01', tot: '2027-02-02' });
  const b = m.groepsbeeld('a', 'r');
  assert.equal(b.vastTeStellen, false);
  assert.match(b.waaromNiet, /vanaf 3 deelnemers/);
  assert.equal(b.opties[0].voorIedereen, null);
});
