#!/usr/bin/env node
/* ============================================================================
   DE WAARGENOMEN DEKKING -- welke endpoints zijn tijdens de testrun echt geraakt.

   HET VERSCHIL MET DE TELLER IN DE KEURING

   scripts/keuring.js zoekt de naam van een route op in de TEKST van de tests.
   Dat is een benadering, en hij zit er twee kanten op naast:

     - te laag, want een test die een hulpje gebruikt roept de route wel aan
       maar noemt hem niet (de hele Rechterhand-suite telde zo als ongetest);
     - te hoog, want een pad in een commentaarregel telt gewoon mee. Het cijfer
       is dus met een zoek-en-vervang op te poetsen zonder ook maar een test te
       schrijven.

   Dit script vraagt het niet aan de tekst maar aan de server. Met RTG_ROUTELOG
   gezet schrijft server/routelog.js elk afgehandeld routepatroon weg. Wat in
   dat journaal staat is aangeroepen; wat er niet in staat, niet. Daar valt
   niets aan te praten en het is met geen enkele opmaaktruc te beinvloeden.

   DRAAIEN

     node --experimental-sqlite scripts/dekking.js              (draait de suite zelf)
     node --experimental-sqlite scripts/dekking.js --lees <bestand>
     node --experimental-sqlite scripts/dekking.js --json
     node --experimental-sqlite scripts/dekking.js --vastleggen

   In CI draait de suite toch al: die stap krijgt RTG_ROUTELOG mee en deze stap
   leest het journaal met --lees. Dat kost dus niets extra's.

   TWEE METERS, allebei in NORM.json en allebei HIER bewaakt (niet in
   scripts/norm.js -- die meet zonder de suite te draaien en kan deze cijfers
   niet zelf vaststellen): dekkingWaargenomenPct als vloer, en
   endpointsNooitAangeraakt als plafond. Die tweede is de scherpe: een afgerond
   percentage dekt bij 2530 routes tot een stuk of twaalf endpoints die nooit
   zijn aangeraakt, en de run die dit op 100% zette had er nog twee liggen --
   waaronder de knop waarmee je bewijst dat je alarmering werkt.
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const NORMBESTAND = path.join(WORTEL, 'NORM.json');
const METER = 'dekkingWaargenomenPct';
const RICHTING = 'omhoog';           // een vloer: minder waargenomen dekking is slechter
// een AANTAL en geen percentage: staat hij op 0, dan valt een nieuw endpoint
// zonder toets niet meer weg in een afronding (zie de kop)
const METER_N = 'endpointsNooitAangeraakt';
const RICHTING_N = 'omlaag';         // een plafond: meer nooit-aangeraakte endpoints is slechter
const jsonUit = process.argv.includes('--json');
const vastleggen = process.argv.includes('--vastleggen');
const leesIdx = process.argv.indexOf('--lees');

/* Het journaal van een suite die hier zelf gedraaid wordt. Zonder --lees
   draaien we de tests alsnog: lokaal wil je een cijfer kunnen halen zonder
   eerst de CI-stappen na te bootsen. */
function draaiSuite(journaal) {
  const bestanden = fs.readdirSync(path.join(WORTEL, 'test'))
    .filter(f => f.endsWith('.test.js')).sort().map(f => 'test/' + f);
  const r = spawnSync(process.execPath, ['--experimental-sqlite', '--test', ...bestanden], {
    cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, RTG_ROUTELOG: journaal },
    maxBuffer: 256 * 1024 * 1024, timeout: 3600000
  });
  /* Een rode suite maakt het cijfer niet ongeldig -- de endpoints zijn wel
     degelijk geraakt -- maar het hoort wel in het rapport te staan. */
  return { status: r.status, uitvoer: String(r.stdout || '') };
}

