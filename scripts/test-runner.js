/* Betrouwbare nul-dependency testrunner voor de volledige Node-suite.

   De gewone `node --test test/*.test.js` liet ook bronmuterende meetproeven
   tegelijk lopen met scanners van diezelfde bron. Dan zag de ene test het
   tijdelijke ijkbestand van de andere en kon een geldige build rood worden.
   Daarnaast startte Node op grote machines zoveel servers tegelijk dat lokale
   healthchecks hun timeout haalden voordat de code aan de beurt kwam.

   Daarom: gewone bestanden begrensd parallel, bronmuterende ijkingen en de
   twee zwaarste hele-serverproeven daarna een voor een. Geen globbing, shell
   of npm-pakket nodig. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pak } = require('./afbouw-slot');

const WORTEL = path.join(__dirname, '..');
const geefAfbouwSlotVrij = pak('volledige Node-tests');
const TESTMAP = path.join(WORTEL, 'test');
const argv = process.argv.slice(2);
const reporter = (argv.find(a => a.startsWith('--reporter=')) || '').slice(11);
const selectie = (argv.find(a => a.startsWith('--bestanden=')) || '').slice(12)
  .split(',').map(s => s.trim()).filter(Boolean);
const GEISOLEERD = new Set([
  'boot-smoke.test.js',
  'grens-sweep.test.js',
  'klok.test.js',
  'zaakdoos.test.js',
  'keuring.test.js',
  'meterijk.test.js',
  /* vloot.test.js start VIER volledige RTG-servers tegelijk (de poortwachter en
     drie groepen). Naast drie andere bestanden op een machine met vier kernen
     vechten die om dezelfde CPU's, en dan haalt de opkomst het budget niet: op
     27 augustus 2026 zakte hij met kantoor en rtf op 502 -- de gateway stond,
     de groepen niet -- met een SQLite-lock ernaast. Los gedraaid is hij groen.

     Hij hoort hier dus thuis om dezelfde reden als de twee zware serverproeven
     hierboven, en het budget wordt NIET nog een keer opgerekt: dat is een keer
     gebeurd (30s -> 120s, zie de kop van die toets) en een tweede keer zou het
     symptoom behandelen in plaats van de oorzaak. */
  'vloot.test.js'
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

const journaal = path.join(WORTEL, '.routejournaal');
try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const env = { ...process.env, RTG_ROUTELOG: journaal, RTG_AFBOUW_SLOT_ACTIEF: '1' };

function draai(namen, parallel) {
  if (!namen.length) return 0;
  const args = ['--experimental-sqlite', '--test', '--test-concurrency=' + parallel];
  if (reporter) args.push('--test-reporter=' + reporter);
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

const gewoon = bestanden.filter(n => !GEISOLEERD.has(n));
const geïsoleerd = bestanden.filter(n => GEISOLEERD.has(n));
console.log('[tests] ' + gewoon.length + ' bestanden, maximaal ' + concurrency + ' tegelijk');
let code = draai(gewoon, concurrency);
for (const naam of geïsoleerd) {
  console.log('[tests] geïsoleerd: ' + naam);
  const uit = draai([naam], 1);
  if (uit && !code) code = uit;
}
geefAfbouwSlotVrij();
process.exitCode = code;
