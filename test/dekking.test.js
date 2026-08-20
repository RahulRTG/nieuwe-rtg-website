/* ============================================================================
   DE DEKKINGSMETER LEEST ALLE JOURNALEN, NIET EEN (scripts/dekking.js).

   WAAROM DEZE TOETS ER IS. `npm test` en `npm run e2e` schrijven elk hun eigen
   routejournaal. Las de meter er maar een, dan stond een endpoint dat alleen
   vanuit de BROWSER wordt aangeroepen als "nooit aangeraakt" terwijl er een
   schermtoets voor is -- /api/fout/client is dat geval, en het stond als
   voetnoot in TAKEN.md 6.8 (b) in plaats van in de uitvoer van de meter zelf.

   TWEE BEWERINGEN, en de tweede is de belangrijkste:
     1  `--lees` mag herhaald worden en de meter telt de UNIE;
     2  hij zegt PER JOURNAAL of hij meetelde. Een cijfer dat stilzwijgend een
        hele suite overslaat, leest als een uitspraak over alles -- en dat is
        precies het soort stille onvolledigheid waar dit huis registers voor
        heeft.

   Draai los: node --experimental-sqlite --test test/dekking.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');

/* De meter weigert een journaal met minder dan vijftig patronen -- dat is geen
   meting maar een kapotte opstelling. Deze vulling haalt die drempel met paden
   die met opzet NIET bestaan, zodat ze het cijfer niet beinvloeden. */
function vulling(n) {
  const uit = [];
  for (let i = 0; i < n; i++) uit.push('POST /api/zz-dekkingtoets/' + i);
  return uit.join('\n') + '\n';
}

/* De meter ZAKT hier met opzet: deze nepjournalen halen de norm bij lange na
   niet, dus hij komt terug met exit 1 en zijn klacht op stderr. Dat is precies
   goed gedrag; het cijfer op stdout is er gewoon. Vandaar de vangst -- zonder
   die zou deze toets meten dat de ratel werkt in plaats van dat de unie werkt. */
function meet(journalen) {
  const args = ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'dekking.js'), '--json'];
  for (const j of journalen) { args.push('--lees'); args.push(j); }
  const opties = { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 600000, maxBuffer: 64 * 1024 * 1024 };
  let uit;
  try { uit = execFileSync(process.execPath, args, opties); }
  catch (e) { uit = String(e.stdout || ''); }
  assert.ok(uit.trim().startsWith('{'), 'de meter gaf geen JSON terug: ' + uit.slice(0, 200));
  return JSON.parse(uit);
}

test('twee journalen tellen samen, en een endpoint uit het tweede is niet meer "nooit aangeraakt"', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekkingtoets-'));
  const alleen = path.join(map, 'een.log');
  const scherm = path.join(map, 'twee.log');
  try {
    /* Het eerste journaal doet alsof het de servertoetsen zijn: genoeg patronen
       om de drempel te halen, maar zonder de route die alleen de browser raakt. */
    fs.writeFileSync(alleen, vulling(60));
    /* Het tweede is het schermjournaal: een echte route, plus een SCHERM-regel
       zoals de e2e-suite die schrijft (die hoort geen endpoint te worden). */
    fs.writeFileSync(scherm, 'POST /api/fout/client\nSCHERM /apps/app.html\n');

    const zonder = meet([alleen]);
    const met = meet([alleen, scherm]);

    assert.ok(zonder.ongeraakt.includes('/api/fout/client'),
      'met alleen het toetsjournaal staat de foutmelder als nooit aangeraakt');
    assert.ok(!met.ongeraakt.includes('/api/fout/client'),
      'met het schermjournaal erbij niet meer -- de unie telt');
    assert.ok(met.geraakt > zonder.geraakt, 'en het cijfer gaat omhoog van een journaal erbij');
    assert.equal(met.routes, zonder.routes, 'de routekaart zelf verandert er niet van');
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
});

test('de uitslag zegt PER JOURNAAL of hij meetelde', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekkingtoets2-'));
  const een = path.join(map, 'een.log');
  const twee = path.join(map, 'twee.log');
  try {
    fs.writeFileSync(een, vulling(60));
    fs.writeFileSync(twee, 'POST /api/fout/client\n');
    const r = meet([een, twee]);
    assert.ok(Array.isArray(r.journalen), 'de uitslag draagt een lijst journalen');
    assert.equal(r.journalen.length, 2, 'allebei genoemd');
    for (const h of r.journalen) {
      assert.equal(h.geteld, true);
      assert.ok(h.reden, h.pad + ' zonder reden opgenomen');
    }
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
});
