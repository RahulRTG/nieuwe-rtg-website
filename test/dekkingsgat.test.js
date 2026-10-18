/* HET DEKKINGSGAT, GEIJKT OP EEN KLEIN FIXTURE (besluit eigenaar 14 oktober
   2026: "eerst meten, dan beslissen").

   De dekkingsvloer telt alleen wat een Node-toetsproces laadt. Wat er niet in
   staat, is er niet als 0% maar helemaal niet. scripts/dekkingsgat.js legt
   daarom naast het getal van de vloer welke productiebestanden buiten de
   meting vallen en hoe groot ze ongeveer zijn. Deze toets ijkt dat op een
   fixture waarvan elk antwoord vooraf bekend is:

     1. een bestand met een SF-regel telt als gemeten, een zonder niet;
     2. server/data/, test/ en niet-JavaScript zijn geen productiebestand;
     3. de omvang is het aantal regels, en de ondergrens rekent het ongemeten
        deel als 0% in een grotere noemer;
     4. het script is een rapport en geen poort: exitcode 0, ook zonder meting.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (gemeten.has(p)) continue;` weghalen
     -> "1. gemeten tegen niet gemeten" ZAKT (RAAK)
   - de uitsluiting van server/data/ weghalen (UITGESLOTEN leeg)
     -> "2. geen productiebestand" ZAKT (RAAK)
   - `return 0` aan het eind van main() vervangen door `return 1`
     -> "4. rapport, geen poort" ZAKT (RAAK)

   Draai: node --test test/dekkingsgat.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const gat = require('../scripts/dekkingsgat');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'dekkingsgat.js');

/* Een lcov met een bestand: drie regels, twee geraakt. */
const LCOV = 'TN:\nSF:server/gemeten.js\nDA:1,1\nDA:2,4\nDA:3,0\nLF:3\nLH:2\nend_of_record\n';

/* Een nepboom in een tijdelijke map; nooit iets in de repository. */
function fixture() {
  const wortel = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekkingsgat-'));
  const bestanden = {
    'server/gemeten.js': 'a\nb\nc\n',
    'public/shared/los.js': 'x\ny\n',
    'public/apps/winkel/scherm.js': '1\n2\n3\n4\n',
    'scripts/hulp.mjs': 'z\n',
    'server/data/db.js': 'geheim\n',
    'test/iets.test.js': 't\n',
    'public/stijl.css': 'body{}\n'
  };
  for (const [p, inhoud] of Object.entries(bestanden)) {
    fs.mkdirSync(path.dirname(path.join(wortel, p)), { recursive: true });
    fs.writeFileSync(path.join(wortel, p), inhoud);
  }
  return { wortel, kandidaten: Object.keys(bestanden) };
}

test('1. gemeten tegen niet gemeten: alleen een bestand zonder SF-regel valt in het gat', () => {
  const { wortel, kandidaten } = fixture();
  const r = gat.rapport({ kandidaten, teksten: [LCOV], wortel });
  const paden = r.ongemeten.lijst.map((o) => o.pad);
  assert.deepEqual(paden, ['public/apps/winkel/scherm.js', 'public/shared/los.js', 'scripts/hulp.mjs']);
  assert.ok(!paden.includes('server/gemeten.js'));
  assert.equal(r.meting.bestanden, 1);
  assert.equal(r.meting.buitenKandidaten, 0);
  fs.rmSync(wortel, { recursive: true, force: true });
});

test('2. geen productiebestand: server/data, toetsen en niet-JavaScript tellen niet mee', () => {
  assert.equal(gat.isKandidaat('server/data/db.js'), false);
  assert.equal(gat.isKandidaat('test/iets.test.js'), false);
  assert.equal(gat.isKandidaat('public/stijl.css'), false);
  assert.equal(gat.isKandidaat('scripts/hulp.mjs'), true);
  assert.equal(gat.isKandidaat('server/x.cjs'), true);
  const { wortel, kandidaten } = fixture();
  const r = gat.rapport({ kandidaten, teksten: [], wortel });
  assert.equal(r.ongemeten.bestanden, 4, 'gemeten.js telt mee als ongemeten zonder lcov; data, test en css niet');
  fs.rmSync(wortel, { recursive: true, force: true });
});

test('3. omvang en ondergrens: regels per map, en het ongemeten deel als 0% in de noemer', () => {
  const { wortel, kandidaten } = fixture();
  const r = gat.rapport({ kandidaten, teksten: [LCOV], wortel });
  assert.equal(r.ongemeten.regels, 7, '4 + 2 + 1 regels');
  assert.deepEqual(r.meting.regels, { gedekt: 2, totaal: 3, pct: 66.67 });
  assert.deepEqual(r.ondergrens, { gedekt: 2, totaal: 10, pct: 20 });
  assert.equal(r.aandeelOngemeten, 70);
  const groep = Object.fromEntries(r.groepen.map((g) => [g.groep, [g.bestanden, g.regels]]));
  assert.deepEqual(groep, { 'public/apps/winkel': [1, 4], 'public/shared': [1, 2], scripts: [1, 1] });
  assert.equal(gat.groepVan('server/server.js'), 'server');
  assert.equal(gat.groepVan('public/apps/app.js'), 'public/apps');
  fs.rmSync(wortel, { recursive: true, force: true });
});

test('4. rapport, geen poort: exitcode 0 met meting, zonder meting en met een onleesbare map', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekkingsgat-lcov-'));
  fs.writeFileSync(path.join(map, 'deel-1-1-scherf-1.info'), 'TN:\nSF:scripts/dekkingsgat.js\nDA:1,1\nend_of_record\n');
  const uit = execFileSync(process.execPath, [SCRIPT, map, '--json'], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' } });
  const r = JSON.parse(uit);
  assert.equal(r.meting.bestanden, 1);
  assert.ok(r.ongemeten.bestanden > 100, 'de echte boom heeft veel meer productiebestanden dan dit ene');
  const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekkingsgat-leeg-'));
  for (const doel of [leeg, path.join(leeg, 'bestaat-niet')]) {
    const s = spawnSync(process.execPath, [SCRIPT, doel], { encoding: 'utf8' });
    assert.equal(s.status, 0, s.stdout + s.stderr);
  }
  fs.rmSync(map, { recursive: true, force: true });
  fs.rmSync(leeg, { recursive: true, force: true });
});
