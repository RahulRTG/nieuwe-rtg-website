/* ============================================================================
   INSTEMMEN OP EEN VASTE VERSIE, over de draad (kern/reisgezelschap-instemming.js).

   Stap 4 van "Five People. Five Private Contexts. One Shared Outcome". Vijf
   deelnemers, en een besluit is pas een besluit als ieder van hen apart
   instemde op precies dezelfde versie. Wat hier wordt vastgehouden:
   - alleen de reiziger legt voor, en alleen een optie die voor iedereen past;
   - ieder stemt in op de versie en vingerafdruk die hij zag, en alleen voor zichzelf;
   - een wijziging na vier instemmingen laat ze alle vier vervallen;
   - vijf instemmingen tegelijk leveren een besluit op, en herhalen verandert niets;
   - wie zijn wensen bijstelt, of vertrekt, laat de versie vervallen;
   - een nee is voor de anderen niet te onderscheiden van nog-geen-antwoord;
   - wie zijn instemming terugneemt, maakt van een besluit weer een open voorstel.
   Draai los: node --test test/reisgezelschap-instemming.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisinstem-'));
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



const vl = (b) => b.groep.voorlegging;
const legVoor = (optie, wie) => api('/api/reis/gezelschap/voorstel/leg', { reis: REIS, optie }, (wie || A).token);
const instem = (wie, v, ja) => api('/api/reis/gezelschap/instem', { reis: REIS, versie: v.versie, vingerafdruk: v.vingerafdruk, ja: ja !== false }, wie.token);
const iedereen = () => [A, B, C, D, G];

test('1. alleen de reiziger legt voor, en alleen een optie die voor iedereen past', async () => {
  const zee = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Villa aan zee', prijsPP: 100000, van: dag(60), tot: dag(64), kenmerken: ['strand'] } }, A.token);
  const duur = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Boutiquehotel', prijsPP: 130000, van: dag(60), tot: dag(64) } }, A.token);
  opties.zee = zee.body.optie.id; opties.duur = duur.body.optie.id;
  const tevroeg = await legVoor(opties.zee);
  assert.equal(tevroeg.status, 409, 'voor iedereen iets opgaf'); assert.match(tevroeg.body.error, /Nog niet iedereen/);
  for (const [wie, o] of [[A, { plafond: 150000 }], [B, { plafond: 120000 }], [C, { plafond: 200000 }], [D, {}], [G, { plafond: 180000 }]]) {
    assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: o }, wie.token)).status, 200, wie.naam);
  }
  assert.equal((await legVoor(opties.zee, B)).status, 404, 'een reisgenoot legt niets voor');
  const past = await legVoor(opties.duur);
  assert.equal(past.status, 409); assert.match(past.body.error, /past niet voor iedereen/);
  const een = await legVoor(opties.zee);
  assert.equal(een.status, 200); assert.equal(een.body.versie, 1); assert.equal(een.body.nieuw, true);
  const dubbel = await legVoor(opties.zee);
  assert.equal(dubbel.body.versie, 1, 'een dubbeltik maakt geen tweede versie'); assert.equal(dubbel.body.nieuw, false);
});

test('2. ieder stemt zelf in op de versie die hij zag; een nee is voor anderen niet te zien', async () => {
  const v = vl(await beeld(A));
  assert.equal(v.stand, 'open'); assert.deepEqual(v.instemmingen, { ja: 0, totaal: 5 });
  const fout = await api('/api/reis/gezelschap/instem', { reis: REIS, versie: 1, vingerafdruk: 'verzonnen', ja: true }, B.token);
  assert.equal(fout.status, 409, 'een andere vingerafdruk is een ander voorstel');
  assert.equal((await api('/api/reis/gezelschap/instem', { reis: REIS, versie: 1, vingerafdruk: v.vingerafdruk, ja: true }, E.token)).status, 404, 'een meekijker');
  assert.equal((await api('/api/reis/gezelschap/instem', { reis: REIS, versie: 1, vingerafdruk: v.vingerafdruk, ja: true }, F.token)).status, 404, 'een buitenstaander');
  assert.equal((await instem(A, v)).status, 200);
  assert.equal((await instem(B, v, false)).status, 200, 'Bram zegt nee');
  const per = {};
  for (const wie of iedereen()) per[wie.naam] = await beeld(wie);
  for (const [naam, b] of Object.entries(per)) {
    assert.deepEqual(vl(b).instemmingen, { ja: 1, totaal: 5 }, naam);
    assert.equal(gedeeld(b), gedeeld(per.Anna), naam + ' ziet een ander groepsbeeld');
  }
  assert.equal(per.Anna.jij.instemming, 'ja'); assert.equal(per.Bram.jij.instemming, 'nee'); assert.equal(per.Cees.jij.instemming, null);
  for (const naam of ['Anna', 'Cees', 'Dirk', 'Gijs']) {
    const t = JSON.stringify(per[naam]);
    assert.ok(!/stemde niet in/.test(per[naam].uitleg.join(' ')), naam + ' hoort van een nee');
    assert.ok(!t.includes(B.codenaam), naam + ' ziet wie');
  }
  assert.match(per.Bram.uitleg.join(' '), /U stemde niet in\./);
});

test('3. een wijziging na vier instemmingen laat ze alle vier vervallen', async () => {
  let v = vl(await beeld(A));
  for (const wie of [B, C, D]) assert.equal((await instem(wie, v)).status, 200, wie.naam);
  assert.deepEqual(vl(await beeld(A)).instemmingen, { ja: 4, totaal: 5 });
  // de reiziger maakt de villa iets goedkoper: hij past nog steeds, maar is niet meer dezelfde
  assert.equal((await api('/api/reis/gezelschap/opties/zet', { reis: REIS, id: opties.zee,
    optie: { titel: 'Villa aan zee', prijsPP: 95000, van: dag(60), tot: dag(64), kenmerken: ['strand'] } }, A.token)).status, 200);
  const na = await beeld(G);
  assert.equal(vl(na).stand, 'vervallen'); assert.match(vl(na).reden, /veranderd/);
  assert.deepEqual(vl(na).instemmingen, { ja: 0, totaal: 5 }, 'vervallen instemmingen tellen niet');
  const laat = await instem(G, v);
  assert.equal(laat.status, 409, 'Gijs stemt in op een versie die niet meer bestaat');
  const twee = await legVoor(opties.zee);
  assert.equal(twee.body.versie, 2);
  v = vl(await beeld(A));
  assert.equal(v.stand, 'open'); assert.deepEqual(v.instemmingen, { ja: 0, totaal: 5 }, 'oude instemmingen gaan niet mee');
  for (const wie of iedereen()) assert.equal((await beeld(wie)).jij.instemming, null, wie.naam);
});

test('4. vijf instemmingen tegelijk worden een besluit, en nog eens instemmen verandert niets', async () => {
  const v = vl(await beeld(A));
  const r = await Promise.all(iedereen().map(wie => instem(wie, v)));
  r.forEach((x, i) => { assert.equal(x.status, 200, iedereen()[i].naam); assert.equal(x.body.gewijzigd, true); });
  const b = await beeld(C);
  assert.equal(vl(b).stand, 'aangenomen'); assert.deepEqual(vl(b).instemmingen, { ja: 5, totaal: 5 });
  assert.match(b.uitleg.join(' '), /Iedereen stemde in met versie 2: Villa aan zee\. Dat is een besluit binnen het gezelschap; er is nog niets geboekt of betaald\./);
  const nog = await Promise.all(iedereen().map(wie => instem(wie, v)));
  nog.forEach(x => assert.equal(x.body.gewijzigd, false));
});

test('5. wie zijn instemming terugneemt, maakt van het besluit weer een open voorstel', async () => {
  assert.equal((await api('/api/reis/gezelschap/instem/terug', { reis: REIS }, D.token)).status, 200);
  const b = await beeld(A);
  assert.equal(vl(b).stand, 'open'); assert.deepEqual(vl(b).instemmingen, { ja: 4, totaal: 5 });
  assert.equal((await instem(D, vl(b))).status, 200);
  assert.equal(vl(await beeld(A)).stand, 'aangenomen');
});

test('6. wie zijn wensen bijstelt zodat het niet meer past, laat de versie vervallen', async () => {
  assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: { plafond: 80000 } }, C.token)).status, 200);
  const b = await beeld(A);
  assert.equal(vl(b).stand, 'vervallen'); assert.match(vl(b).reden, /past niet meer voor iedereen/);
  assert.ok(!JSON.stringify(b).includes('80000'), 'en niemand ziet waarom');
  assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: { plafond: 200000 } }, C.token)).status, 200);
});

test('7. wie vertrekt, laat de versie vervallen en neemt zijn instemming mee', async () => {
  assert.equal((await legVoor(opties.zee)).body.versie, 2, 'na het herstel van Cees geldt versie 2 weer');
  assert.equal((await api('/api/reis/gezelschap/weg', { id: G.uitnodiging }, G.token)).status, 200);
  const b = await beeld(A);
  assert.equal(vl(b).stand, 'vervallen'); assert.match(vl(b).reden, /gezelschap is veranderd/);
  assert.equal((await api('/api/reis/gezelschap/instem', { reis: REIS, versie: 2, vingerafdruk: vl(b).vingerafdruk, ja: true }, G.token)).status, 404);
  const drie = await legVoor(opties.zee);
  assert.equal(drie.body.versie, 3); assert.deepEqual(vl(await beeld(A)).instemmingen, { ja: 0, totaal: 4 });
});

test('8. de reiziger kan een voorstel intrekken; daarna valt er niets meer op in te stemmen', async () => {
  const v = vl(await beeld(A));
  assert.equal((await api('/api/reis/gezelschap/voorstel/trek', { reis: REIS }, B.token)).status, 404, 'een reisgenoot trekt niets in');
  assert.equal((await api('/api/reis/gezelschap/voorstel/trek', { reis: REIS }, A.token)).status, 200);
  assert.equal(vl(await beeld(B)).stand, 'ingetrokken');
  assert.equal((await instem(B, v)).status, 409);
});
