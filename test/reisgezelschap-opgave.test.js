/* ============================================================================
   DE PRIVE-INVOER VAN EEN REISGENOOT, over de draad (kern/reisgezelschap-opgave.js).

   Stap 1 van "Five People. Five Private Contexts. One Shared Outcome": ieder
   lid van een gezelschap geeft zijn eigen plafond, data en voorkeuren op, en
   NIEMAND ANDERS krijgt die te zien. Dat laatste is de bewering die telt, en
   hij is niet te bewijzen door naar een route te kijken die de invoer
   teruggeeft -- er is er met opzet geen voor een ander. Hij is alleen te
   bewijzen door een ONDERSCHEIDEND bedrag op te geven en dan bij elke route
   van het gezelschap, met de sessie van elk ander lid, te kijken of het ergens
   terugkomt (toets 4).

   Vijf mensen, zoals in de demo: Anna is de reiziger, Bram, Cees en Dirk reizen
   mee, Eva kijkt mee, en Frits hoort er niet bij.

   Draai los: node --test test/reisgezelschap-opgave.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { keur, VOORKEUREN } = require('../server/kern/reisgezelschap-opgave');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisinvoer-'));
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let srv, base, kantoor, REIS;
let A, B, C, D, E, F;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})), tekst: '' }));

const OPGAVE_PADEN = ['/api/reis/gezelschap/opgave', '/api/reis/gezelschap/opgave/zet',
  '/api/reis/gezelschap/opgave/wis', '/api/reis/gezelschap/opgave/voortgang'];
/* Elke leesweg van het gezelschap waar een ander lid iets terugkrijgt. Toets 4
   loopt ze allemaal af; een nieuwe route die invoer zou lekken, hoort hier bij. */
const LEESPADEN = ['/api/reis/gezelschap', '/api/reis/gezelschap/reis', '/api/reis/gezelschap/tijdlijn',
  '/api/reis/gezelschap/kring', '/api/reis/gezelschap/beleid', '/api/reis/gezelschap/opgave',
  '/api/reis/gezelschap/opgave/voortgang', '/api/reis/reizen', '/api/reis/wereld'];

async function nieuwLid(naam) {
  const u = naam + Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 5);
  const r = await api('/api/auth/register', { name: naam, email: u + '@x.nl',
    phone: '06' + String(Date.now()).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01' });
  assert.equal(r.status, 200, naam + ' kon zich niet aanmelden: ' + JSON.stringify(r.body));
  const codenaam = r.body && r.body.state && r.body.state.user && r.body.state.user.codename;
  assert.ok(codenaam, naam + ' kreeg geen codenaam terug');
  const lid = { naam, token: r.body.token, codenaam };
  await api('/api/reis/gezelschap/kring', {}, lid.token);   // zet hem in de ledengids
  return lid;
}
async function doeMee(lid, rol) {
  const uit = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: lid.codenaam, rol }, A.token);
  assert.equal(uit.status, 200, JSON.stringify(uit.body));
  const ja = await api('/api/reis/gezelschap/antwoord', { id: uit.body.lid.id, ja: true }, lid.token);
  assert.equal(ja.status, 200);
  return uit.body.lid.id;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  kantoor = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(kantoor, 'het kantoor logt niet in');
  A = await nieuwLid('Anna'); B = await nieuwLid('Bram'); C = await nieuwLid('Cees');
  D = await nieuwLid('Dirk'); E = await nieuwLid('Eva'); F = await nieuwLid('Frits');
  assert.equal(new Set([A, B, C, D, E, F].map(x => x.codenaam)).size, 6, 'twee leden delen een codenaam');
  const zet = await api('/api/office/reisbureau/klaarzetten', { onderdelen: [
    { soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' }
  ] }, kantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal((await api('/api/reis/uitnodiging/eisop', { code: zet.body.link.split('code=')[1] }, A.token)).status, 200);
  REIS = (await api('/api/reis/reizen', {}, A.token)).body.reizen[0].id;
  assert.ok(REIS, 'Anna heeft geen reis');
  for (const x of [B, C, D]) x.uitnodiging = await doeMee(x, 'reisgenoot');
  E.uitnodiging = await doeMee(E, 'meekijker');
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. de vier invoerroutes zitten achter een sessie', async () => {
  for (const pad of OPGAVE_PADEN) {
    const r = await api(pad, { reis: REIS, opgave: { plafond: 1000 } });
    assert.equal(r.status, 401, pad + ' antwoordde zonder sessie');
  }
});

test('2. alleen wie meereist geeft iets op: een meekijker en een buitenstaander niet', async () => {
  for (const wie of [E, F]) {
    for (const pad of OPGAVE_PADEN) {
      const r = await api(pad, { reis: REIS, opgave: { plafond: 1000 } }, wie.token);
      assert.equal(r.status, 404, wie.naam + ' op ' + pad + ': ' + JSON.stringify(r.body));
    }
  }
});

test('3. een ongeldige opgave wordt geweigerd met de reden, en niet stil verbeterd', async () => {
  const fout = [
    [{ plafond: -5 }, /heel aantal centen/],
    [{ plafond: 12.5 }, /heel aantal centen/],
    [{ data: [{ van: dag(10), tot: dag(5) }] }, /eindigt niet voor/],
    [{ data: [{ van: 'morgen', tot: dag(5) }] }, /JJJJ-MM-DD/],
    [{ voorkeuren: ['casino'] }, /staat niet in de lijst/],
    [{ voorkeuren: ['strand'], nietGraag: ['strand'] }, /niet tegelijk/]
  ];
  for (const [invoer, reden] of fout) {
    const r = await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: invoer }, B.token);
    assert.equal(r.status, 400, JSON.stringify(invoer));
    assert.match(r.body.error, reden);
  }
  const leeg = await api('/api/reis/gezelschap/opgave', { reis: REIS }, B.token);
  assert.equal(leeg.body.invoer, null, 'een geweigerde opgave liet toch iets achter');
  assert.deepEqual(leeg.body.keuzes, VOORKEUREN, 'het lid krijgt de gesloten lijst mee');
  assert.match(leeg.body.wieZiet, /geen versleutelde berekening/, 'de belofte zegt wat hij niet is');
});