function routekaart() {
  const uit = execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(__dirname, 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  return (JSON.parse(uit).routes || []).map(r => r.pad).filter(p => p && p.startsWith('/api/'));
}

/* ---- IS HET JOURNAAL VAN DE LAATSTE SUITE NOG BRUIKBAAR? ----

   Sinds `npm test` het journaal standaard naar .routejournaal schrijft, ligt er
   na elke suite een verse meting klaar. Die opnieuw verdienen door de hele suite
   nog een keer te draaien is twintig minuten weggooien -- dat is precies wat hier
   vandaag is gebeurd.

   Maar een OUD journaal is erger dan geen journaal: het geeft een cijfer over
   code die er niet meer zo staat, en dat leest als een meting. Daarom de enige
   controle die telt: is het journaal jonger dan alles onder server/ en test/?
   Zo niet, dan draaien we gewoon de suite en zeggen we waarom.

   Bewust GEEN tijdvenster ("niet ouder dan een uur"). De vraag is niet hoe oud
   het journaal is maar of de code eronder is veranderd; een journaal van gisteren
   op onveranderde code is prima, en een van vijf minuten geleden op gewijzigde
   code is waardeloos. */
function jongerDanDeCode(journaal) {
  let jn;
  try { jn = fs.statSync(journaal).mtimeMs; } catch (e) { return { ok: false, reden: 'bestaat niet' }; }
  let nieuwste = 0, nieuwsteNaam = '';
  const loop = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { if (f.name !== 'data' && f.name !== 'node_modules') loop(p); continue; }
      if (!f.name.endsWith('.js')) continue;
      const m = fs.statSync(p).mtimeMs;
      if (m > nieuwste) { nieuwste = m; nieuwsteNaam = path.relative(WORTEL, p); }
    }
  };
  try { loop(path.join(WORTEL, 'server')); loop(path.join(WORTEL, 'test')); }
  catch (e) { return { ok: false, reden: 'kon de bronmappen niet lezen' }; }
  if (nieuwste > jn) return { ok: false, reden: nieuwsteNaam + ' is gewijzigd na de laatste suite-run' };
  return { ok: true };
}

