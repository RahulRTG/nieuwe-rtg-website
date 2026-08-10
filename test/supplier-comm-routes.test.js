/* ============================================================================
   HET COLLEGA-GESPREK VAN EEN ZAAK, EN DE IDENTITEITSOPVRAAG.

   Zeven comm-deuren en twee identiteitsdeuren werden door geen enkele toets
   geopend. Ze horen in een bestand omdat ze dezelfde vraag stellen: wie mag
   hier bij een ANDER mens?

     - een gesprek beginnen kan alleen met een collega van de eigen zaak, met
       een persoonlijke login, en niet met jezelf;
     - de inbox van de zaak toont per gesprek ALS WIE je erin zit -- gedeeld
       (de zaak) of persoonlijk -- want dat bepaalt wie je bericht straks ziet;
     - de echte naam achter een codenaam opvragen kan alleen met een reden, en
       een kopie van een identiteitsbewijs alleen door een manager.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de supplier_code-controle uit /api/supplier/comm/collega gehaald
     -> "een collega van een andere zaak is geen collega" ZAKT (RAAK)
   - de gelijk-aan-jezelf-controle eruit gehaald
     -> "met uzelf praten hoeft niet" ZAKT (RAAK)
   - de manager-eis bij niveau 'kopie' uit kern/payroll/identiteit.js gehaald
     -> "een kopie is voor de manager" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/supplier-comm-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-comm-'));
const ZAAK = 'KIKUNOI';
const ANDERE = 'PONTO';
let srv, base, baas, vloer, buur, BAAS_ID, VLOER_ID, BUUR_ID, GESPREK;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, token, wat) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

async function bemensing(code) {
  const roster = await api('/api/supplier/roster', { code });
  const lijst = roster.body.staff || [];
  const mg = lijst.find(x => x.role === 'manager');
  const st = lijst.find(x => x.role !== 'manager');
  assert.ok(mg && st, 'de demozaak ' + code + ' heeft leiding en vloer');
  return { mg, st };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const eigen = await bemensing(ZAAK);
  BAAS_ID = eigen.mg.id; VLOER_ID = eigen.st.id;
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: BAAS_ID, pin: '1234' })).body.token;
  vloer = (await api('/api/supplier/login', { code: ZAAK, staffId: VLOER_ID, pin: '5678' })).body.token;

  const ander = await bemensing(ANDERE);
  BUUR_ID = ander.mg.id;
  buur = (await api('/api/supplier/login', { code: ANDERE, staffId: BUUR_ID, pin: '1234' })).body.token;
  assert.ok(baas && vloer && buur, 'alle drie zijn binnen');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. een gesprek begint met een collega van de eigen zaak, en met niemand anders', async () => {
  const vreemd = await api('/api/supplier/comm/collega', { staffId: BUUR_ID }, baas);
  assert.notEqual(vreemd.status, 200, 'iemand van een andere zaak is geen collega');
  assert.match(String(vreemd.body.error || ''), /niet gevonden/i, vreemd.body.error);

  const zelf = await api('/api/supplier/comm/collega', { staffId: BAAS_ID }, baas);
  assert.notEqual(zelf.status, 200, 'met uzelf praten hoeft niet');

  const onzin = await api('/api/supplier/comm/collega', { staffId: 999999 }, baas);
  assert.notEqual(onzin.status, 200, 'een personeelsnummer dat niet bestaat, opent niets');

  const g = await moet('/api/supplier/comm/collega', { staffId: VLOER_ID }, baas, 'een collega aanspreken');
  GESPREK = g.gesprek.id;
  assert.ok(GESPREK, 'het gesprek krijgt een id');

  /* Een paar heeft EEN gesprek, welke kant je het ook opent. Anders staan er
     twee draden naast elkaar en mist de een wat in de ander staat. */
  const andersom = await moet('/api/supplier/comm/collega', { staffId: BAAS_ID }, vloer,
    'de collega opent hem andersom');
  assert.equal(andersom.gesprek.id, GESPREK, 'en het is hetzelfde gesprek');
});