test('4. het plafond van een deelnemer komt bij geen enkel ander lid terug, op geen enkele route', async () => {
  /* Een bedrag dat nergens anders in deze wereld voorkomt, en de data als
     tweede merkteken. Wie het ergens terugziet, ziet het lek. */
  const PLAFOND = 7364219;
  const VAN = dag(123), TOT = dag(131);
  const zet = await api('/api/reis/gezelschap/opgave/zet', { reis: REIS,
    opgave: { plafond: PLAFOND, data: [{ van: VAN, tot: TOT }], voorkeuren: ['rust'], nietGraag: ['nachtleven'] } }, B.token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal(zet.body.invoer.plafond, PLAFOND);

  // Bram ziet het zelf terug: anders bewijst de afwezigheid hieronder niets
  const eigen = await api('/api/reis/gezelschap/opgave', { reis: REIS }, B.token);
  assert.equal(eigen.body.invoer.plafond, PLAFOND, 'de eigen invoer is leesbaar voor de eigenaar ervan');

  for (const wie of [A, C, D, E, F]) {
    for (const pad of LEESPADEN) {
      const r = await api(pad, { reis: REIS }, wie.token);
      const tekst = JSON.stringify(r.body);
      assert.ok(!tekst.includes(String(PLAFOND)), wie.naam + ' ziet het plafond van Bram via ' + pad);
      assert.ok(!tekst.includes(VAN) && !tekst.includes(TOT), wie.naam + ' ziet de data van Bram via ' + pad);
    }
  }
});

test('5. de voortgang is een aantal en draagt geen namen', async () => {
  const r = await api('/api/reis/gezelschap/opgave/voortgang', { reis: REIS }, A.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.deelnemers, 4, 'Anna plus drie reisgenoten; de meekijker telt niet mee');
  assert.equal(r.body.ingevuld, 1, 'alleen Bram vulde iets in');
  const tekst = JSON.stringify(r.body);
  for (const x of [A, B, C, D, E]) assert.ok(!tekst.includes(x.codenaam), 'de voortgang noemt ' + x.naam);
  // een reisgenoot krijgt hetzelfde getal, niet meer
  const vanC = await api('/api/reis/gezelschap/opgave/voortgang', { reis: REIS }, C.token);
  assert.deepEqual({ d: vanC.body.deelnemers, i: vanC.body.ingevuld }, { d: 4, i: 1 });
});

test('6. hetzelfde nog eens opgeven verandert niets; een echte wijziging telt een versie', async () => {
  const opgave = { plafond: 90000, voorkeuren: ['strand', 'eten'] };
  const een = await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave }, D.token);
  assert.equal(een.body.invoer.versie, 1);
  const twee = await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave }, D.token);
  assert.equal(twee.body.gewijzigd, false, 'een dubbeltik is geen nieuwe opgave');
  assert.equal(twee.body.invoer.versie, 1);
  const drie = await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: { plafond: 85000, voorkeuren: ['strand', 'eten'] } }, D.token);
  assert.equal(drie.body.gewijzigd, true);
  assert.equal(drie.body.invoer.versie, 2);
  const wis = await api('/api/reis/gezelschap/opgave/wis', { reis: REIS }, D.token);
  assert.equal(wis.status, 200);
  const nogEens = await api('/api/reis/gezelschap/opgave/wis', { reis: REIS }, D.token);
  assert.equal(nogEens.status, 200, 'twee keer wissen laat dezelfde lege stand achter');
  assert.equal((await api('/api/reis/gezelschap/opgave', { reis: REIS }, D.token)).body.invoer, null);
});

test('7. wie uit het gezelschap gaat, neemt zijn invoer mee', async () => {
  assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: { plafond: 55555 } }, C.token)).status, 200);
  const voor = (await api('/api/reis/gezelschap/opgave/voortgang', { reis: REIS }, A.token)).body;
  assert.equal((await api('/api/reis/gezelschap/weg', { id: C.uitnodiging }, A.token)).status, 200);
  assert.equal((await api('/api/reis/gezelschap/opgave', { reis: REIS }, C.token)).status, 404, 'Cees reist niet meer mee');
  const na = (await api('/api/reis/gezelschap/opgave/voortgang', { reis: REIS }, A.token)).body;
  assert.deepEqual({ d: na.deelnemers, i: na.ingevuld }, { d: voor.deelnemers - 1, i: voor.ingevuld - 1 });
  // komt hij terug, dan begint hij leeg: er bleef niets van hem staan
  C.uitnodiging = await doeMee(C, 'reisgenoot');
  assert.equal((await api('/api/reis/gezelschap/opgave', { reis: REIS }, C.token)).body.invoer, null,
    'de oude invoer van Cees stond er nog');
});

test('8. de keuring zelf: wat er niet is opgegeven blijft leeg, en dubbele keuzes vallen samen', () => {
  assert.deepEqual(keur({}).invoer, { plafond: null, data: [], voorkeuren: [], nietGraag: [] });
  assert.deepEqual(keur({ voorkeuren: ['rust', 'rust'] }).invoer.voorkeuren, ['rust']);
  assert.ok(keur({ data: new Array(7).fill({ van: '2026-01-01', tot: '2026-01-02' }) }).fout);
});
