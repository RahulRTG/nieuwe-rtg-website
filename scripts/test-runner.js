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

   Die staart is daarna grotendeels opgeruimd door de oorzaak weg te nemen; zie
   de kop bij GEISOLEERD hieronder. De twee waarnemingen eronder gelden nog
   steeds, en ze zijn allebei het tegenovergestelde van wat je zou gokken.

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

   DE VOLGORDE BLIJFT ALFABETISCH, EN DAT IS EEN GEMETEN BESLUIT.

   Hier heeft "traagste eerst" gestaan (Longest Processing Time First), gevoed
   door het tijdjournaal. Het klonk goed en het leverde drie keer niets op:

     40 bestanden   alfabetisch 55 s   traagste eerst 56 en 57 s
     907 bestanden  alfabetisch 1515 s traagste eerst 1534 s

   De reden staat in het cijfer erboven: de batch draait op factor 3,2 van de 4
   en dat komt NIET doordat er een lange staart achteraan bungelt. Het komt
   doordat meterijk.test.js zelf een subprocesstorm is -- hij start een stuk of
   twintig keuringen, elk een eigen proces -- en die rekenen mee op dezelfde vier
   kernen als de vier toetswerkers. De machine is overtekend, niet slecht
   gepland. Een andere startvolgorde verplaatst dan alleen wie er wacht.

   Dus is de sortering eruit. Een optimalisatie die drie metingen lang nul geeft
   is geen verzekering maar losse complexiteit, en alfabetisch heeft er nog een
   voordeel bij: dezelfde volgorde bij elke ronde. Wie hem terugzet, zet er een
   meting bij (LAT-regel 10).

   WAT WEL BLIJFT is het journaal en de lijst onderaan. Daar bestond geen enkele
   bron voor -- node --test schrijft in TAP-modus geen bestandstotalen -- en elk
   getal in deze kop komt eruit. Het journaal staat in .gitignore: het is een
   meting van DEZE machine en geen eigenschap van de code. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pak } = require('./afbouw-slot');

const WORTEL = path.join(__dirname, '..');
const geefAfbouwSlotVrij = pak('volledige Node-tests');

/* WELKE SERVERS ZIJN ER BLIJVEN STAAN?

   Op 24 augustus stond er tijdens een ronde een server/server.js met PPID 1:
   geen ouder meer, dus achtergebleven uit een toetskind dat wel afsloot en zijn
   server niet meenam. Hij draaide de HELE ronde mee op 2% CPU en at een van de
   vier kernen aan. Niemand merkte het: de ronde was gewoon groen, alleen trager,
   en "trager" leest als een drukke machine.

   Dat is precies de stille vorm van LAT-regel 5 -- niets faalt zichtbaar, het
   antwoord wordt alleen langzamer en de metingen erboven onvergelijkbaar. Een
   lek dat je alleen ziet als je toevallig ps draait, bestaat in de praktijk niet.

   Dus telt de ronde ze, voor en na. Wat er vooraf al stond is niet van ons (een
   ontwikkelserver mag gewoon draaien); wat er tijdens de ronde bijkomt en na
   afloop nog leeft, is een lek. De ronde noemt het met PID en al.

   Bewust GEEN kill: dit gereedschap ruimt niet op wat het niet heeft gemaakt.
   Een runner die stilletjes processen afschiet, verbergt hetzelfde probleem op
   een andere manier -- en op een ontwikkelmachine schiet hij dan de server af
   waar iemand in staat te werken. */
function draaiendeServers() {
  try {
    const uit = spawnSync('ps', ['-eo', 'pid,ppid,cmd'], { encoding: 'utf8' });
    if (uit.status !== 0 || !uit.stdout) return null;         // geen ps: dan weten we niets
    const wezen = new Map();
    for (const regel of uit.stdout.split('\n')) {
      const m = regel.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!m) continue;
      if (m[2] !== '1') continue;                             // alleen wat geen ouder meer heeft
      if (!m[3].includes(path.join(WORTEL, 'server', 'server.js'))) continue;
      wezen.set(m[1], m[3].slice(0, 120));
    }
    return wezen;
  } catch (e) { return null; }
}
/* `null` betekent "niet kunnen kijken" en niet "niets gevonden" -- die twee uit
   elkaar houden is het hele punt van LAT-regel 3. */
const wezenVooraf = draaiendeServers();
const TESTMAP = path.join(WORTEL, 'test');
const TIJDEN = path.join(WORTEL, '.testtijden.json');
const TIJDEN_RUW = path.join(WORTEL, '.testtijden.ruw');
const argv = process.argv.slice(2);
const reporter = (argv.find(a => a.startsWith('--reporter=')) || '').slice(11);
const selectie = (argv.find(a => a.startsWith('--bestanden=')) || '').slice(12)
  .split(',').map(s => s.trim()).filter(Boolean);
