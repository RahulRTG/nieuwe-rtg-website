/* Betrouwbare nul-dependency testrunner voor de volledige Node-suite.

   De gewone `node --test test/*.test.js` liet ook bronmuterende meetproeven
   tegelijk lopen met scanners van diezelfde bron. Dan zag de ene test het
   tijdelijke ijkbestand van de andere en kon een geldige build rood worden.
   Daarnaast startte Node op grote machines zoveel servers tegelijk dat lokale
   healthchecks hun timeout haalden voordat de code aan de beurt kwam.

   Daarom: gewone bestanden begrensd parallel, bronmuterende ijkingen en de
   twee zwaarste hele-serverproeven daarna een voor een. Geen globbing, shell
   of npm-pakket nodig.

   DRIE VLAGGEN VOOR DE CI:

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
     --zonder-ijkingen  laat de zes bronmuterende ijkingen weg (scripts/lib/
                     ijkingen.js). De CI geeft die elk een eigen job: meterijk
                     alleen duurde 18 van de 19 minuten van het langste deel, en
                     achter een deel aansluiten is voor een ijking geen eis --
                     apart draaien is dat wel.

   Zonder die vlaggen gedraagt dit script zich precies als vroeger: dan draaien
   de ijkingen gewoon mee, een voor een, na de rest. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pak } = require('./afbouw-slot');
const { ontleedDeel, verdeel } = require('./lib/delen');
const { IJKINGEN } = require('./lib/ijkingen');
const { ZWAAR } = require('./lib/zwaar');
const { tapSamenvatting } = require('./lib/schermsuite-bewijs');

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
const dekkingWaarde = (argv.find(a => a.startsWith('--dekking=')) || '').slice(10);
const dekkingVloer = dekkingWaarde.includes(',')
  ? dekkingWaarde.split(',').map(s => s.trim()).filter(Boolean)
  : [];
const dekkingMap = dekkingVloer.length ? '' : dekkingWaarde;
if (dekkingVloer.length && (dekkingVloer.length !== 3 || dekkingVloer.some(n => !Number.isFinite(Number(n))))) {
  console.error('[tests] --dekking wil een map of drie getallen: regels,takken,functies');
  process.exit(2);
}
/* DE MODUS STAAT VOOR DE VERDELING, EN NIET ALLEEN VOOR DE METING. Hieronder
   verdeelt `verdeel()` de scherven op de gewichten uit TOETSDUUR.json, en welke
   gewichten dat zijn hangt af van de modus waarin DEZE ronde draait. Stond hij
   alleen in de omgeving van het kindproces, dan meet de loper `dekking` en
   verdeelt hij op `normaal` -- exact de fout waar deze hele laag voor is
   gebouwd, een niveau lager en net zo onzichtbaar.

   Draait er ook maar iets met dekking, dan is dat het model waarop de scherven
   gepland worden: die batches bepalen de looptijd. */
require('./lib/meetbron').zetModus(!!(dekkingMap || dekkingVloer.length === 3));

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
const zonderIjkingen = argv.includes('--zonder-ijkingen');
/* De zware toetsen krijgen in de keten een eigen job ZONDER dekking; met deze
   vlag laat een scherf ze weg. Lokaal draaien ze gewoon mee -- ze hoeven niet
   geisoleerd, ze zijn alleen duur. Zie scripts/lib/zwaar.js. */
const zonderZware = argv.includes('--zonder-zware');
/* DE SOLO-LIJST WOONT IN scripts/lib/geisoleerd.js. Hij stond hier, en dat was
   bijna goed: hij hoort bij deze loper. Maar dit bestand IS een script -- wie het
   met require() opent om alleen die lijst te lezen, start de hele suite. Dat is
   niet theoretisch; het is hier gebeurd. Een lijst die twee lezers heeft, hoort
   in een bestand dat niets doet als je het opent. */
const { isGeisoleerd } = require('./lib/geisoleerd');
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
/* DE TOETSIDENTITEIT REIST MEE. Elk toetsproces laadt test/toetsnaam.js voor,
   en die zet RTG_TOETS op de naam van het bestand dat draait. Vanaf daar erft
   ELK kindproces hem via de omgeving -- ook een server die niet via
   test/helper.js start. Zonder dit schreven de sporen van 565 toetsbestanden
   zich weg als `onbekend`, en dat is niet te onderscheiden van "deze toets
   raakt niets aan". NODE_OPTIONS is de enige plek waar node dat voor ELK
   kindproces tegelijk regelt; een meegegeven NODE_OPTIONS blijft staan. */
const VOORLADEN = '--require ' + JSON.stringify(path.join(WORTEL, 'test', 'toetsnaam.js'));
const nodeOpties = (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '') + VOORLADEN;
/* DE DUURMETING, en die schrijft ALTIJD mee. Hij kost per toetsbestand een
   append van een regel en hij is de invoer van de gewogen scherfverdeling
   (scripts/lib/delen.js). Wie hem alleen in CI zou aanzetten, meet alleen wat
   CI toevallig draaide; wie hem met een vlag zou aanzetten, meet nooit.
   Het meegegeven pad wint, zoals bij het routejournaal hierboven. */