test('2. een bericht komt aan bij de collega en nergens anders', async () => {
  await moet('/api/supplier/comm/stuur', { id: GESPREK, tekst: 'Kun jij vanmiddag de levering aannemen?' },
    baas, 'een bericht sturen');

  const bij = await moet('/api/supplier/comm/gesprek', { id: GESPREK }, vloer, 'het gesprek van de collega');
  assert.ok(JSON.stringify(bij.gesprek).includes('de levering aannemen'), 'het bericht staat erin');
  assert.equal(bij.gedeeld, false, 'dit is een persoonlijk gesprek en niet dat van de zaak');

  const buurman = await api('/api/supplier/comm/gesprek', { id: GESPREK }, buur);
  assert.notEqual(buurman.status, 200, 'de buurzaak komt niet in dit gesprek');

  await moet('/api/supplier/comm/typt', { id: GESPREK }, vloer, 'laten weten dat je typt');
  await moet('/api/supplier/comm/lees', { id: GESPREK }, vloer, 'het gesprek als gelezen zetten');
});

test('3. de inbox zegt per gesprek als wie je erin zit', async () => {
  const in1 = await moet('/api/supplier/comm/inbox', {}, baas, 'de inbox');
  assert.ok(Array.isArray(in1.gesprekken), 'er is een gesprekkenlijst');
  const mijn = in1.gesprekken.find(g => g.id === GESPREK);
  assert.ok(mijn, 'het collega-gesprek staat erin');
  assert.equal(mijn.gedeeld, false, 'en staat op naam van de persoon, niet van de zaak');
  assert.ok('alsWie' in mijn, 'elk gesprek draagt als wie je erin zit');
  assert.ok(Array.isArray(in1.laden), 'de laden komen mee, zodat het scherm niets kan tonen wat de server niet kent');

  const buurIn = await moet('/api/supplier/comm/inbox', {}, buur, 'de inbox van de buurzaak');
  assert.equal((buurIn.gesprekken || []).some(g => g.id === GESPREK), false,
    'het gesprek van de andere zaak staat er niet in');
});

test('4. zoeken kijkt alleen in de eigen draden', async () => {
  const mijn = await moet('/api/supplier/comm/zoek', { vraag: 'levering' }, baas, 'zoeken');
  assert.ok(Array.isArray(mijn.treffers), 'er is een trefferlijst');
  assert.equal(mijn.vraag, 'levering', 'de vraag komt mee terug, zodat een scherm weet wat het toont');

  const buurZoek = await moet('/api/supplier/comm/zoek', { vraag: 'levering' }, buur, 'de buurzaak zoekt');
  assert.equal(JSON.stringify(buurZoek.treffers).includes('de levering aannemen'), false,
    'en vindt niets uit een gesprek van een andere zaak');
});

test('5. de identiteitsopvraag vraagt een reden, en een kopie vraagt een manager', async () => {
  const standen = await moet('/api/supplier/identiteit', {}, baas, 'de identiteitsstanden');
  assert.ok(Array.isArray(standen.standen), 'er is een lijst met standen');
  for (const s of standen.standen)
    assert.equal(/@|paspoortnummer|bsn/i.test(JSON.stringify(s)), false,
      'een stand toont geen gegevens, alleen of ze er zijn: ' + JSON.stringify(s).slice(0, 120));

  const zonder = await api('/api/supplier/identiteit/opvraag',
    { staffId: VLOER_ID, niveau: 'gegevens', reden: '' }, baas);
  assert.equal(zonder.status, 400, 'zonder reden geen opvraag');
  assert.match(String(zonder.body.error || ''), /reden|waarvoor/i, zonder.body.error);

  const vreemd = await api('/api/supplier/identiteit/opvraag',
    { staffId: BUUR_ID, niveau: 'gegevens', reden: 'Ik wil het contract van deze mevrouw nakijken.' }, baas);
  assert.equal(vreemd.status, 404, 'een medewerker van een andere zaak werkt hier niet');

  const kopie = await api('/api/supplier/identiteit/opvraag',
    { staffId: VLOER_ID, niveau: 'kopie', reden: 'De loonadministratie vraagt om een kopie voor het dossier.' }, vloer);
  assert.equal(kopie.status, 403, 'een kopie is de zwaarste inzage en dus voor de manager');
});
