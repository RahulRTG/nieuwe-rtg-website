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
/* HET SLOT NIET TWEE KEER PAKKEN. pak() werpt als het bezet is, en dat is
   terecht -- maar een draaier die vanuit een toets wordt aangeroepen (zie
   `--toon` hieronder) draait binnen een run die het slot al heeft. Zelfde
   afspraak als test/meterijk.test.js: de ouder geeft het door met
   RTG_AFBOUW_SLOT_ACTIEF=1. */
const geefAfbouwSlotVrij = process.env.RTG_AFBOUW_SLOT_ACTIEF === '1'
  ? () => {}
  : pak('volledige Node-tests');
const TESTMAP = path.join(WORTEL, 'test');
const argv = process.argv.slice(2);
const reporter = (argv.find(a => a.startsWith('--reporter=')) || '').slice(11);
const selectie = (argv.find(a => a.startsWith('--bestanden=')) || '').slice(12)
  .split(',').map(s => s.trim()).filter(Boolean);
const { isGeisoleerd } = require('./lib/geisoleerd');

/* DE DEKKINGSVLOER HOORT HIER EN NIET IN EEN LOS COMMANDO.

   `test:gate` in package.json was tot 24 augustus 2026 een eigen aanroep:
   `node --test test/*.test.js` met de dekkingsvlaggen erachter. Dat is precies
   het commando dat de kop van dit bestand beschrijft als de reden dat deze
   draaier bestaat -- en het ging langs de isolatielijst heen. In CI is dat de
   ENIGE suite-run, dus daar zijn de acht bronmuterende toetsen nooit
   geisoleerd geweest. Vier toetsen zijn daar aantoonbaar op omgevallen zonder
   dat er iets mis was: test/excursie.test.js en test/horeca-host.test.js op
   CI, test/negenplus.test.js en test/schakelkast-dekking.test.js lokaal. Alle
   vier startten een server of scanden de bron terwijl envelop.test.js
   `function gastAuth(` had hernoemd of meterijk.test.js een tijdelijk bestand
   in public/apps/ had staan.

   De vloer geldt over de PARALLELLE groep. De acht geisoleerde bestanden
   draaien erna, een voor een, zonder vloer: node meet dekking per proces, dus
   een los bestand zou nooit 78% van de hele boom halen en de vloer zou dan
   alleen nog meten hoe groot dat ene bestand is. Ze draaien wel, en ze zakken
   ook gewoon. Wat de vloer dus zegt is: "de suite minus acht bestanden dekt
   zoveel" -- en dat getal staat in package.json, met de meting erbij in
   .github/workflows/ci.yml. */
const dekking = (argv.find(a => a.startsWith('--dekking=')) || '').slice(10)
  .split(',').map(s => s.trim()).filter(Boolean);
if (dekking.length && dekking.length !== 3) {
  console.error('[tests] --dekking wil drie getallen: regels,takken,functies');
  process.exit(2);
}

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

/* WIE HET JOURNAAL VRAAGT, KRIJGT HET WAAR HIJ HET VRAAGT.

   Hier stond onvoorwaardelijk `RTG_ROUTELOG: <wortel>/.routejournaal`, en dat
   overschreef de keuze van de aanroeper zonder iets te zeggen. De keuring zet
   die variabele zelf (RTG_ROUTELOG: $GITHUB_WORKSPACE/routejournaal.log) omdat
   een latere stap -- scripts/dekking.js --lees -- er een waargenomen
   dekkingscijfer uit haalt. Zolang test:gate een kaal `node --test` was, ging
   die variabele gewoon door; sinds hij via deze draaier loopt niet meer, en de
   stap erna zakte met "Het routejournaal bestaat niet. Draaide de suite met
   RTG_ROUTELOG gezet?" -- een vraag waarop het antwoord ja was.

   Een draaier die een meegegeven pad stil vervangt door zijn eigen pad, maakt
   van een goede vraag een verwarrende. Dus: het meegegeven pad wint, en de
   eigen keuze is alleen de terugval. */
const journaal = process.env.RTG_ROUTELOG || path.join(WORTEL, '.routejournaal');
try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const env = { ...process.env, RTG_ROUTELOG: journaal, RTG_AFBOUW_SLOT_ACTIEF: '1' };

function draai(namen, parallel, metVloer) {
  if (!namen.length) return 0;
  const args = ['--experimental-sqlite', '--test', '--test-concurrency=' + parallel];
  if (metVloer && dekking.length === 3) {
    args.push('--experimental-test-coverage',
      '--test-coverage-lines=' + dekking[0],
      '--test-coverage-branches=' + dekking[1],
      '--test-coverage-functions=' + dekking[2]);
  }
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

const gewoon = bestanden.filter(n => !isGeisoleerd(n));
const geïsoleerd = bestanden.filter(n => isGeisoleerd(n));

/* WAT ZOU JE DOEN? -- `--toon` drukt de indeling af en draait niets.

   Dit is er niet voor het gemak. test/bronmutanten.test.js bewaakt dat de
   isolatielijst bestaat en dat elke suite-opdracht via deze draaier loopt, maar
   het kon niet bewaken dat DEZE draaier de lijst ook echt toepast: die splits
   staat hier als losse regel, en een mutatie erop (`filter(n => true)`) liet
   geen enkele toets zakken. Een handhaver met een gat op de laatste meter is
   geen handhaver (LAT.md regel 10).

   De toets in een echte run laten kijken zou minuten kosten voor een
   bewering van een regel. Zo kost het niets, en een mens die zich afvraagt wat
   er straks apart draait, krijgt hetzelfde antwoord. */
if (argv.includes('--toon')) {
  console.log(JSON.stringify({ parallel: gewoon, geisoleerd: geïsoleerd, concurrency, dekking, journaal }, null, 2));
  geefAfbouwSlotVrij();
  process.exit(0);
}
console.log('[tests] ' + gewoon.length + ' bestanden, maximaal ' + concurrency + ' tegelijk' +
  (dekking.length ? ' (met dekkingsvloer ' + dekking.join('/') + ')' : ''));
let code = draai(gewoon, concurrency, true);
for (const naam of geïsoleerd) {
  console.log('[tests] geïsoleerd: ' + naam);
  const uit = draai([naam], 1, false);
  if (uit && !code) code = uit;
}
geefAfbouwSlotVrij();
process.exitCode = code;
