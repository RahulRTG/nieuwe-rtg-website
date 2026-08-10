/* RTG EVENING OS: de avond als plan.

   WAT DIT BESTAND BEWAAKT. Een avondplanner is de makkelijkste plek in dit hele
   huis om te gaan liegen. Hij ziet er indrukwekkend uit als hij een compleet
   plan neerzet, en niemand merkt tot de avond zelf dat de helft nooit is
   aangevraagd of dat de laatste taxi allang weg was. Deze toetsen gaan daarom
   niet over of er een plan uit komt, maar over of het plan WAAR is:

   1. NIETS IS GEBOEKT TOT HET GEBOEKT IS. Een tafel gaat naar `aangevraagd` en
      nooit rechtstreeks naar `bevestigd` -- het lid vraagt aan, de zaak
      beslist. Dat stond al in de reserveringslaag en de avondplanner mag het
      niet omzeilen omdat "geregeld" prettiger klinkt.
   2. DE KLOK EN HET BUDGET ZIJN GRENZEN, GEEN VERSIERING. Een plan dat na
      middernacht doorloopt terwijl je om 00:30 thuis wilde zijn, of dat boven
      je budget uitkomt, wordt GEWEIGERD met wat er niet past -- niet
      afgeleverd met een sterretje erbij.
   3. ER WORDT NIETS VERZONNEN. Kan een stap niet worden gevuld met een zaak
      die echt bestaat, dan blijft hij leeg met de reden. Een planner die gaten
      opvult met plausibele namen werkt precies één keer.
   4. DE VOORKEUREN GAAN NIET VERDER DAN DE GAST WIL. Een uitzondering per zaak
      kan alleen SMALLER maken; een zaak kan zichzelf nooit meer rechten geven. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, LID;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-avond-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const u = String(Date.now());
  const reg = await post('/api/auth/register', { name: 'Avondganger', email: 'av' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  LID = reg.body.token;
  assert.ok(LID, 'een lid kan zich registreren: ' + JSON.stringify(reg.body).slice(0, 160));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een voorstel draagt zijn redenen, zijn aannames en zijn gaten', async () => {
  const uit = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '00:30',
    personen: 4, plafondPP: 12000, titel: 'Met vrienden' }, LID);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 220));
  const a = uit.body.avond;
  assert.ok(a.stappen.length >= 1, 'er hoort minstens een stap in te staan');
  assert.equal(a.staat, 'voorstel');
  assert.match(a.zekerheid, /voorstel|nog niets aangevraagd/i,
    'boven een plan hoort te staan dat er nog niets is aangevraagd');

  /* Elke keuze draagt zijn grond. Een voorstel waarvan je de reden niet kunt
     nakijken is een orakel. */
  assert.ok(uit.body.uitleg.length, 'elke stap hoort zijn waarom mee te dragen');
  assert.ok(uit.body.uitleg.every(u => Array.isArray(u.waarom) && u.waarom.length));
  assert.ok(uit.body.aannames.length, 'de aannames staan er als aanname bij, niet als feit');

  // en de zaken die worden voorgesteld BESTAAN
  for (const s of a.stappen.filter(x => x.zaak)) {
    const kaart = await post('/api/gast/bezorg/kaart', { zaak: s.zaak }, LID);
    assert.equal(kaart.status, 200, 'voorgestelde zaak ' + s.zaak + ' hoort te bestaan');
  }
});

test('de klok is een grens: een plan dat te laat eindigt wordt geweigerd', async () => {
  const uit = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '19:30', personen: 2 }, LID);
  assert.equal(uit.status, 409, 'een avond die niet op tijd thuis is, hoort niet te worden afgeleverd');
  assert.equal(uit.body.code, 'klok');
  assert.match(uit.body.error, /thuis/);
  assert.ok(uit.body.teLaatMin > 0, 'en er hoort bij te staan hoeveel het te laat is');
});

test('het budget is een grens, en de weigering noemt het bedrag', async () => {
  const uit = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '02:00',
    personen: 2, plafondPP: 100 }, LID);
  assert.equal(uit.status, 409);
  assert.equal(uit.body.code, 'budget');
  assert.match(uit.body.error, /per persoon/);
});

test('een tafel wordt AANGEVRAAGD en nooit zomaar bevestigd', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  assert.equal(voorstel.status, 200, JSON.stringify(voorstel.body).slice(0, 200));
  const id = voorstel.body.avond.id;

  const gevraagd = await post('/api/avond/aanvragen', { id }, LID);
  assert.equal(gevraagd.status, 200, JSON.stringify(gevraagd.body).slice(0, 220));
  const eten = gevraagd.body.avond.stappen.find(s => s.soort === 'eten');
  assert.ok(eten, 'er hoort een eet-stap te zijn');
  assert.notEqual(eten.staat, 'bevestigd',
    'de avondplanner mag een tafel niet bevestigen; dat doet de zaak');
  assert.ok(['aangevraagd', 'mislukt'].includes(eten.staat),
    'de stap staat op aangevraagd of mislukt, met de reden erbij: ' + eten.staat);
  if (eten.staat === 'aangevraagd') {
    assert.match(eten.reden || '', /zaak beslist/i);
    assert.equal(eten.boeking.domein, 'reserveringen',
      'de stap wijst naar de ECHTE reservering en houdt geen eigen kopie');
  }
  assert.match(gevraagd.body.let, /aangevraagd en niet bevestigd/);
  assert.notEqual(gevraagd.body.avond.staat, 'rond',
    'zolang er iets openstaat, heet de avond niet rond');
});