function main() {
  let journaal, suite = null;
  const staand = path.join(WORTEL, '.routejournaal');
  if (leesIdx !== -1) {
    journaal = process.argv[leesIdx + 1];
    if (!journaal || !fs.existsSync(journaal)) {
      console.error('Het routejournaal "' + journaal + '" bestaat niet. Draaide de suite met RTG_ROUTELOG gezet?');
      return 2;
    }
  } else if (!process.argv.includes('--vers') && (() => { const v = jongerDanDeCode(staand); if (!v.ok && !jsonUit && fs.existsSync(staand)) console.log('Het staande journaal is niet bruikbaar: ' + v.reden + '.\n'); return v.ok; })()) {
    journaal = staand;
    if (!jsonUit) console.log('Het journaal van de laatste `npm test` is nog vers; die gebruiken we.\n\x1b[2m(--vers dwingt een nieuwe suite af)\x1b[0m\n');
  } else {
    journaal = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekking-')), 'routes.log');
    fs.writeFileSync(journaal, '');
    if (!jsonUit) console.log('De suite draait met het routejournaal aan; dit duurt zolang de suite duurt.\n');
    suite = draaiSuite(journaal);
  }

  const geraakt = require(path.join(WORTEL, 'server', 'routelog')).lees(journaal);
  const paden = new Set([...geraakt].map(r => r.slice(r.indexOf(' ') + 1)));
  const routes = routekaart();

  /* EEN LEEG JOURNAAL IS EEN KAPOTTE METING, GEEN NUL PROCENT.
     Zonder deze controle zou een vergeten RTG_ROUTELOG in CI netjes "0%" melden
     en de poort dichtgooien op iets wat niet gemeten is -- of erger, na een
     verkeerde vloer stilletjes doorlaten. */
  if (paden.size < 50) {
    console.error('\nHet routejournaal bevat maar ' + paden.size + ' patronen. Dat is geen meting maar een');
    console.error('kapotte opstelling: controleer of de testrun RTG_ROUTELOG meekreeg.\n');
    return 2;
  }

  const ongeraakt = routes.filter(p => !paden.has(p));
  const pct = routes.length ? Math.round((routes.length - ongeraakt.length) / routes.length * 100) : 100;

  /* Patronen die WEL geraakt zijn maar niet op de routekaart staan. Meestal een
     teken dat de routekaart en de router uit elkaar lopen -- het soort stille
     drift waar dit gereedschap juist voor bestaat.

     /api/test/* hoort daar niet bij en is geen drift: die twee opzettelijke
     storingen registreert server.js alleen onder NODE_ENV=test (zie het blok bij
     "opzettelijke testbug"). De routekaart start zonder die vlag en kan ze dus
     niet kennen -- precies zoals bedoeld, want ze horen nergens anders te
     bestaan. Ze uitzonderen houdt de melding bruikbaar voor echte drift. */
  const opKaart = new Set(routes);
  const vreemd = [...paden].filter(p => p.startsWith('/api/') && !opKaart.has(p) && !p.startsWith('/api/test/'));

  const perDomein = {};
  for (const r of ongeraakt) { const d = r.split('/')[2] || 'overig'; (perDomein[d] = perDomein[d] || []).push(r); }
  const domeinen = Object.entries(perDomein).sort((a, b) => b[1].length - a[1].length);

  const norm = fs.existsSync(NORMBESTAND) ? JSON.parse(fs.readFileSync(NORMBESTAND, 'utf8')) : null;
  const vloer = norm && norm.meters ? norm.meters[METER] : undefined;
  const plafond = norm && norm.meters ? norm.meters[METER_N] : undefined;

  if (jsonUit) {
    process.stdout.write(JSON.stringify({ routes: routes.length, geraakt: routes.length - ongeraakt.length,
      pct, vloer: vloer === undefined ? null : vloer,
      nooitAangeraakt: ongeraakt.length, plafond: plafond === undefined ? null : plafond, ongeraakt, vreemd,
      suiteStatus: suite ? suite.status : null }) + '\n');
  } else {
    console.log('\n\x1b[1mWAARGENOMEN DEKKING\x1b[0m \x1b[2m(uit het routejournaal, niet uit de tekst van de tests)\x1b[0m\n');
    console.log('  endpoints op de routekaart : ' + routes.length);
    console.log('  daarvan echt aangeroepen   : ' + (routes.length - ongeraakt.length) + '  (' + pct + '%)');
    console.log('  nooit aangeraakt           : ' + ongeraakt.length);
    if (vreemd.length) {
      console.log('\n  \x1b[33m' + vreemd.length + ' patroon(en) geraakt die niet op de routekaart staan:\x1b[0m');
      for (const v of vreemd.slice(0, 10)) console.log('    ' + v);
    }
    if (domeinen.length) {
      console.log('\n  De grootste gaten, per domein:');
      for (const [d, lijst] of domeinen.slice(0, 10))
        console.log('    ' + String(lijst.length).padStart(4) + '  ' + d + '   \x1b[2m' + lijst.slice(0, 2).join(', ') + '\x1b[0m');
    }
    if (suite && suite.status !== 0)
      console.log('\n  \x1b[33mLet op: de suite zelf faalde (exit ' + suite.status + '). Het cijfer klopt, de suite niet.\x1b[0m');
  }

  if (vastleggen) {
    const nieuw = norm || { vastgelegd: '', meters: {} };
    const oud = nieuw.meters[METER];
    if (oud !== undefined && pct < oud) {
      console.error('\n  Weigering: ' + pct + '% is lager dan de vastgelegde ' + oud + '%. De norm gaat alleen omhoog.\n');
      return 1;
    }
    const oudN = nieuw.meters[METER_N];
    if (oudN !== undefined && ongeraakt.length > oudN) {
      console.error('\n  Weigering: ' + ongeraakt.length + ' nooit-geraakte endpoints is meer dan de vastgelegde ' + oudN + '. Deze teller gaat alleen omlaag.\n');
      return 1;
    }
    nieuw.meters[METER] = pct;
    nieuw.meters[METER_N] = ongeraakt.length;
    nieuw.vastgelegd = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(NORMBESTAND, JSON.stringify(nieuw, null, 2) + '\n');
    if (!jsonUit) console.log('\n  \x1b[32m' + METER + ' vastgelegd op ' + pct + '%, ' + METER_N + ' op ' + ongeraakt.length + '.\x1b[0m\n');
    return 0;
  }

  /* De exacte teller eerst: hij is scherper dan het percentage en zijn melding
     wijst de endpoints aan in plaats van een cijfer te noemen. */
  if (plafond !== undefined && ongeraakt.length > plafond) {
    console.error('\n  \x1b[31mDE NORM IS NIET GEHAALD.\x1b[0m ' + ongeraakt.length +
      ' endpoint(s) zijn tijdens de hele suite geen enkele keer aangeroepen; de norm is ' + plafond + '.');
    for (const r of ongeraakt.slice(0, 20)) console.error('    ' + r);
    if (ongeraakt.length > 20) console.error('    ... en nog ' + (ongeraakt.length - 20));
    console.error('\n  Schrijf er een toets voor, of verhoog ' + METER_N + ' met de hand in NORM.json --');
    console.error('  dan staat het als bewuste keuze in de historie in plaats van als sluipende erosie.\n');
    return 1;
  }

  if (vloer !== undefined && pct < vloer) {
    console.error('\n  \x1b[31mDE VLOER IS NIET GEHAALD.\x1b[0m ' + pct + '% waargenomen, de norm is ' + vloer + '%.');
    console.error('  Herstel het, of verlaag ' + METER + ' met de hand in NORM.json -- dan staat het');
    console.error('  als bewuste keuze in de historie in plaats van als sluipende erosie.\n');
    return 1;
  }
  if (!jsonUit && vloer !== undefined)
    console.log('\n  \x1b[32mDe vloer (' + vloer + '%) is gehaald' +
      (plafond !== undefined ? ', en ' + ongeraakt.length + ' nooit-geraakte endpoint(s) tegen een norm van ' + plafond : '') + '.\x1b[0m\n');
  return 0;
}

if (require.main === module) process.exit(main());
