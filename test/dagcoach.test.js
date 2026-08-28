/* De dagcoach (kern/dagcoach.js). Wat hier wordt vastgezet is vooral wat hij
   NIET doet, want dat is de hele keuze:

   1. HIJ PLANT NIETS. Elke regel komt uit een laag die het lid al had; er komt
      geen enkel punt op de dag dat RTG zelf heeft bedacht.
   2. HIJ BEZIT NIETS. Er is geen route om iets af te vinken -- dat gebeurt in de
      laag die het ding bezit, anders liggen er twee waarheden over dezelfde dag.
   3. GEEN SCORE. Er staat hoeveel er open is, nergens "vier van de zeven".
   4. Een lege dag is een geldige uitkomst, en een kapotte laag wordt gemeld.
   Draai los: node --test test/dagcoach.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dag-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
  lid = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(lid && sup);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een verse dag verzint niets en zegt zelf dat RTG niet indeelt', async () => {
  const r = await api('dag', {}, lid);
  assert.equal(r.status, 200);
  /* Wat er WEL staat op een verse dag, staat er omdat een laag het aanbiedt:
     de dagmetingen en de check-in. Er staat geen enkel punt met een TIJD, want
     een tijd zou RTG zelf verzonnen moeten hebben. */
  assert.ok(!r.body.punten.some(p => p.tijd),
    'niets op een tijdstip: RTG plant geen ontbijt en geen wandeling');
  assert.ok(r.body.punten.every(p => ['metingen', 'checkin', 'gewoonten'].includes(p.bron)),
    'alles komt uit een bestaande laag: ' + r.body.punten.map(p => p.bron).join(', '));
  assert.match(r.body.uitleg, /deelt uw dag niet in/i);
  assert.deepEqual(r.body.storingen, [], 'en alle lagen doen het');
});

