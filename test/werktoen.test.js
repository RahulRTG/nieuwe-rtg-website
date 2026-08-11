/* DE TIJDMACHINE EN DE UITVALANALYSE: twee vragen die niet meer beweren dan ze
   meten.

   TOEN (bedrijf/toen.js) -- de organisatie op een datum.
   1. HIJ ANTWOORDT OVER BESTAAN EN NIET OVER TOESTAND, en zegt dat zelf. Wat er
      op die dag stond is geteld uit het aanmaakmoment; of een contract toen al
      actief was, is niet vast te stellen.
   2. HIJ ERFT DE TWEE SCOPE-ASSEN. Wie een soort niet mag zien, ziet hem ook in
      het verleden niet.
   3. WAT NIET IN DE TIJD TE PLAATSEN IS, WORDT GETELD en verdwijnt niet stil
      uit de uitslag.

   UITVAL (bedrijf/uitval.js) -- wat valt er om als deze leverancier wegvalt.
   4. DE EERSTE STAP GAAT OP NAAM, EN DAT STAAT ERBIJ. Een leverancier bestaat
      hier niet als object; alles daarna loopt over echte sleutels, en per rij
      staat met "via" welke van de twee het was.
   5. DE KETEN LOOPT DOOR TOT DE KLANT EN ZIJN WERK -- gemeten, niet geraden.
   6. WAT DIT HUIS NIET WEET, STAAT ERBIJ: kans, kosten en onderaannemers.

   Draai los: node --experimental-sqlite --test test/werktoen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werktoen-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const vandaag = new Date().toISOString().slice(0, 10);

let W, B, DIR, JU, KLANT;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  DIR = { werkruimte: W, beheerToken: B };
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam: 'Joris' })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen: ['jurist'] });
  JU = { werkruimte: W, lidToken: a.lidToken };

  KLANT = (await api('/klant/zet', Object.assign({ naam: 'Havenbedrijf', branche: 'logistiek' }, DIR))).body.klant;
  await api('/contract/zet', Object.assign({ titel: 'Vervoer', wederpartij: 'Fjordlijn Transport',
    soort: 'leverancier', klantId: KLANT.id, eindigt: '2027-01-01', waarde: 120000 }, DIR));
  await api('/contract/zet', Object.assign({ titel: 'Koeling', wederpartij: 'Fjordlijn Transport',
    soort: 'leverancier', eindigt: '2027-06-01', waarde: 40000 }, DIR));
  await api('/contract/zet', Object.assign({ titel: 'Planten', wederpartij: 'Groenhof',
    soort: 'leverancier', eindigt: '2027-06-01' }, DIR));
  await api('/ticket/maak', Object.assign({ onderwerp: 'Lading te laat', klantId: KLANT.id }, DIR));
  await api('/kans/maak', Object.assign({ klantId: KLANT.id, titel: 'Uitbreiding noord', bedrag: 50000 }, DIR));
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. "toen" gaat over bestaan en niet over toestand, en zegt dat zelf', async () => {
  const nu = (await api('/toen', Object.assign({ datum: vandaag }, DIR))).body;
  const contract = nu.soorten.find(s => s.type === 'contract');
  assert.equal(contract.bestond, 3, 'alle drie de contracten bestonden vandaag');
  assert.equal(nu.wat, 'bestaan');
  assert.match(nu.let, /NIET de toestand van toen/i);
  assert.match(nu.let, /geen gebeurtenislaag/i, 'met de reden waarom dat niet kan');

  const eerder = (await api('/toen', Object.assign({ datum: '2020-01-01' }, DIR))).body;
  assert.equal(eerder.soorten.find(s => s.type === 'contract').bestond, 0,
    'in 2020 bestond er nog niets');
  assert.equal(eerder.soorten.find(s => s.type === 'contract').nu, 3, 'terwijl er nu drie zijn');
});

test('2. "toen" erft de twee scope-assen van het register', async () => {
  const joris = (await api('/toen', Object.assign({ datum: vandaag }, JU))).body;
  const soorten = joris.soorten.map(s => s.type).concat(joris.leeg);
  assert.ok(soorten.includes('contract'), 'de jurist ziet contracten');
  assert.ok(!soorten.includes('klant'), 'en klanten niet: die soort staat niet in zijn register');
});

test('3. wat niet in de tijd te plaatsen is, wordt geteld', async () => {
  const nu = (await api('/toen', Object.assign({ datum: vandaag }, DIR))).body;
  assert.equal(typeof nu.zonderDatum, 'number', 'er staat een telling');
  const perSoort = nu.soorten.every(s => typeof s.zonderDatum === 'number');
  assert.ok(perSoort, 'en per soort ook');
});

test('4. de eerste stap van de uitvalanalyse gaat op naam, en dat staat erbij', async () => {
  const u = (await api('/uitval', Object.assign({ wederpartij: 'Fjordlijn Transport' }, DIR))).body;
  assert.equal(u.contracten.length, 2, 'twee contracten op deze wederpartij');
  assert.equal(u.contracten[0].via, 'wederpartij op naam');
  assert.equal(u.waardeCenten, 16000000, 'met de opgetelde waarde uit de contracten zelf');
  assert.match(u.naamgrens.let, /bestaat in deze laag NIET als object/i);
});

test('5. de keten loopt door tot de klant en zijn werk, over echte sleutels', async () => {
  const u = (await api('/uitval', Object.assign({ wederpartij: 'Fjordlijn Transport' }, DIR))).body;
  assert.equal(u.klanten.length, 1, 'een klant hangt eraan');
  assert.equal(u.klanten[0].naam, 'Havenbedrijf');
  assert.equal(u.klanten[0].via, 'klantId op het contract', 'die stap is geen naamgok');
  assert.equal(u.tickets.length, 1, 'met zijn open ticket');
  assert.equal(u.kansen.length, 1, 'en zijn open verkoopkans');

  /* De jurist mag contracten zien maar geen klanten: dan houdt de keten op bij
     de contracten, en er wordt geen nul geteld. */
  const joris = (await api('/uitval', Object.assign({ wederpartij: 'Fjordlijn Transport' }, JU))).body;
  assert.equal(joris.contracten.length, 2);
  assert.equal(joris.klanten.length, 0, 'zonder recht "klant" komt de keten daar niet');
  assert.equal(joris.tickets.length, 0, 'en zonder klant ook geen tickets');
  /* De jurist heeft WEL het recht "besluit" (elke rol die contracten mag zien
     heeft dat vandaag), dus hier hoort een lege lijst en geen null: gekeken en
     niets gevonden. De null-tak is een grendel voor een rollenmodel dat kan
     veranderen; dat staat als zodanig in uitval.js en wordt hier niet als een
     bereikbaar pad voorgesteld. */
  assert.deepEqual(joris.besluiten, [], 'besluiten: gekeken, niets gevonden');
});

test('6. wat dit huis niet weet, staat erbij', async () => {
  const u = (await api('/uitval', Object.assign({ wederpartij: 'Fjordlijn Transport' }, DIR))).body;
  const namen = u.nietGemeten.map(n => n.wat).join(' | ');
  assert.match(namen, /waarschijnlijk/i, 'de kans op uitval');
  assert.match(namen, /kosten|kost/i, 'wat het zou kosten');
  assert.match(namen, /onderaannemers/i, 'en de keten erachter');

  const leeg = (await api('/uitval', Object.assign({ wederpartij: 'Nooitbestaan BV' }, DIR))).body;
  assert.deepEqual(leeg.contracten, []);
  assert.match(leeg.let, /geen geruststelling/i, 'niets gevonden is een uitslag, geen rust');
});
