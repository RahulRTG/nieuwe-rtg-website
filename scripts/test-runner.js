/* Betrouwbare nul-dependency testrunner voor de volledige Node-suite.

   De gewone `node --test test/*.test.js` liet ook bronmuterende meetproeven
   tegelijk lopen met scanners van diezelfde bron. Dan zag de ene test het
   tijdelijke ijkbestand van de andere en kon een geldige build rood worden.
   Daarnaast startte Node op grote machines zoveel servers tegelijk dat lokale
   healthchecks hun timeout haalden voordat de code aan de beurt kwam.

   Daarom: gewone bestanden begrensd parallel, bronmuterende ijkingen en de
   twee zwaarste hele-serverproeven daarna een voor een. Geen globbing, shell
   of npm-pakket nodig.

   TWEE VLAGGEN VOOR DE CI:

     --deel=2/4      draai alleen deel 2 van vier. De verdeling is om en om over
                     de gesorteerde lijst (bestand i hoort bij deel i % 4), zodat
                     een reeks zware buren niet in een deel belandt. De
                     geisoleerde bestanden worden apart verdeeld en blijven ook
                     binnen hun deel een voor een draaien -- anders zou de
                     isolatie juist in het deel verdwijnen waar hij nodig is.
     --dekking=<map> schrijf per batch een lcov-bestand in <map>. De vloer
                     rekent daarna over ALLE delen samen (scripts/dekkingsvloer.js);
                     de vlaggen --test-coverage-* konden dat niet, want die
                     rekenen per proces.

   Zonder die twee vlaggen gedraagt dit script zich precies als vroeger. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pak } = require('./afbouw-slot');
const { ontleedDeel, verdeel } = require('./lib/delen');

const WORTEL = path.join(__dirname, '..');
const geefAfbouwSlotVrij = pak('volledige Node-tests');
const TESTMAP = path.join(WORTEL, 'test');
const argv = process.argv.slice(2);
const reporter = (argv.find(a => a.startsWith('--reporter=')) || '').slice(11);
const selectie = (argv.find(a => a.startsWith('--bestanden=')) || '').slice(12)
  .split(',').map(s => s.trim()).filter(Boolean);
const dekkingMap = (argv.find(a => a.startsWith('--dekking=')) || '').slice(10);
const deelVlag = (argv.find(a => a.startsWith('--deel=')) || '').slice(7);
const deel = (() => {
  if (!deelVlag) return null;
  const d = ontleedDeel(deelVlag);
  if (!d) {
    console.error('[tests] --deel verwacht de vorm N/M met 1 <= N <= M, kreeg: ' + deelVlag);
    process.exit(2);
  }
  return d;
})();
const GEISOLEERD = new Set([
  'boot-smoke.test.js',
  'grens-sweep.test.js',
  'klok.test.js',
  'zaakdoos.test.js',
  'keuring.test.js',
  'meterijk.test.js'
]);
const gevraagd = Number(process.env.RTG_TEST_CONCURRENCY);
const concurrency = Number.isInteger(gevraagd) && gevraagd > 0
  ? Math.min(gevraagd, 32)
  : Math.max(2, Math.min(4, os.availableParallelism ? os.availableParallelism() : 4));

let bestanden = fs.readdirSync(TESTMAP).filter(n => n.endsWith('.test.js')).sort();
if (selectie.length) {
  const wil = new Set(selectie.map(n => n.endsWith('.test.js') ? n : n + '.test.js'));
  bestanden = bestanden.filter(n => wil.has(n));
}
if (!bestanden.length) {
  console.error('[tests] geen testbestanden geselecteerd');
  process.exit(2);
}

/* Het journaal mag van buiten komen: de CI geeft per deel een eigen pad mee en
   voegt ze daarna samen. Zonder RTG_ROUTELOG blijft het de vaste plek. */
const journaal = process.env.RTG_ROUTELOG || path.join(WORTEL, '.routejournaal');
try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const env = { ...process.env, RTG_ROUTELOG: journaal, RTG_AFBOUW_SLOT_ACTIEF: '1' };

let batch = 0;
function draai(namen, parallel) {
  if (!namen.length) return 0;
  const args = ['--experimental-sqlite', '--test', '--test-concurrency=' + parallel];
  if (dekkingMap) {
    /* Zodra je zelf een reporter noemt, vervalt de standaard. De TAP-uitvoer
       moet blijven staan: scripts/gezakte-toetsen.js leest hem, en zonder die
       regels weet wie een rode stap ziet alleen DAT er iets zakte. */
    fs.mkdirSync(dekkingMap, { recursive: true });
    const naam = 'deel-' + (deel ? deel.nr : 1) + '-' + (++batch) + '.info';
    args.push('--experimental-test-coverage',
      '--test-reporter=' + (reporter || 'tap'), '--test-reporter-destination=stdout',
      '--test-reporter=lcov', '--test-reporter-destination=' + path.join(dekkingMap, naam));
  } else if (reporter) {
    args.push('--test-reporter=' + reporter);
  }
  args.push(...namen.map(n => path.join('test', n)));
  const r = spawnSync(process.execPath, args, {
    cwd: WORTEL, env, stdio: 'inherit', timeout: 90 * 60 * 1000
  });
  if (r.error) {
    console.error('[tests] runnerfout:', r.error.message);
    return 2;
  }
  return r.status == null ? 2 : r.status;
}

/* De gewone bestanden en de geisoleerde ijkingen worden APART verdeeld (zie
   scripts/lib/delen.js voor de verdeelregel zelf). Samen verdelen zou de zes
   ijkingen op de willekeur van hun plek in het alfabet in een of twee delen
   laten vallen; apart krijgt elk deel er hoogstens twee. */
const gewoon = verdeel(bestanden.filter(n => !GEISOLEERD.has(n)), deel);
const geïsoleerd = verdeel(bestanden.filter(n => GEISOLEERD.has(n)), deel);
if (deel) console.log('[tests] deel ' + deel.nr + ' van ' + deel.totaal);
console.log('[tests] ' + gewoon.length + ' bestanden, maximaal ' + concurrency + ' tegelijk');
let code = draai(gewoon, concurrency);
for (const naam of geïsoleerd) {
  console.log('[tests] geïsoleerd: ' + naam);
  const uit = draai([naam], 1);
  if (uit && !code) code = uit;
}
geefAfbouwSlotVrij();
process.exitCode = code;