test('een stap zonder aanvraagweg wordt niet stil groen gezet', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const id = voorstel.body.avond.id;
  const gevraagd = await post('/api/avond/aanvragen', { id }, LID);
  const vervoer = gevraagd.body.avond.stappen.find(s => s.soort === 'vervoer');
  if (vervoer) {
    assert.equal(vervoer.staat, 'voorstel');
    assert.match(vervoer.reden || '', /RTG OV|nog niet/i,
      'een stap die nog geen aanvraagweg heeft, zegt dat met zoveel woorden');
  }
});

test('de reservering die de avond aanvraagt, staat ook echt in mijn reserveringen', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '20:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const id = voorstel.body.avond.id;
  await post('/api/avond/aanvragen', { id }, LID);
  const mijne = await post('/api/reserveringen/mijn', {}, LID);
  assert.ok((mijne.body.reserveringen || []).length >= 1,
    'de avondplanner maakt geen eigen reserveringen naast de bestaande lijst');
});

/* ---------------------------------------------------------------------------
   DE HOSPITALITY DNA
   --------------------------------------------------------------------------- */

test('een zaak ziet alleen wat je deelt, en delen gaat per soort', async () => {
  await post('/api/avond/voorkeuren', { zet: {
    waarden: { tafel: 'liefst een ronde tafel, rustige hoek', gelegenheid: 'verjaardag 3 mei' },
    delen: { tafel: 'altijd', gelegenheid: 'nooit' } } }, LID);

  const proef = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI' }, LID);
  assert.equal(proef.status, 200);
  const ziet = proef.body.ditZietDeZaak.voorkeuren;
  assert.equal(ziet.tafel, 'liefst een ronde tafel, rustige hoek');
  assert.equal(ziet.gelegenheid, undefined,
    'wat op nooit staat, gaat niet mee -- ook niet "een keertje"');
});

test('gevraagd betekent gevraagd: alleen als je het deze keer meegeeft', async () => {
  await post('/api/avond/voorkeuren', { zet: {
    waarden: { drank: 'bruiswater zonder ijs' }, delen: { drank: 'gevraagd' } } }, LID);

  const zonder = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI' }, LID);
  assert.equal(zonder.body.ditZietDeZaak.voorkeuren.drank, undefined);

  const met = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI', nu: ['drank'] }, LID);
  assert.equal(met.body.ditZietDeZaak.voorkeuren.drank, 'bruiswater zonder ijs');
});

test('een uitzondering per zaak kan alleen SMALLER maken', async () => {
  await post('/api/avond/voorkeuren', { zet: {
    waarden: { sfeer: 'rustig' }, delen: { sfeer: 'nooit' } } }, LID);

  /* Proberen om deze ene zaak alsnog alles te geven. Dat hoort te worden
     GEWEIGERD en niet stil teruggeknepen: een clamp die de smallere waarde
     opslaat, legt een uitzondering vast die de gast nooit heeft gekozen -- en
     die blijft dan hangen als hij de soort later ruimer zet. */
  const ruimer = await post('/api/avond/voorkeuren/zaak',
    { zaak: 'KIKUNOI', standen: { sfeer: 'altijd' } }, LID);
  assert.equal(ruimer.status, 200);
  assert.equal(ruimer.body.standen.sfeer, undefined,
    'ruimer vragen legt geen uitzondering vast');
  assert.ok((ruimer.body.geweigerd || []).some(g => g.soort === 'sfeer'),
    'en het antwoord zegt waarom het niet is toegepast');

  const proef = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI', nu: ['sfeer'] }, LID);
  assert.equal(proef.body.ditZietDeZaak.voorkeuren.sfeer, undefined);

  // smaller mag wel: van altijd naar nooit bij een specifieke zaak
  await post('/api/avond/voorkeuren', { zet: { delen: { sfeer: 'altijd' } } }, LID);
  const smaller = await post('/api/avond/voorkeuren/zaak',
    { zaak: 'PONTO', standen: { sfeer: 'nooit' } }, LID);
  assert.equal(smaller.body.standen.sfeer, 'nooit');
  const bijPonto = await post('/api/avond/voorkeuren/proef', { zaak: 'PONTO' }, LID);
  const bijKikunoi = await post('/api/avond/voorkeuren/proef', { zaak: 'KIKUNOI' }, LID);
  assert.equal(bijPonto.body.ditZietDeZaak.voorkeuren.sfeer, undefined, 'bij PONTO afgeschermd');
  assert.equal(bijKikunoi.body.ditZietDeZaak.voorkeuren.sfeer, 'rustig', 'bij de rest gewoon gedeeld');
});

test('het profiel laat de gast zien wat een zaak er werkelijk van krijgt', async () => {
  const p = await post('/api/avond/voorkeuren', { zaak: 'KIKUNOI' }, LID);
  assert.equal(p.status, 200);
  const tafel = p.body.profiel.soorten.find(s => s.id === 'tafel');
  assert.ok(tafel, 'de soorten staan in het profiel');
  assert.equal(typeof tafel.ziet, 'boolean',
    'per soort staat erbij of deze zaak hem daadwerkelijk ziet');
  assert.match(p.body.profiel.let, /schrijf je zelf op/,
    'en dat RTG geen voorkeuren afleidt uit je gedrag');
});

test('een avond van een ander is niet op te vragen', async () => {
  const voorstel = await post('/api/avond/voorstel', { start: '19:00', thuisOm: '01:30',
    personen: 2, plafondPP: 20000 }, LID);
  const id = voorstel.body.avond.id;
  const u = String(Date.now()) + '7';
  const reg = await post('/api/auth/register', { name: 'Ander', email: 'an' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const gluur = await post('/api/avond', { id }, reg.body.token);
  assert.equal(gluur.status, 404, 'een avond hangt aan het lid dat hem maakte');
});