test('elke regel draagt waar hij vandaan komt en waar u hem afhandelt', async () => {
  const p = (await api('dag', {}, lid)).body.punten;
  assert.ok(p.length, 'er staat iets');
  for (const x of p) {
    assert.ok(x.bron, 'elke regel weet uit welke laag hij komt');
    assert.ok(x.naam && x.naar, 'en waar het lid hem afhandelt: ' + JSON.stringify(x));
    assert.match(x.naar, /^\/apps\//);
  }
});

test('een medicijn met een tijd komt op de klok te staan', async () => {
  await api('medicatie/zet', { naam: 'Metoprolol', sterkte: '50 mg', momenten: '07:30, 19:30' }, lid);
  const d = (await api('dag', {}, lid)).body;
  const opTijd = d.punten.filter(x => x.tijd);
  assert.deepEqual(opTijd.map(x => x.tijd), ['07:30', '19:30'], 'op volgorde van de klok');
  assert.ok(opTijd.every(x => x.bron === 'medicijnen'));
  assert.equal(opTijd[0].wat, 'Metoprolol 50 mg');
  /* Geen doseerinstructie op de dagregel. Het schema zegt wat er staat; wat het
     lid daarmee doet is aan het lid en aan de arts. */
  assert.ok(!/\bneem\b|innemen/i.test(JSON.stringify(opTijd)),
    'nergens een opdracht om iets in te nemen');
  assert.ok(d.punten.filter(x => !x.tijd).length, 'en wat geen tijd heeft, staat er nog steeds');
});

test('afvinken gebeurt in de eigen laag, en de dag ziet dat', async () => {
  /* De harde bewering: er is GEEN deur op de dagcoach om iets af te vinken. */
  assert.equal((await api('dag/af', { }, lid)).status, 404, 'geen afvink-route op de dagcoach');

  const id = (await api('medicatie', {}, lid)).body.middelen[0].id;
  await api('medicatie/af', { id, moment: '07:30', aan: true }, lid);
  const d = (await api('dag', {}, lid)).body;
  const rij = d.punten.find(x => x.tijd === '07:30');
  assert.equal(rij.gedaan, true, 'wat in Medicijnen is afgetekend, staat hier als gedaan');

  await api('medicatie/af', { id, moment: '07:30', aan: false }, lid);
  assert.equal((await api('dag', {}, lid)).body.punten.find(x => x.tijd === '07:30').gedaan, false,
    'en terugdraaien werkt ook maar op een plek');
});

test('een gewoonte krijgt geen verzonnen tijdstip', async () => {
  await api('gewoonten/maak', { naam: 'Even buiten', waarom: 'hoofd leeg' }, lid);
  const rij = (await api('dag', {}, lid)).body.punten.find(x => x.wat === 'Even buiten');
  assert.ok(rij, 'de gewoonte staat op de dag');
  assert.equal(rij.tijd, null,
    'zonder tijdstip: een gewoonte om kwart over drie zetten omdat het schema dan leeg is, is verzinnen');
  assert.equal(rij.gedaan, false);

  const gid = (await api('gewoonten', {}, lid)).body.gewoonten[0].id;
  await api('gewoonten/tik', { id: gid }, lid);
  assert.equal((await api('dag', {}, lid)).body.punten.find(x => x.wat === 'Even buiten').gedaan, true);
});

test('er staat een aantal, geen cijfer', async () => {
  const d = (await api('dag', {}, lid)).body;
  assert.equal(typeof d.open, 'number', 'hoeveel er open staat is een aantal dingen');
  assert.equal(d.open, d.punten.filter(p => !p.gedaan).length);

  /* Twee sloten, want een van de twee is te makkelijk te omzeilen. De eerste
     leest de TEKST: "vier van de zeven" in welke schrijfwijze dan ook. De
     tweede leest de VORM: het antwoord draagt precies deze velden en geen
     nieuw veld waar een cijfer in past. Alleen de tekstcontrole liet een
     "voortgang: 2 van de 5" er ongezien doorheen. */
  const alles = JSON.stringify(d);
  assert.ok(!/\d+\s*(van(\s+de)?|\/|op)\s*\d+/i.test(alles),
    'nergens "vier van de zeven": dat maakt van een dag een cijfer');
  assert.ok(!/percent|procent|score|voortgang|aandeel/i.test(alles), 'en geen score');
  assert.deepEqual(Object.keys(d).sort(),
    ['klok', 'kop', 'ok', 'open', 'punten', 'rust', 'storingen', 'uitleg', 'vandaag'],
    'en geen veld erbij waar stiekem een cijfer in kan');
});

test('de kop is een van de eerlijke uitkomsten, en stilte is er een van', async () => {
  const { kopVan } = require('../server/kern/dagcoach');
  assert.match(kopVan([], 0), /niets/i, 'een lege dag mag leeg heten');
  assert.match(kopVan([{ gedaan: true }], 0), /gedaan/i);
  assert.match(kopVan([{ gedaan: false, tijd: '09:00', geweest: false, wat: 'Iets' }], 1), /09:00/);
  assert.match(kopVan([{ gedaan: false, tijd: null }], 1), /een ding open/);
  assert.match(kopVan([{ gedaan: false, tijd: null }, { gedaan: false, tijd: null }], 2), /2 dingen open/);
});

test('een laag die het niet doet, wordt gemeld en niet als leegte getoond', async () => {
  /* Zonder deze regel ziet "geen afspraken" er hetzelfde uit als "de zorglaag
     is stuk", en dat is precies het verschil dat je wilt zien (LAT.md regel 5). */
  const dagcoach = require('../server/kern/dagcoach');
  const stuk = dagcoach({ kern: { medicatieVan: () => { throw new Error('boem'); } } });
  const d = stuk.dagVoor('k', 'CODE');
  assert.ok(d.storingen.some(s => /Medicijnen/.test(s) && /fout/i.test(s)),
    'de kapotte laag staat er met naam');
  assert.ok(d.storingen.some(s => /Gewoonten/.test(s) && /niet aangesloten/i.test(s)),
    'en een laag die er helemaal niet is, ook');
  assert.deepEqual(d.punten, [], 'en er wordt niets verzonnen om het gat te vullen');
});

test('niemand anders komt bij uw dag', async () => {
  assert.equal((await api('dag', {}, sup)).status, 401);
  assert.equal((await api('dag', {}, '')).status, 401);
});
