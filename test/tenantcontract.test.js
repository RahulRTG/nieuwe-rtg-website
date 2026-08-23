/* HET CONTRACT EN HET QUOTUM -- wat een tenant mag, en hoeveel.

   Twee beweringen die van buiten niet te zien zijn, en allebei gaan ze over wat
   er NIET gebeurt:

   1. EEN VERLOPEN CONTRACT IS GEEN NOODKNOP. Het weigert nieuwe inrichting, en
      verder niets: wie er werkt blijft werken en de uitvoer blijft open. Zou een
      factuur dat wel kunnen, dan hebben wij een knop waarmee we het bedrijf van
      een klant stilleggen -- en die knop hoort niet te bestaan.
   2. HET QUOTUM RAAKT DE UITVOER NOOIT. Exit-recht dat op een teller kan
      stuklopen is geen recht.

   Het BIJTEN van het quotum wordt zonder server gemeten (toets 5 en 6): de
   ondergrens van een pakket is tweeduizend verzoeken per uur, en die over de
   lijn opwekken zou de toets minutenlang laten draaien om iets te bewijzen dat
   in de teller zelf zit.

   Draai los: node --experimental-sqlite --test test/tenantcontract.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const maakContract = require('../server/kern/tenant/contract');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contract-'));
let srv, base, tech, een, twee, beheer, lidToken;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const bedrijf = (pad, body) => api('/api/bedrijf' + pad, body);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const a = await bedrijf('/werkruimte/maak', { naam: 'Eerste' });
  een = a.body.werkruimte; beheer = a.body.beheerToken;
  const b = await bedrijf('/werkruimte/maak', { naam: 'Tweede' });
  twee = b.body.werkruimte;
  const l = await bedrijf('/lid/aanmeld', { werkruimte: een, naam: 'Pia' });
  lidToken = l.body.lidToken;
  await bedrijf('/lid/besluit', { werkruimte: een, beheerToken: beheer, lidId: l.body.lidId, akkoord: true });
  await api('/api/techniek/tenant', { org: 'O-C', naam: 'Contractklant' }, tech);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het pakket bepaalt hoeveel werkruimtes er onder een tenant passen', async () => {
  const c = await api('/api/techniek/tenant/contract', { org: 'O-C' }, tech);
  assert.equal(c.status, 200);
  assert.equal(c.body.contract.pakket, 'proef', 'een nieuwe tenant staat op proef');
  assert.equal(c.body.contract.grenzen.werkruimtes, 1);

  assert.equal((await api('/api/techniek/tenant/bind',
    { org: 'O-C', soort: 'werkruimte', code: een }, tech)).status, 200);

  const tweedeKeer = await api('/api/techniek/tenant/bind',
    { org: 'O-C', soort: 'werkruimte', code: twee }, tech);
  assert.equal(tweedeKeer.status, 402, 'de tweede past niet in het pakket');
  assert.match(tweedeKeer.body.error, /proef/);

  /* EEN ZAAK REKENT NIET MEE, en dat is geen vergeetachtigheid: een
     leverancierscode is een relatie en geen productinstantie. */
  await api('/api/techniek/tenant/bind', { org: 'O-C', soort: 'zaak', code: 'KIKUNOI' }, tech);
  const na = await api('/api/techniek/tenant/contract', { org: 'O-C' }, tech);
  assert.equal(na.body.contract.verbruik.werkruimtes, 1, 'de zaak telt niet mee als werkruimte');
});

