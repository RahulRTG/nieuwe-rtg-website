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
/* DE SOLO-LIJST WOONT IN scripts/lib/geisoleerd.js. Hij stond hier, en dat was
   bijna goed: hij hoort bij deze loper. Maar dit bestand IS een script -- wie het
   met require() opent om alleen die lijst te lezen, start de hele suite. Dat is
   niet theoretisch; het is hier gebeurd. Een lijst die twee lezers heeft, hoort
   in een bestand dat niets doet als je het opent. */
const { GEISOLEERD } = require('./lib/geisoleerd');
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
  const args = ['--test', '--test-concurrency=' + parallel];
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

/* ---- HET STEMPEL VAN DE VOLLE RONDE ----

   DE STILTE DIE DIT DICHT. Zestien toetsen zakten aan de geldkant en niemand
   wist het, want na de verandering die ze brak is er geen volle suite meer
   gedraaid. De losse toetsen die er wel langsgingen waren groen; de registers
   waren vers; de keuring was schoon. Er was geen enkele plek waar te zien was
   dat de LAATSTE VOLLE RONDE van dertig commits geleden was.

   Dit huis heeft daar al gereedschap voor: scripts/versheid.js zegt van elk
   register "gemeten op <commit>, sindsdien zijn N codebestanden gewijzigd".
   Wat ontbrak was dat de suite zelf ook een register achterliet. Nu wel, en
   daarmee valt zijn veroudering op dezelfde manier op als die van elk ander.

   ALTIJD SCHRIJVEN, OOK BIJ ROOD. Een ronde die zakt is ook een feit, en juist
   dat feit hoort niet te verdwijnen doordat iemand hem niet afmaakt.

   ALLEEN BIJ EEN VOLLE RONDE. Wie `node scripts/test-runner.js pay.test.js`
   draait heeft de suite niet gedraaid; dat stempel zou de meter laten liegen
   op precies het punt waarvoor hij bestaat. */
if (!selectie.length) {
  try {
    const { stempel } = require('./lib/stempel');
    fs.writeFileSync(path.join(WORTEL, 'SUITE.json'), JSON.stringify({
      stempel: stempel(),
      uitleg: 'De laatste VOLLE testronde: wanneer, waartegen, en of hij groen was. ' +
        'scripts/versheid.js leest dit als elk ander register, zodat een suite die achterloopt ' +
        'net zo hard opvalt als een register dat achterloopt.',
      grens: 'zegt niets over WELKE toets zakte -- dat staat in de uitvoer van de ronde zelf. ' +
        'Hij zegt alleen dat er een volle ronde is geweest, wanneer, en met welke uitkomst.',
      hoe: 'npm test',
      gemeten: { bestanden: bestanden.length, afsluitcode: code, groen: code === 0 }
    }, null, 1) + '\n');
  } catch (e) { console.error('[tests] kon SUITE.json niet schrijven: ' + e.message); }
}

process.exitCode = code;
