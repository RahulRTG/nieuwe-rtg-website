/* Betrouwbare nul-dependency testrunner voor de volledige Node-suite.

   De gewone `node --test test/*.test.js` liet ook bronmuterende meetproeven
   tegelijk lopen met scanners van diezelfde bron. Dan zag de ene test het
   tijdelijke ijkbestand van de andere en kon een geldige build rood worden.
   Daarnaast startte Node op grote machines zoveel servers tegelijk dat lokale
   healthchecks hun timeout haalden voordat de code aan de beurt kwam.

   Daarom: gewone bestanden begrensd parallel, bronmuterende ijkingen en de
   twee zwaarste hele-serverproeven daarna een voor een. Geen globbing, shell
   of npm-pakket nodig.

   WAT DEZE RONDE KOST, GEMETEN OP 23 AUGUSTUS 2026 (4 kernen, 907 bestanden):

     wandklok             1882 s
       de batch            941 s voor 3749 s werk  -> factor 4,0x parallel
       de zes geisoleerde  941 s serieel, 3 van de 4 kernen stil
         waarvan meterijk  794 s

   Twee dingen staan daarmee vast, en ze zijn allebei het tegenovergestelde van
   wat je zou gokken.

   1. DE BATCH IS AF. Vier werkers op vier kernen, factor 4,0 -- daar zit geen
      seconde meer in. Meer tegelijk draaien maakt het ERGER: bij 8 tegelijk
      loopt de opgetelde tijd van 218 naar 450 seconden zonder dat de wandklok
      zakt (gemeten op een deelverzameling van 40 bestanden). De grens hierboven
      op availableParallelism() klopt dus; laat hem staan.

   2. DE HELFT VAN DE WANDKLOK IS DE SERIELE STAART, en 84% daarvan is een
      bestand: meterijk.test.js. Dat is geen traagheid maar rekenwerk --
      test/meterijk.test.js roept norm.meet() een stuk of twintig keer aan, en
      elke aanroep start scripts/keuring.js opnieuw over de hele codebase (35,7 s
      gemeten, los). Wie de suite verder wil versnellen moet daar zijn: laat de
      keuring een DEELVERZAMELING meters meten, want elke proef daar kijkt naar
      precies een getal. Dat is de eerstvolgende grote knop, en hij zit niet in
      dit bestand.

   DE VOLGORDE. Hier stond `.sort()`, alfabetisch. Sinds
   scripts/lib/tijdreporter.js de tijden opschrijft, kan de ronde de traagste
   bestanden eerst starten (Longest Processing Time First). EERLIJK GEZEGD: dat
   leverde bij de meting hierboven NIETS op -- 55 s alfabetisch tegen 56 en 57 s
   met journaal, en dat kan ook niet anders bij een batch die al op factor 4,0
   draait. Het staat er als verzekering en niet als winst: gaat er ooit een
   bestand van minuten in de batch zitten, dan bepaalt zijn startmoment wel de
   wandklok. Zet er dus geen getal bij dat er niet is (LAT-regel 10).

   Wat het journaal WEL opleverde is de tabel hierboven. Voor die tabel bestond
   er geen enkele bron: node --test schrijft in TAP-modus geen bestandstotalen,
   dus "welke toets is traag" was hier een vraag waar je een eigen meting voor
   moest opzetten. De lijst onderaan een ronde is daarmee het nuttigste deel van
   deze wijziging, niet de sortering.

   Een bestand dat nog niet in het journaal staat (nieuw of net hernoemd) gaat
   VOOROP: over de duur ervan weten we niets, en onbekend werk vroeg beginnen
   kost hooguit een plek in de rij terwijl het aan het eind de ronde kan
   verlengen. De eerste ronde op een verse checkout heeft geen journaal en valt
   terug op alfabetisch -- precies zoals het was. Het journaal staat in
   .gitignore: het is een meting van DEZE machine en hoort niet in de repo. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pak } = require('./afbouw-slot');

const WORTEL = path.join(__dirname, '..');
const geefAfbouwSlotVrij = pak('volledige Node-tests');
const TESTMAP = path.join(WORTEL, 'test');
const TIJDEN = path.join(WORTEL, '.testtijden.json');
const TIJDEN_RUW = path.join(WORTEL, '.testtijden.ruw');
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

/* Het tijdjournaal van de vorige rondes. Kapot of afwezig is geen fout: dan
   weten we niets en draaien we alfabetisch, zoals altijd. */
function leesTijden() {
  try {
    const rauw = JSON.parse(fs.readFileSync(TIJDEN, 'utf8'));
    return rauw && typeof rauw === 'object' && rauw.bestanden && typeof rauw.bestanden === 'object'
      ? rauw.bestanden : {};
  } catch (e) { return {}; }
}
const bekend = leesTijden();
const msVan = (n) => Number(bekend['test/' + n]) || 0;
const onbekendAantal = bestanden.filter(n => !msVan(n)).length;
/* Longest first, onbekend vooraan. De alfabetische volgorde blijft de
   tiebreaker, zodat twee even dure bestanden niet elke ronde van plek wisselen
   en een verschil in uitkomst niet aan de volgorde kan liggen. */