const duurpad = process.env.RTG_TOETSDUUR || path.join(WORTEL, '.toetsduur');
/* De herkomst van de meting; een plek, en die is scripts/lib/meetbron.js. */
const BRON = require('./lib/meetbron').bron();

const env = { ...process.env, RTG_ROUTELOG: journaal, RTG_AFBOUW_SLOT_ACTIEF: '1',
  NODE_OPTIONS: nodeOpties, RTG_TOETSDUUR: duurpad, RTG_TOETSBRON: BRON };

/* HET JOURNAAL LEEGGOOIEN DOET ALLEEN WIE OOK ECHT GAAT DRAAIEN, en die regel
   is duur geleerd. De unlink stond hier onvoorwaardelijk, boven de --toon-poort
   verderop. Twee toetsen van deze tak roepen de draaier aan met --toon om te
   controleren dat de isolatielijst wordt toegepast; die aanroep draait niets,
   maar wiste wel het journaal -- MIDDEN IN DE SUITE, want die toetsen draaien
   zelf mee.

   Wat CI daarvan zag: `scripts/dekking.js --lees` telde 493 endpoints als
   "nooit aangeraakt" terwijl main op 4292 van 4292 stond. Niet omdat er iets
   minder werd aangeroepen, maar omdat het bewijs ervan halverwege was
   weggegooid. Een meter die het goede meet aan een leeggemaakt logboek, meldt
   een gat dat er niet is.

   `leegMaken()` staat daarom bij de plek waar er echt gedraaid wordt. */
function leegMaken() {
  try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

/* HOE LANG EEN BESTAND MAG DUREN, EN WAAROM DAT NIET EEN GETAL IS.

   Tien minuten voor een gewoon toetsbestand: wie dan niet klaar is, hangt.

   De IJKINGEN zijn een ander soort werk. meterijk draait elke geijkte meter
   een keer op een geplante fout, en sommige van die meters lopen zelf het hele
   huis af; gemeten op 31 augustus 2026 duurde dat 650 seconden. Met tien
   minuten werd die ijking in een volle lokale ronde dus AFGEBROKEN -- en een
   afgebroken ijking zegt niets, terwijl hij in de samenvatting niet als gezakt
   telt. De CI wist dit al en geeft elke ijking een eigen job met 45 minuten
   (.github/workflows/ci.yml); lokaal stond er per ongeluk de grens van een
   ander soort bestand.

   DEZE GRENS MOET HIER STAAN EN KAN NIET IN DE TOETS. Een `{ timeout }` bij
   een test binnen het bestand komt te laat: node hangt de tijdgrens aan het
   BESTAND (de uitvoer noemt "Subtest: test/meterijk.test.js" op regel 1) en
   breekt het geheel af voordat de eigen grens van een test aan de beurt is.
   Dat is nagemeten: met veertig minuten in het bestand zelf zakte hij nog
   steeds na exact 600018 ms.

   Veertig minuten is ruim boven de gemeten 650 seconden en ruim onder de
   jobgrens van de CI, zodat een ijking die werkelijk hangt nog steeds opvalt.
   Verlaag hem niet om een trage machine te dwingen, en verhoog hem niet zonder
   de meting erbij te zetten. */
const TIJDGRENS = 600000;
const TIJDGRENS_IJKING = 40 * 60 * 1000;

let batch = 0;
const batchBewijzen = [];
function draai(namen, parallel, metVloer, tijdgrens) {
  if (!namen.length) return 0;
  /* --test-force-exit vangt de andere hanger af: alle toetsen zijn klaar, maar
     een gelekt handvat houdt het kindproces anders onbeperkt open. */
  const args = ['--test', '--test-concurrency=' + parallel,
    '--test-timeout=' + (tijdgrens || TIJDGRENS), '--test-force-exit'];
  if (metVloer && dekkingVloer.length === 3) {
    args.push('--experimental-test-coverage',
      '--test-coverage-lines=' + dekkingVloer[0],
      '--test-coverage-branches=' + dekkingVloer[1],
      '--test-coverage-functions=' + dekkingVloer[2]);
  }
  if (dekkingMap) {
    fs.mkdirSync(dekkingMap, { recursive: true });
    const merk = deel ? 'deel-' + deel.nr
      : (selectie.length === 1 ? selectie[0].replace(/\.test\.js$/, '') : 'alles');
    const naam = merk + '-' + (++batch) + '.info';
    args.push('--experimental-test-coverage',
      '--test-reporter=' + (reporter || 'tap'), '--test-reporter-destination=stdout',
      '--test-reporter=lcov', '--test-reporter-destination=' + path.join(dekkingMap, naam));
  } else {
    args.push('--test-reporter=' + (reporter || 'spec'), '--test-reporter-destination=stdout');
  }
  /* De zichtbare reporter is voor mensen; een tweede TAP-stroom is het
     machinaal bewijs. Exitcode nul alleen ziet skips en todo's niet. Iedere
     batch krijgt daarom een eigen, door Node geschreven TAP-samenvatting. */
  const tapPad = path.join(os.tmpdir(), 'rtg-unit-tap-' + process.pid + '-' + (++batch) + '.tap');
  args.push('--test-reporter=tap', '--test-reporter-destination=' + tapPad);
  args.push(...namen.map(n => path.join('test', n)));
  /* DE MODUS HOORT BIJ DEZE BATCH EN NIET BIJ DE RONDE. Dekking staat per
     aanroep aan (een vloer, of een lcov-map), dus een ronde kan batches met en
     zonder dekking bevatten. Wie de modus een ronde-eigenschap maakt, plakt het
     verkeerde etiket op de helft van de metingen. */
  const metDekking = !!(dekkingMap || (metVloer && dekkingVloer.length === 3));
  const r = spawnSync(process.execPath, args, {
    cwd: WORTEL, stdio: 'inherit', timeout: 90 * 60 * 1000,
    env: { ...env, RTG_TOETSMODUS: metDekking ? 'dekking' : 'normaal' }
  });
  try {
    batchBewijzen.push(tapSamenvatting(fs.readFileSync(tapPad, 'utf8')));
  } catch (e) {
    batchBewijzen.push(tapSamenvatting(''));
  } finally { try { fs.unlinkSync(tapPad); } catch (e) {} }
  if (r.error) {
    console.error('[tests] runnerfout:', r.error.message);
    return 2;
  }
  return r.status == null ? 2 : r.status;
}

const gewoon = verdeel(bestanden.filter(n => !isGeisoleerd(n) &&
  (!zonderZware || selectie.length || !ZWAAR.includes(n))), deel);
const geïsoleerd = verdeel(bestanden.filter(n => isGeisoleerd(n) &&
  (!zonderIjkingen || selectie.length || !IJKINGEN.includes(n))), deel);

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
  console.log(JSON.stringify({ parallel: gewoon, geisoleerd: geïsoleerd, concurrency,
    dekking: dekkingMap || dekkingVloer, journaal }, null, 2));
  geefAfbouwSlotVrij();
  process.exit(0);
}
leegMaken();
console.log('[tests] ' + gewoon.length + ' bestanden, maximaal ' + concurrency + ' tegelijk' +
  (dekkingMap ? ' (dekking naar ' + dekkingMap + ')'
    : (dekkingVloer.length ? ' (met dekkingsvloer ' + dekkingVloer.join('/') + ')' : '')));