/* DE DEKKINGSVLOER, VIA DEZE RUNNER EN NIET ERNAAST.

   De CI-poort draaide `npm run test:gate`: een kale `node --test test/*.test.js`
   met dekkingsvlakken erbij. Dat is een TWEEDE draaier voor dezelfde suite, en
   twee draaiers voor een ding lopen uiteen (LAT-regel 4) -- dat is hier ook
   gebeurd: de isolatie die deze runner uitvoerde, kende die poort niet.

   `--dekking=regels,takken,functies` laat deze runner die rol overnemen. De
   vloer geldt over de BATCH; de vier belasting-geisoleerde bestanden draaien er
   zonder dekkingsmeting achteraan, want node kan de meting van meerdere
   processen niet optellen. Wat dat voor de vloer betekent staat in de commit die
   hem invoerde, gemeten en niet geschat. */
const dekking = (argv.find(a => a.startsWith('--dekking=')) || '').slice(10)
  .split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0);
if (argv.some(a => a.startsWith('--dekking=')) && dekking.length !== 3) {
  console.error('[tests] --dekking wil drie getallen: regels,takken,functies');
  process.exit(2);
}
/* WAT HIER NIET MEER STAAT, EN WAAROM DAT DE HELE WINST IS.

   Hier stonden ook keuring.test.js en meterijk.test.js, en die twee waren
   samen goed voor 866 van de 941 seconden seriele staart. Ze stonden er omdat
   ze hun proefbestand in de ECHTE boom neerlegden: meterijk zet twintig keer
   iets bekend-fouts neer om te zien of een meter uitslaat, keuring.test.js legt
   een dode module neer. Andere toetsen scannen diezelfde boom, dus moesten die
   twee alleen draaien.

   Dat was een pleister op een oorzaak (LAT-regel 1). De oorzaak is weg: allebei
   werken ze nu in een wegwerpkopie (scripts/lib/ephemere-boom.js, 1,4 s), en
   check.js regel 51 houdt vol dat geen enkele toets nog in de gedeelde bronboom
   schrijft. Daarmee is de isolatie overbodig -- en, belangrijker dan de tijd:
   de CI-poort draait `npm run test:gate`, een kale `node --test test/*.test.js`
   die deze lijst nooit heeft gekend. Zolang de lijst nodig was, waren "groen
   lokaal" en "groen in CI" niet dezelfde bewering.

   WAT ER WEL BLIJFT STAAN zijn vier bestanden die hier om een ANDERE reden
   staan: niet mutatie maar belasting. Ze zetten elk een hele server op en
   liepen onder volle machine tegen hun eigen healthcheck-grens. Samen kosten ze
   75 s; dat is de moeite van dat risico nu niet waard. Wie ze er ooit afhaalt,
   haalt ze er een voor een af en meet erbij. */
const GEISOLEERD = new Set([
  'boot-smoke.test.js',
  'grens-sweep.test.js',
  'klok.test.js',
  'zaakdoos.test.js'
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

const journaal = path.join(WORTEL, '.routejournaal');
try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }
try { fs.unlinkSync(TIJDEN_RUW); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const env = { ...process.env, RTG_ROUTELOG: journaal, RTG_AFBOUW_SLOT_ACTIEF: '1', RTG_TESTTIJDEN_RUW: TIJDEN_RUW };

function draai(namen, parallel, metDekking) {
  if (!namen.length) return 0;
  const args = ['--experimental-sqlite', '--test', '--test-concurrency=' + parallel];
  if (metDekking && dekking.length === 3) {
    args.push('--experimental-test-coverage',
      '--test-coverage-lines=' + dekking[0],
      '--test-coverage-branches=' + dekking[1],
      '--test-coverage-functions=' + dekking[2]);
  }
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
console.log('[tests] ' + gewoon.length + ' bestanden, maximaal ' + concurrency + ' tegelijk (alfabetisch)');
const begon = Date.now();
let code = draai(gewoon, concurrency, true);
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

/* En de tegenmeting: welke servers zijn er tijdens deze ronde ouderloos
   geworden en nog steeds in leven? */
const wezenNa = draaiendeServers();
if (wezenVooraf && wezenNa) {
  const nieuw = [...wezenNa].filter(([pid]) => !wezenVooraf.has(pid));
  if (nieuw.length) {
    console.error('\n[tests] LEK: ' + nieuw.length + ' server(s) uit deze ronde draaien nog en hebben geen ouder meer.');
    for (const [pid, cmd] of nieuw) console.error('        PID ' + pid + '  ' + cmd);
    console.error('        Een toets start een server en neemt hem niet mee bij het afsluiten.');
    console.error('        Hij eet een kern op zolang hij leeft, en maakt elke meting hierboven onvergelijkbaar.');
    console.error('        Opruimen doet deze runner niet: hij schiet niet af wat hij niet heeft gemaakt.');
    if (!code) code = 1;
  }
} else if (!wezenNa) {
  console.log('[tests] (kon niet nakijken of er servers zijn blijven staan: ps gaf niets)');
}

geefAfbouwSlotVrij();
process.exitCode = code;