test('2. een uitzondering gaat alleen omhoog, en met een reden', async () => {
  const omlaag = await api('/api/techniek/tenant/contract',
    { org: 'O-C', werkruimtes: 0, reden: 'Bezuiniging.' }, tech);
  assert.equal(omlaag.status, 400, 'onder het pakket duiken kan niet');

  const zonderReden = await api('/api/techniek/tenant/contract', { org: 'O-C', werkruimtes: 3 }, tech);
  assert.equal(zonderReden.status, 400, 'meer dan het pakket vraagt een reden');

  const met = await api('/api/techniek/tenant/contract',
    { org: 'O-C', werkruimtes: 3, reden: 'Pilot met drie vestigingen, afgesproken met de directie.' }, tech);
  assert.equal(met.status, 200);
  assert.equal(met.body.contract.grenzen.werkruimtes, 3);
  assert.equal((await api('/api/techniek/tenant/bind',
    { org: 'O-C', soort: 'werkruimte', code: twee }, tech)).status, 200, 'en nu past de tweede wel');

  /* EEN PAKKETWISSEL ZET DE UITZONDERING TERUG. Anders blijft een ruimere grens
     die ooit bij een pilot hoorde stilletjes staan, en klopt de factuur niet
     meer bij wat de klant kan. */
  await api('/api/techniek/tenant/contract', { org: 'O-C', pakket: 'proef' }, tech);
  const terug = await api('/api/techniek/tenant/contract', { org: 'O-C' }, tech);
  assert.equal(terug.body.contract.grenzen.werkruimtes, 1, 'de uitzondering is weg na de wissel');
});

test('3. een verlopen contract weigert inrichting en sluit niemand buiten', async () => {
  await api('/api/techniek/tenant/contract', { org: 'O-C', tot: '2020-01-01' }, tech);
  const c = await api('/api/techniek/tenant/contract', { org: 'O-C' }, tech);
  assert.equal(c.body.contract.loopt, false);
  assert.match(c.body.contract.let, /geen nieuwe inrichting/);

  const derde = await bedrijf('/werkruimte/maak', { naam: 'Derde' });
  const bind = await api('/api/techniek/tenant/bind',
    { org: 'O-C', soort: 'werkruimte', code: derde.body.werkruimte }, tech);
  assert.equal(bind.status, 402, 'er komt niets meer bij');
  assert.match(bind.body.error, /verlopen/);

  /* DE TWEE DINGEN DIE EEN FACTUUR NOOIT MAG RAKEN. */
  const werkt = await bedrijf('/start', { werkruimte: een, lidToken });
  assert.equal(werkt.status, 200, 'wie er werkt blijft werken');
  const uit = await api('/api/tenant/export', { werkruimte: een, beheerToken: beheer });
  assert.equal(uit.status, 200, 'en de uitvoer blijft open');

  await api('/api/techniek/tenant/contract', { org: 'O-C', tot: null }, tech);
});

test('4. het verbruik wordt geteld, en de uitvoer telt niet mee', async () => {
  const lees = async () => (await api('/api/tenant/bootstrap', { werkruimte: een, lidToken })).body.bootstrap.contract.verbruik.apiDitUur;

  const voor = await lees();                       // deze aanroep telt zelf ook mee
  await api('/api/tenant/export', { werkruimte: een, beheerToken: beheer });
  const na = await lees();

  /* Twee leesaanroepen tellen mee, de uitvoer ertussen niet. Zou de export wel
     tellen, dan staat hier 3 -- en dan kan een klant zijn eigen exit-recht
     opmaken. */
  assert.equal(na - voor, 1, 'alleen de tweede leesaanroep kwam erbij (' + voor + ' -> ' + na + ')');
});

/* ---------- de teller zelf, zonder server ---------- */
function opzet(grens) {
  const db = { data: { tenants: { 'O-Q': { org: 'O-Q', naam: 'Q', werkruimtes: [], zaken: [], groepen: [], bij: new Date().toISOString() } } } };
  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n).trim();
  const schrijfsels = { n: 0 };
  const contract = maakContract({ db, save: () => { schrijfsels.n++; }, schoon });
  contract.van('O-Q');                                        // maakt het contractvak aan
  db.data.tenants['O-Q'].contract.apiPerUur = grens;          // een grens die in een toets te halen is
  return { db, contract, schrijfsels };
}

