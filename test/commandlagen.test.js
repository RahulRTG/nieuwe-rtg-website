/* De ROUTES van de lagen die op de Command-ruggengraat staan: canary, zandbak,
   master data, overname, API-poort, landen, steden en het alarm.

   WAAROM DIT NAAST DE MOTORTOETSEN STAAT. Die toetsen de rekenkant met
   nagemaakte gegevens; hier gaat het om de BEDRADING. Een laag kan compleet
   kloppen en toch onbereikbaar zijn: een route die niet gemount is, een
   verkeerde veldnaam in de body, een laag die niet aan de kern hangt. Dat zie
   je alleen door er echt tegenaan te praten -- en het is precies de klasse
   fouten die deze ronde twee keer opleverde (een receptenboek dat de verkeerde
   id-kaart kreeg, en een laag die pas na aanbouw bestond).

   EN ELKE INGANG MOET DICHT ZITTEN ZONDER SESSIE. Dat staat hier per laag en
   niet één keer aan het eind: een enkele vergeten officeAuth is genoeg, en
   "de meeste routes zijn dicht" is geen uitspraak waar iemand iets aan heeft.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de canary-routes uit routes/command/meten.js gehaald
     -> "elke laag heeft een ingang die antwoordt" ZAKT (RAAK)
   - officeAuth van de alarmroute gehaald
     -> "geen enkele ingang staat open zonder kantoorsessie" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lagen-'));
const CODE = 'KANTOOR-LAGEN-1';
let srv, base, office;

const api = (pad, body) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const zonder = (pad) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
}).then(r => r.status);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  const l = await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE })
  })).json();
  office = l.token;
  assert.ok(office, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('elke laag heeft een ingang die antwoordt', async () => {
  for (const pad of ['command/canary', 'command/zandbak', 'command/mdm', 'command/overname',
    'command/apipoort', 'command/land', 'command/stad', 'command/alarm', 'command/herkomst',
    'command/kwaliteit', 'command/graaf', 'command/slo', 'command/sonde']) {
    const r = await api(pad);
    assert.equal(r.status, 200, pad + ' antwoordt niet: ' + JSON.stringify(r.body).slice(0, 120));
  }
});

test('geen enkele ingang staat open zonder kantoorsessie', async () => {
  for (const pad of ['command/canary', 'command/canary/start', 'command/zandbak', 'command/zandbak/maak',
    'command/mdm', 'command/mdm/samen', 'command/overname', 'command/overname/lees',
    'command/apipoort', 'command/apipoort/sleutel', 'command/land', 'command/land/activeer',
    'command/stad', 'command/stad/start', 'command/alarm', 'command/alarm/stil']) {
    assert.equal(await zonder(pad), 401, pad + ' staat open zonder sessie');
  }
});

test('de zandbak draait een recept en de productie blijft ongemoeid', async () => {
  const maak = await api('command/zandbak/maak', { naam: 'proefbak', waarvoor: 'de routetoets' });
  assert.equal(maak.status, 200);
  assert.ok(maak.body.zandbak.objecten >= 0);

  const zoek = await api('command/zandbak/zoek', { naam: 'proefbak', q: 'HOSHI' });
  assert.equal(zoek.status, 200);
  assert.equal(zoek.body.zandbak, 'proefbak', 'elk antwoord draagt de naam van de zandbak');

  const kw = await api('command/zandbak/kwaliteit', { naam: 'proefbak' });
  assert.equal(kw.status, 200);
  assert.ok(kw.body.tel, 'de kwaliteitsmeting draait op de zandbak');

  assert.equal((await api('command/zandbak/zoek', { naam: 'bestaatniet' })).status, 404);
  assert.equal((await api('command/zandbak/weg', { naam: 'proefbak' })).status, 200);
});

test('de overname loopt van inlezen tot terugdraaien', async () => {
  const lees = await api('command/overname/lees', { naam: 'Routetoets', soort: 'zaak',
    rijen: [{ ID: 'RT-1', Naam: 'Zaak een' }, { ID: 'RT-2', Naam: 'Zaak twee' }] });
  assert.equal(lees.status, 200);
  const id = lees.body.partij.id;
  assert.ok(lees.body.voorstel.hunVelden.length >= 2, 'het voorstel meet hun kolommen');

  assert.equal((await api('command/overname/afbeelden', { id, afbeelding: { code: 'ID', name: 'Naam' } })).status, 200);
  const droog = await api('command/overname/droogloop', { id });
  assert.equal(droog.body.rapport.erin, 2);

  /* Zonder het juiste zegel gaat er niets in, en dat is de hele opzet. */
  assert.equal((await api('command/overname/voer', { id, zegel: 'fout' })).status, 409);
  const voer = await api('command/overname/voer', { id, zegel: droog.body.rapport.zegel, reden: 'routetoets' });
  assert.equal(voer.body.erin, 2);

  const terug = await api('command/overname/terug', { id });
  assert.equal(terug.body.weg, 2, 'en precies die twee gaan er weer uit');
});

