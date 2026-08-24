/* DE EERSTE SCAN IS DE EERSTE, EN NIET ELKE.

   magnaatwereld.js scant bij het opstarten de hele broncode om te weten welke
   apps, API-acties en werkprocessen er zijn (de capability-graaf). Dat is bij een
   VERSE installatie precies goed -- er moet er een keer een zijn. Maar de aanroep
   stond onvoorwaardelijk, en die loopt ook binnen de daggrens nog door de
   capability-kas heen: het uitpakken van een JSON-blob van rond de twaalf
   megabyte. Gemeten met een CPU-profiel is dat 463 ms van een boot van 1839, bij
   ELKE start, voor een overzicht dat op dat moment niemand opvraagt.

   Deze toets houdt de drie beloftes vast die daarbij horen:

     1. een installatie die nog NOOIT scande, scant bij de start
     2. een tweede start op dezelfde installatie scant NIET opnieuw
     3. en het overzicht werkt daarna gewoon -- de graaf wordt alsnog gebouwd
        zodra iemand hem opvraagt

   Die derde is de gevaarlijke. Zonder haar zou "niet meer scannen bij de start"
   ook groen staan als de graaf daarna helemaal niet meer te krijgen was, en dan
   is het geen versnelling maar een kapot scherm.

   Draai los: node --experimental-sqlite --test test/magnaat-eerste-scan.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { execFileSync } = require('child_process');
const { startServer, stopNet, bewaakKind } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const verseMap = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eerstescan-'));

/* De stand van de wereld UIT DE MAP lezen, niet uit een draaiende server: de
   vraag is juist wat er bij het opstarten op schijf terechtkomt. */
function laatsteScanIn(map) {
  const uit = execFileSync(process.execPath, ['--experimental-sqlite', '-e', `
    const db = require(${JSON.stringify(path.join(WORTEL, 'server', 'db'))});
    db.load();
    const w = (db.db.data || {}).magnaatWereld || null;
    process.stdout.write(JSON.stringify({ er: !!w, laatsteScan: w ? (w.laatsteScan || 0) : 0,
      snapshot: !!(w && w.capabilitySnapshot) }));
    process.exit(0);
  `], { cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: Object.assign({}, process.env, { RTG_DATA_DIR: map, NODE_ENV: 'test', RTG_DEMO: '1' }) });
  return JSON.parse(uit);
}

test('een verse installatie scant bij de start, een tweede start niet opnieuw', async (t) => {
  const map = verseMap();
  t.after(() => { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} });

  /* GEEN gietvorm: die is gegoten door een server die al gescand heeft, en dan
     zou deze toets meten wat de vorm meebracht in plaats van wat de start doet. */
  const een = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map }, geenVorm: true });
  await stopNet(een.child, 20000);
  const na1 = laatsteScanIn(map);
  assert.equal(na1.er, true, 'de magnaatwereld hoort na de eerste start op schijf te staan');
  assert.ok(na1.laatsteScan > 0,
    'een installatie die nog nooit scande, hoort bij de start EEN keer te scannen -- anders is er ' +
    'nooit een capability-graaf en staat het overzicht leeg tot iemand hem met de hand forceert');
  assert.equal(na1.snapshot, true, 'en de uitkomst hoort bewaard te zijn');

  const twee = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map }, geenVorm: true });
  await stopNet(twee.child, 20000);
  const na2 = laatsteScanIn(map);
  assert.equal(na2.laatsteScan, na1.laatsteScan,
    'een tweede start op dezelfde installatie hoort NIET opnieuw te scannen. Verandert dit getal, ' +
    'dan draait elke herstart weer door de capability-kas -- 463 ms van een boot van 1839, voor een ' +
    'overzicht dat op dat moment niemand opvraagt.');
});

/* Een server starten en zijn stderr MEELEZEN. De bronkas schrijft bij het
   opstarten een regel zodra er iets uit de kas is gehaald ("N uit de kas"); staat
   die regel er niet, dan is er niets uit de kas gelezen. Dat is de enige
   waarneming van buitenaf die zegt of de capability-graaf bij de start is
   opgebouwd -- de kas zelf ligt in os.tmpdir() en niet in de repo, dus het
   leesspoor ziet hem niet, en op de tijd afgaan zou een toets opleveren die op een
   drukke machine willekeurig zakt. */
async function startEnLees(map) {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map }, geenVorm: true, stderr: 'pipe' });
  let uit = '';
  srv.child.stderr.on('data', (b) => { uit += b.toString(); });
  bewaakKind(srv.child);          // de strenge poort leest alsnog mee
  await stopNet(srv.child, 20000);
  return uit;
}

test('een tweede start leest de capability-kas NIET meer', async (t) => {
  const map = verseMap();
  t.after(() => { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} });

  const eerste = await startEnLees(map);
  assert.match(eerste, /\[bronkas\][^\n]*uit de kas/,
    'de eerste start van een verse installatie scant, en leest daarvoor de bronkas');

  const tweede = await startEnLees(map);
  assert.doesNotMatch(tweede, /\[bronkas\][^\n]*uit de kas/,
    'een tweede start hoort de bronkas met RUST te laten. Staat die regel er wel, dan is de ' +
    'capability-graaf alsnog opgebouwd -- 463 ms van een boot van 1839, voor een overzicht dat op dat ' +
    'moment niemand opvraagt. Dit is de bewering die de vorige versie van deze toets MISTE: die keek ' +
    'naar laatsteScan, en dat getal blijft in beide gevallen gelijk omdat de dagelijkse grens de ' +
    'scan al overslaat. De aanroep gebeurde wel, en dat is precies wat hier telt.');
});

test('het overzicht werkt ook als er bij de start niet is gescand', async (t) => {
  const map = verseMap();
  t.after(() => { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} });
  /* Eerst een start die WEL scant, dan een tweede die dat niet doet -- en op die
     tweede het overzicht opvragen. De graaf moet dan alsnog verschijnen, want hij
     wordt gebouwd zodra iemand hem vraagt. */
  const een = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map }, geenVorm: true });
  await stopNet(een.child, 20000);
  const twee = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map }, geenVorm: true });
  t.after(async () => { await stopNet(twee.child, 10000); });

  const eig = await fetch(twee.base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })
    .then(r => r.json());
  assert.ok(eig && eig.token, 'de eigenaar hoort te kunnen inloggen');
  const r = await fetch(twee.base + '/api/member/magnaat/overzicht', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + eig.token },
    body: JSON.stringify({}) });
  const body = await r.json().catch(() => ({}));
  assert.equal(r.status, 200, 'het wereldoverzicht hoort gewoon te openen: ' + JSON.stringify(body).slice(0, 200));
  const g = body.capabilityGraph || (body.wereld && body.wereld.capabilityGraph);
  assert.ok(g && g.vingerafdruk,
    'en de capability-graaf hoort erin te staan. Ontbreekt hij, dan is er niet minder gescand maar ' +
    'helemaal niets meer te krijgen -- dat is geen versnelling maar een kapot scherm.');
  assert.ok(g.cijfers && g.cijfers.apiActies > 0, 'met echte cijfers erin, niet een lege huls');
});