test('5. de teller bijt op zijn grens, en telt per uur', () => {
  const { db, contract } = opzet(3);
  for (let i = 1; i <= 3; i++) {
    const r = contract.tel('O-Q');
    assert.equal(r.ok, true, 'verzoek ' + i + ' mag');
    assert.equal(r.gebruikt, i);
  }
  const over = contract.tel('O-Q');
  assert.equal(over.ok, false, 'het vierde niet');
  assert.match(over.reden, /uurgrens/);
  assert.match(over.reden, /Uitvoer van uw gegevens wordt nooit geweigerd/,
    'en het antwoord zegt erbij wat er WEL doorgaat');
  assert.equal(db.data.tenants['O-Q'].contract.teller.geweigerd, 1, 'een weigering wordt geteld');

  // een uur verder: de teller begint opnieuw
  db.data.tenants['O-Q'].contract.teller.uur -= 1;
  assert.equal(contract.tel('O-Q').ok, true, 'volgend uur mag het weer');
});

test('6. de teller staat in de OPSLAG en niet in het geheugen van dit proces', () => {
  /* Een teller die bij elke herstart op nul begint is geen quotum maar een
     suggestie -- en juist een tenant die te hard loopt, veroorzaakt de
     herstart. Dit is de proef: een TWEEDE contractlaag op dezelfde opslag ziet
     wat de eerste heeft geteld, precies zoals een verse start dat zou doen. */
  const { db, contract } = opzet(10);
  contract.tel('O-Q'); contract.tel('O-Q');

  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n).trim();
  const opnieuw = maakContract({ db, save: () => {}, schoon });
  assert.equal(opnieuw.van('O-Q').verbruik.apiDitUur, 2, 'de nieuwe laag leest de bestaande stand');
  assert.equal(opnieuw.tel('O-Q').gebruikt, 3, 'en telt verder waar de vorige ophield');
});

test('7. een werkruimte zonder tenant kent geen grens en geen teller', () => {
  const { contract } = opzet(1);
  const r = contract.tel('O-BESTAATNIET');
  assert.equal(r.ok, true);
  assert.equal(r.buitenContract, true, 'en zegt dat met zoveel woorden');
});

test('8. de teller schrijft niet bij elk verzoek naar schijf', () => {
  /* DIT IS EEN PRESTATIEREGEL MET EEN GRENS, en hij staat er omdat de eerste
     versie hem overtrad: tel() riep save() bij ELK verzoek aan, en save() loopt
     bij SQLite langs een JSON.stringify van elke collectie. Daarmee werd elke
     LEESactie in een werkruimte een schrijfactie op het hele bestand -- het
     soort regressie dat pas bij een drukke klant zichtbaar wordt.

     Wat het kost staat er ook: bij een herstart gaan hooguit VLOEDLIJN-1
     tellingen verloren. Dat is de juiste prijs voor een eerlijkheidsgrens; wat
     het NIET mag zijn is een teller die bij nul begint. */
  const { contract, schrijfsels } = opzet(10000);
  const V = contract.VLOEDLIJN;

  contract.tel('O-Q');
  assert.equal(schrijfsels.n, 1, 'het eerste verzoek van een uur gaat wel naar schijf');

  for (let i = 2; i < V; i++) contract.tel('O-Q');
  assert.equal(schrijfsels.n, 1, 'de ' + (V - 2) + ' daarna niet');

  contract.tel('O-Q');
  assert.equal(schrijfsels.n, 2, 'op de vloedlijn wel');
  assert.ok(V >= 10 && V <= 100, 'en de vloedlijn is een redelijk getal: ' + V);
});

test('9. een weigering gaat altijd naar schijf', () => {
  /* Zeldzaam en zwaar: dat een tenant tegen zijn grens liep, is precies het
     feit dat een herstart niet mag wissen. */
  const { contract, schrijfsels } = opzet(1);
  contract.tel('O-Q');
  const voor = schrijfsels.n;
  const over = contract.tel('O-Q');
  assert.equal(over.ok, false);
  assert.equal(schrijfsels.n, voor + 1, 'de weigering is weggeschreven');
});