bestanden.sort((a, b) => {
  const ma = msVan(a), mb = msVan(b);
  if (!ma && !mb) return a < b ? -1 : a > b ? 1 : 0;
  if (!ma) return -1;
  if (!mb) return 1;
  return mb - ma || (a < b ? -1 : a > b ? 1 : 0);
});

const journaal = path.join(WORTEL, '.routejournaal');
try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }
try { fs.unlinkSync(TIJDEN_RUW); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const env = { ...process.env, RTG_ROUTELOG: journaal, RTG_AFBOUW_SLOT_ACTIEF: '1', RTG_TESTTIJDEN_RUW: TIJDEN_RUW };

function draai(namen, parallel) {
  if (!namen.length) return 0;
  const args = ['--experimental-sqlite', '--test', '--test-concurrency=' + parallel];
  /* De tijdmeter komt ERBIJ, niet in plaats van. Zodra je node een tweede
     --test-reporter meegeeft vervalt zijn eigen standaard, dus die zetten we
     hier expliciet met dezelfde regel die node zelf hanteert (spec op een
     terminal, tap erbuiten). Vergeet je dat, dan draait de suite stil. */
  args.push('--test-reporter=' + (reporter || (process.stdout.isTTY ? 'spec' : 'tap')));
  args.push('--test-reporter-destination=stdout');
  args.push('--test-reporter=' + path.join(__dirname, 'lib', 'tijdreporter.js'));
  args.push('--test-reporter-destination=stdout');   // hij zendt niets uit; hij schrijft
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

/* De ruwe metingen samenvoegen met wat er al stond. Gedempt (60% nieuw, 40%
   oud) zodat een eenmalig trage ronde -- een machine die net iets anders deed --
   de volgorde niet omgooit, maar een bestand dat echt trager wordt wel binnen
   een paar rondes vooraan staat. */
function verwerkTijden() {
  let regels = [];
  try { regels = fs.readFileSync(TIJDEN_RUW, 'utf8').split('\n').filter(Boolean); } catch (e) { return null; }
  const nu = {};
  for (const r of regels) {
    try {
      const o = JSON.parse(r);
      if (o && o.bestand && Number.isFinite(o.ms)) nu[o.bestand] = Math.max(nu[o.bestand] || 0, o.ms);
    } catch (e) { /* halve regel van twee gelijktijdige appends: overslaan */ }
  }
  if (!Object.keys(nu).length) return null;
  const samen = { ...bekend };
  for (const [b, ms] of Object.entries(nu)) {
    samen[b] = samen[b] ? Math.round(0.6 * ms + 0.4 * samen[b]) : ms;
  }
  try {
    fs.writeFileSync(TIJDEN, JSON.stringify({
      uitleg: 'Wandkloktijd per toetsbestand in ms, gedempt over rondes. Geschreven door scripts/test-runner.js; alleen voor de volgorde en het overzicht hieronder. Weggooien mag.',
      gemetenOp: new Date().toISOString(), concurrency, bestanden: samen
    }, null, 1) + '\n');
  } catch (e) { console.warn('[tests] tijdjournaal niet geschreven: ' + e.message); }
  try { fs.unlinkSync(TIJDEN_RUW); } catch (e) {}
  return nu;
}

const gewoon = bestanden.filter(n => !GEISOLEERD.has(n));
const geïsoleerd = bestanden.filter(n => GEISOLEERD.has(n));
console.log('[tests] ' + gewoon.length + ' bestanden, maximaal ' + concurrency + ' tegelijk'
  + (onbekendAantal === bestanden.length
    ? ' (geen tijdjournaal: alfabetisch)'
    : ' (traagste eerst; ' + onbekendAantal + ' zonder gemeten tijd vooraan)'));
const begon = Date.now();
let code = draai(gewoon, concurrency);
for (const naam of geïsoleerd) {
  console.log('[tests] geïsoleerd: ' + naam);
  const uit = draai([naam], 1);
  if (uit && !code) code = uit;
}

/* WAT DE RONDE KOSTTE, EN WAARAAN. Zonder deze regels blijft "de suite is
   traag" een gevoel, en een gevoel kun je niet repareren. */
const gemeten = verwerkTijden();
const wandklok = Math.round((Date.now() - begon) / 1000);
if (gemeten) {
  const lijst = Object.entries(gemeten).sort((a, b) => b[1] - a[1]);
  const somMs = lijst.reduce((s, x) => s + x[1], 0);
  console.log('\n[tests] ronde: ' + wandklok + ' s wandklok, ' + Math.round(somMs / 1000)
    + ' s opgeteld over ' + lijst.length + ' bestanden (factor '
    + (wandklok ? (somMs / 1000 / wandklok).toFixed(1) : '-') + 'x parallel).');
  console.log('[tests] traagste bestanden:');
  for (const [b, ms] of lijst.slice(0, 12)) {
    console.log('        ' + String(Math.round(ms / 1000)).padStart(5) + ' s  ' + b);
  }
  const top = lijst.slice(0, 12).reduce((s, x) => s + x[1], 0);
  console.log('        ^ samen ' + Math.round(100 * top / somMs) + '% van de opgetelde tijd.');
} else {
  console.log('\n[tests] ronde: ' + wandklok + ' s wandklok (geen tijden gemeten).');
}

geefAfbouwSlotVrij();
process.exitCode = code;