if (deel) console.log('[tests] deel ' + deel.nr + ' van ' + deel.totaal);
if (zonderIjkingen && !selectie.length) console.log('[tests] zonder de losse ijkingen; die draaien in de CI elk in een eigen job');
if (zonderZware && !selectie.length) console.log('[tests] zonder de zware toetsen; die draaien in de CI elk in een eigen job, zonder dekking');
let code = draai(gewoon, concurrency, true);
for (const naam of geïsoleerd) {
  console.log('[tests] geïsoleerd: ' + naam);
  const uit = draai([naam], 1, false, IJKINGEN.includes(naam) ? TIJDGRENS_IJKING : TIJDGRENS);
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
if (!selectie.length && !deel && !zonderIjkingen && !zonderZware) {
  try {
    const { exactStempel } = require('./lib/stempel');
    const bestandenSha256 = crypto.createHash('sha256').update(bestanden.join('\n') + '\n').digest('hex');
    const tel = naam => batchBewijzen.reduce((t, b) => t + (Number.isSafeInteger(b[naam]) ? b[naam] : 0), 0);
    const tapVolledig = batchBewijzen.length > 0 && batchBewijzen.every(b => b.volledig);
    const telling = { tapVolledig, tests:tel('tests'), geslaagdeTests:tel('geslaagdeTests'),
      mislukt:tel('mislukt'), geannuleerd:tel('geannuleerd'),
      overgeslagen:tel('overgeslagen'), todo:tel('todo') };
    const zonderStilte = tapVolledig && telling.tests > 0 && telling.mislukt === 0 &&
      telling.geannuleerd === 0 && telling.overgeslagen === 0 && telling.todo === 0;
    if (code === 0 && !zonderStilte) code = 1;
    fs.writeFileSync(path.join(WORTEL, 'SUITE.json'), JSON.stringify({
      stempel: exactStempel(),
      uitleg: 'De laatste VOLLE testronde: wanneer, waartegen, en of hij groen was. ' +
        'scripts/versheid.js leest dit als elk ander register, zodat een suite die achterloopt ' +
        'net zo hard opvalt als een register dat achterloopt.',
      grens: 'zegt niets over WELKE toets zakte -- dat staat in de uitvoer van de ronde zelf. ' +
        'Hij zegt alleen dat er een volle ronde is geweest, wanneer, en met welke uitkomst.',
      hoe: 'npm test',
      gemeten: { volledig: true, bestanden: bestanden.length, bestandenSha256,
        afsluitcode: code, groen: code === 0, ...telling }
    }, null, 1) + '\n');
  } catch (e) {
    console.error('[tests] kon SUITE.json niet schrijven: ' + e.message);
    if (code === 0) code = 1;
  }
}

process.exitCode = code;