test('de API-poort geeft een geheim dat nergens terugkomt', async () => {
  assert.equal((await api('command/apipoort/sleutel', { naam: 'x', scopes: [{ pad: '/api/extern/x' }] })).status, 403,
    'buiten de toelating komt er geen sleutel');
  assert.equal((await api('command/apipoort/toelaten', { pad: '/api/extern/proef' })).status, 200);

  const s = await api('command/apipoort/sleutel', { naam: 'Routetoets',
    scopes: [{ pad: '/api/extern/proef', methoden: ['GET'] }], quotaPerUur: 5 });
  assert.match(s.body.geheim, /^RTG-/);

  const stand = await api('command/apipoort');
  assert.ok(!JSON.stringify(stand.body).includes(s.body.geheim.split('.')[1]),
    'het geheim staat niet in de stand');

  /* En de poort zelf: met de sleutel komt hij door de middleware heen en botst
     hij op een pad dat niet bestaat (404 van de router), zonder sleutel niet. */
  const dicht = await fetch(base + '/api/extern/proef');
  assert.equal(dicht.status, 401, 'zonder sleutel komt er niets langs de poort');
  const open = await fetch(base + '/api/extern/proef', { headers: { authorization: 'Bearer ' + s.body.geheim } });
  assert.notEqual(open.status, 401, 'met sleutel wel (daarachter staat niets, dus geen 200)');
  assert.equal(open.headers.get('x-rtg-quota-rest'), '4', 'en het resterende quotum komt mee');

  assert.equal((await api('command/apipoort/intrekken', { id: s.body.sleutel.id, reden: 'klaar' })).status, 200);
  const na = await fetch(base + '/api/extern/proef', { headers: { authorization: 'Bearer ' + s.body.geheim } });
  assert.equal(na.status, 401, 'een ingetrokken sleutel komt er niet meer in');
});

test('een land en een stad zijn aan elkaar geknoopt', async () => {
  assert.equal((await api('command/stad/start', { naam: 'Proefstad', land: 'NL' })).status, 409,
    'zonder actief landpakket gaat er geen stad open');
  assert.equal((await api('command/land/activeer', { land: 'NL' })).status, 200);

  const stad = await api('command/stad/start', { naam: 'Proefstad', land: 'NL' });
  assert.equal(stad.status, 200);
  assert.deepEqual(stad.body.open, ['stadsweefsel'], 'en de weefselstap blijft openstaan');
  assert.ok(stad.body.mensenwerk.length >= 3);

  assert.equal((await api('command/stad/stop', { naam: 'Proefstad' })).status, 200);
  assert.equal((await api('command/land/terug', { land: 'NL' })).status, 200);
});

/* ELKE INGANG ECHT AANRAKEN, en niet alleen de hoofdingang per laag.

   scripts/dekking.js meet de WAARGENOMEN dekking uit het routejournaal: welke
   endpoints zijn tijdens de hele suite geen enkele keer aangeroepen. Dat is een
   ander cijfer dan "staat er een toets die erover gaat", en het is het eerlijke
   -- acht van mijn eigen nieuwe ingangen stonden erin, terwijl de laag eronder
   wel getoetst was. Een knop op een scherm die nooit door een toets is
   ingedrukt, is een knop waarvan niemand weet of hij het doet. */
test('ook de tweede knop van elke laag wordt echt aangeroepen', async () => {
  /* De canary: verbreden, terugdraaien en afronden. Ze werken op een functie
     uit de schakelkast, dus we zetten er een op canary en halen hem weer weg. */
  assert.equal((await api('command/canary/start', { id: 'command-zien', deel: 0.1 })).status, 200);
  assert.equal((await api('command/canary/breder', { id: 'command-zien', deel: 0.5 })).status, 200);
  assert.equal((await api('command/canary/terug', { id: 'command-zien', reden: 'routetoets' })).status, 200);
  assert.equal((await api('command/canary/af', { id: 'command-zien' })).status, 200);
  assert.equal((await api('command/canary/af', { id: 'command-zien' })).status, 404, 'twee keer afronden kan niet');

  /* De kennisgraaf en de herkomst: van een echt object uit de startdata. */
  const wandel = await api('command/graaf/wandel', { type: 'zaak', id: 'HOSHI', diepte: 2 });
  assert.equal(wandel.status, 200);
  assert.equal(wandel.body.start.id, 'HOSHI');
  const spoor = await api('command/herkomst/spoor', { type: 'zaak', id: 'HOSHI' });
  assert.equal(spoor.status, 200);
  assert.ok(Array.isArray(spoor.body.wordtGenoemdDoor));

  /* Master data: het gouden record en het terugdraaien van een samenvoeging.
     Zonder dubbelen in de startdata is er geen groep, en dan hoort gouden() een
     eerlijke 404 te geven in plaats van iets te verzinnen. */
  const groepen = (await api('command/mdm')).body.bedrijven;
  const goud = await api('command/mdm/gouden', { sleutel: groepen.length ? groepen[0].sleutel : 'bestaat-niet' });
  assert.equal(goud.status, groepen.length ? 200 : 404);
  assert.equal((await api('command/mdm/terug', { verliezers: [] })).status, 400,
    'terugdraaien zonder samenvoeging is een fout en geen stille nul');

  /* En een pad weer uit de toelating halen. */
  assert.equal((await api('command/apipoort/toelaten', { pad: '/api/extern/tijdelijk' })).status, 200);
  assert.equal((await api('command/apipoort/toelating-weg', { pad: '/api/extern/tijdelijk' })).status, 200);
  assert.equal((await api('command/apipoort/toelating-weg', { pad: '/api/extern/tijdelijk' })).status, 404);
});

test('het alarm meldt de stille sonde en is stil te zetten', async () => {
  const st = await api('command/alarm');
  const a = st.body.alarmen.find(x => x.id === 'niets-van-buiten');
  assert.ok(a && a.actief, 'op een verse installatie is er niets van buitenaf gemeten');

  const stil = await api('command/alarm/stil', { id: 'niets-van-buiten', uren: 4, reden: 'routetoets' });
  assert.equal(stil.status, 200);
  assert.ok(Date.parse(stil.body.tot) > Date.now());
  assert.equal((await api('command/alarm/stil', { id: 'bestaatniet' })).status, 404);
});
