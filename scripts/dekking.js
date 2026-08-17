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
     node --experimental-sqlite scripts/dekking.js --lees <bestand> [--lees <bestand>]
     node --experimental-sqlite scripts/dekking.js --json
     node --experimental-sqlite scripts/dekking.js --vastleggen

   In CI draait de suite toch al: die stap krijgt RTG_ROUTELOG mee en deze stap
   leest het journaal met --lees. Dat kost dus niets extra's.

   DE EENHEID IS METHODE + PATROON, OVER ALLE ROUTES

   Wat "een route" is en wanneer hij is aangeraakt staat in
   server/kern/routedekking.js, en daar alleen. Dit script is de poort; het
   kantoorscherm van het personeel (routes/office/dekking.js) rekent met exact
   dezelfde module, zodat het cijfer op dat scherm het cijfer is waar de build
   op zakt en niet een tweede optelling ernaast (LAT.md regel 4).

   HONDERD PROCENT IS GEEN NORM MEER MAAR EEN EIS

   Hier stond: "verhoog endpointsNooitAangeraakt met de hand in NORM.json, dan
   staat het als bewuste keuze in de historie". Die uitweg is dicht. De twee
   meters worden nog steeds vastgelegd -- ze zijn de historie -- maar de poort
   leest ze niet meer: hij eist NUL gaten, altijd. Een gat is een route die
   tijdens de hele suite geen enkele keer is aangeraakt, of een route die niet
   te meten valt.

   TWEE METERS, allebei in NORM.json en allebei HIER vastgelegd (niet in
   scripts/norm.js -- die meet zonder de suite te draaien en kan deze cijfers
   niet zelf vaststellen): dekkingWaargenomenPct en endpointsNooitAangeraakt.
   Die tweede is de scherpe: een afgerond percentage dekte bij 2530 routes tot
   een stuk of twaalf endpoints die nooit waren aangeraakt, en de run die dit op
   100% zette had er nog twee liggen -- waaronder de knop waarmee je bewijst dat
   je alarmering werkt. Het percentage rondt daarom naar BENEDEN af (zie
   kern/routedekking.js), zodat 4188 van 4189 geen honderd meer heet.

   EN HET RESULTAAT WORDT VASTGELEGD IN DEKKING.json

   Een cijfer in een terminal is weg zodra je het venster sluit, en het
   personeel heeft geen terminal. --vastleggen schrijft daarom de volledige
   lijst bewezen-aangeraakte routes weg. Die lijst is het bewijsstuk waar het
   kantoorscherm tegen aanhoudt wat de server op dit moment werkelijk
   registreert; een route die er sinds de meting bij is gekomen valt daardoor
   METEEN op, zonder dat er eerst een suite hoeft te draaien.
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const NORMBESTAND = path.join(WORTEL, 'NORM.json');
const DEKKINGBESTAND = path.join(WORTEL, 'DEKKING.json');
const routedekking = require(path.join(WORTEL, 'server', 'kern', 'routedekking'));
const METER = 'dekkingWaargenomenPct';
// een AANTAL en geen percentage: staat hij op 0, dan valt een nieuw endpoint
// zonder toets niet meer weg in een afronding (zie de kop)
const METER_N = 'endpointsNooitAangeraakt';
const jsonUit = process.argv.includes('--json');
const vastleggen = process.argv.includes('--vastleggen');

/* MEER DAN EEN JOURNAAL, want niet elke route is vanuit node te bereiken.

   `--lees a --lees b` (of `--lees a,b`) telt de journalen bij elkaar op. Dat is
   geen gemak maar een gat dat sinds TAKEN.md 6.8 open stond: /api/fout/client
   wordt alleen door de BROWSER aangeroepen (public/shared/foutmelder.js), dus
   `npm test` raakt hem per definitie niet. Met een enkel journaal is 100% over
   ALLE routes dan onhaalbaar, tenzij je zulke routes uitzondert -- en een
   uitzonderingslijst is precies de plek waar een gat gaat wonen.

   `npm test` schrijft .routejournaal, `npm run e2e` schrijft .schermjournaal.
   Bij elkaar dekken ze wat node kan bereiken en wat alleen een browser kan. */
const journalenUitArgv = () => {
  const uit = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] !== '--lees') continue;
    for (const p of String(process.argv[i + 1] || '').split(',')) if (p.trim()) uit.push(p.trim());
  }
  return uit;
};

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

/* De volledige kaart, ONGEFILTERD. Hier stond `.filter(p => p.startsWith('/api/'))`
   en dat was het gat: zeven pagina-routes -- waaronder de twee bundelroutes die
   elke pagina van het huis dragen -- vielen buiten het cijfer. Niet als
   ongedekt, maar als onbestaand. Het knippen gebeurt nergens meer; wie een
   deelverzameling wil zien, filtert in de weergave en niet in de meting. */
function routekaart() {
  const uit = execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(__dirname, 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(uit).routes || [];
}

/* HET BEWIJSSTUK. De volle lijst routes die tijdens de suite echt zijn
   aangeraakt, één per regel zodat een route erbij ook één regel diff is.
   Bewust ZONDER afgeleide totalen erin: perDomein en het percentage zijn uit
   deze lijst te herrekenen, en een opgeschreven totaal naast een lijst die het
   ook zegt, is de tweede plek waar een waarheid gaat schuiven (LAT.md regel 4).
   Wat er wel in staat is wat je NIET kunt herrekenen: wanneer, op welke commit,
   en hoeveel routes de router toen had. */
function schrijfBewijs(meting, kaart) {
  let commit = null;
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'],
      { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch (e) { commit = null; }
  const ongeraakt = new Set(meting.ongeraakt.map(r => r.methode + ' ' + r.pad));
  const aangeraakt = [];
  for (const r of routedekking.inventaris(kaart).routes) {
    const s = r.methode + ' ' + r.pad;
    if (!ongeraakt.has(s)) aangeraakt.push(s);
  }
  fs.writeFileSync(DEKKINGBESTAND, JSON.stringify({
    uitleg: 'Elke route (METHODE + patroon) die tijdens de volledige testsuite ECHT is aangeraakt, ' +
      'uit het routejournaal van server/routelog.js en niet uit de tekst van de toetsen. ' +
      'De eis is 100%: scripts/dekking.js zakt op elk gat en kent geen norm om die eis te verlagen. ' +
      'Het RTG Kantoor leest dit bestand (routes/office/dekking.js) en houdt het naast wat de server ' +
      'op dit moment registreert, zodat een route die er na de meting bij komt meteen als ongemeten opvalt. ' +
      'Bijwerken met: npm run dekking:vast',
    gemeten: { op: new Date().toISOString(), commit, routesToen: meting.totaal },
    aangeraakt
  }, null, 2) + '\n');
  return aangeraakt.length;
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
  let journalen = journalenUitArgv(), suite = null;
  const staand = path.join(WORTEL, '.routejournaal');
  if (journalen.length) {
    const weg = journalen.filter(p => !fs.existsSync(p));
    if (weg.length) {
      console.error('Deze routejournalen bestaan niet: ' + weg.join(', ') + '. Draaide de suite met RTG_ROUTELOG gezet?');
      return 2;
    }
  } else if (!process.argv.includes('--vers') && (() => { const v = jongerDanDeCode(staand); if (!v.ok && !jsonUit && fs.existsSync(staand)) console.log('Het staande journaal is niet bruikbaar: ' + v.reden + '.\n'); return v.ok; })()) {
    /* Het schermjournaal van `npm run e2e` telt mee als het er ligt. Zonder die
       ronde blijven de browser-only routes ongeraakt, en dat hoort de poort dan
       ook te zeggen in plaats van ze te verzwijgen. */
    journalen = [staand, path.join(WORTEL, '.schermjournaal')].filter(p => fs.existsSync(p));
    if (!jsonUit) console.log('Het journaal van de laatste `npm test` is nog vers; die gebruiken we' +
      (journalen.length > 1 ? ', samen met het schermjournaal van `npm run e2e`' : '') +
      '.\n\x1b[2m(--vers dwingt een nieuwe suite af)\x1b[0m\n');
  } else {
    const eigen = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekking-')), 'routes.log');
    fs.writeFileSync(eigen, '');
    if (!jsonUit) console.log('De suite draait met het routejournaal aan; dit duurt zolang de suite duurt.\n');
    suite = draaiSuite(eigen);
    journalen = [eigen];
  }

  const routelog = require(path.join(WORTEL, 'server', 'routelog'));
  const geraakt = new Set();
  for (const p of journalen) for (const regel of routelog.lees(p)) geraakt.add(regel);
  const kaart = routekaart();

  /* EEN LEEG JOURNAAL IS EEN KAPOTTE METING, GEEN NUL PROCENT.
     Zonder deze controle zou een vergeten RTG_ROUTELOG in CI netjes "0%" melden
     en de poort dichtgooien op iets wat niet gemeten is -- of erger, na een
     verkeerde vloer stilletjes doorlaten. */
  const aantalGeraakt = routedekking.geraaktUit(geraakt).size;
  if (aantalGeraakt < 50) {
    console.error('\nHet routejournaal bevat maar ' + aantalGeraakt + ' routes. Dat is geen meting maar een');
    console.error('kapotte opstelling: controleer of de testrun RTG_ROUTELOG meekreeg.\n');
    return 2;
  }

  /* De hele rekenkant staat in server/kern/routedekking.js, samen met de
     uitzondering voor /api/test/* (opzettelijke storingen die alleen onder
     NODE_ENV=test bestaan) en de gelijkstelling van HEAD aan GET. */
  const m = routedekking.meet(kaart, geraakt);
  const pct = m.pct;
  const ongeraakt = m.ongeraakt.map(r => r.methode + ' ' + r.pad);
  const onmeetbaar = m.onmeetbaar.map(r => r.methode + ' ' + r.pad);

  const norm = fs.existsSync(NORMBESTAND) ? JSON.parse(fs.readFileSync(NORMBESTAND, 'utf8')) : null;

  if (jsonUit) {
    process.stdout.write(JSON.stringify({ routes: m.totaal, geraakt: m.geraakt, pct,
      nooitAangeraakt: m.nooitAangeraakt, onmeetbaar, gaten: m.gaten, ongeraakt, vreemd: m.vreemd,
      suiteStatus: suite ? suite.status : null }) + '\n');
  } else {
    console.log('\n\x1b[1mWAARGENOMEN DEKKING\x1b[0m \x1b[2m(uit het routejournaal, niet uit de tekst van de tests)\x1b[0m\n');
    console.log('  routes op de routekaart    : ' + m.totaal + '  \x1b[2m(methode + patroon, alles inbegrepen)\x1b[0m');
    console.log('  daarvan echt aangeroepen   : ' + m.geraakt + '  (' + pct + '%)');
    console.log('  nooit aangeraakt           : ' + m.nooitAangeraakt);
    console.log('  niet te meten              : ' + onmeetbaar.length);
    if (m.vreemd.length) {
      console.log('\n  \x1b[33m' + m.vreemd.length + ' route(s) geraakt die niet op de routekaart staan:\x1b[0m');
      for (const v of m.vreemd.slice(0, 10)) console.log('    ' + v);
    }
    const gaten = m.perDomein.filter(d => d.totaal > d.geraakt);
    if (gaten.length) {
      console.log('\n  De grootste gaten, per domein:');
      for (const d of gaten.slice(0, 10))
        console.log('    ' + String(d.totaal - d.geraakt).padStart(4) + '  ' + d.domein +
          '   \x1b[2m' + d.ongeraakt.slice(0, 2).join(', ') + '\x1b[0m');
    }
    if (suite && suite.status !== 0)
      console.log('\n  \x1b[33mLet op: de suite zelf faalde (exit ' + suite.status + '). Het cijfer klopt, de suite niet.\x1b[0m');
  }

  /* DE POORT: NUL GATEN, ZONDER UITWEG.

     Hier las de poort eerst een vloer en een plafond uit NORM.json, met in de
     zakmelding de suggestie om die met de hand te verhogen. Dat is precies de
     knop die "altijd 100%" onmogelijk maakt, dus die is weg. De meters worden
     nog wel vastgelegd -- ze zijn de historie -- maar ze zijn niet meer de eis.

     Vastleggen mag alleen als de meting zelf klopt. Anders bewaart --vastleggen
     een gat en heet dat voortaan de norm; dat is hoe een ratel losraakt. */
  if (m.gaten > 0) {
    console.error('\n  \x1b[31mDE DEKKING IS GEEN 100%.\x1b[0m ' + m.gaten + ' van de ' + m.totaal +
      ' routes zijn tijdens de hele suite niet aangeraakt of niet te meten.');
    for (const r of ongeraakt.slice(0, 20)) console.error('    ' + r);
    if (ongeraakt.length > 20) console.error('    ... en nog ' + (ongeraakt.length - 20));
    for (const r of onmeetbaar) console.error('    ' + r + '   \x1b[2m(app.all(): registreer hem met een eigen methode)\x1b[0m');
    console.error('\n  Schrijf er een toets voor. Er is geen norm om deze eis mee te verlagen:');
    console.error('  100% is de eis, en een route zonder toets is een route waarvan niemand iets weet.\n');
    return 1;
  }

  if (vastleggen) {
    const nieuw = norm || { vastgelegd: '', meters: {} };
    const oud = nieuw.meters[METER];
    if (oud !== undefined && pct < oud) {
      console.error('\n  Weigering: ' + pct + '% is lager dan de vastgelegde ' + oud + '%. De norm gaat alleen omhoog.\n');
      return 1;
    }
    const oudN = nieuw.meters[METER_N];
    if (oudN !== undefined && m.nooitAangeraakt > oudN) {
      console.error('\n  Weigering: ' + m.nooitAangeraakt + ' nooit-geraakte routes is meer dan de vastgelegde ' + oudN + '. Deze teller gaat alleen omlaag.\n');
      return 1;
    }
    nieuw.meters[METER] = pct;
    nieuw.meters[METER_N] = m.nooitAangeraakt;
    nieuw.vastgelegd = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(NORMBESTAND, JSON.stringify(nieuw, null, 2) + '\n');
    const n = schrijfBewijs(m, kaart);
    if (!jsonUit) console.log('\n  \x1b[32m' + METER + ' vastgelegd op ' + pct + '%, ' + METER_N +
      ' op ' + m.nooitAangeraakt + '; ' + n + ' routes als bewezen aangeraakt in DEKKING.json.\x1b[0m\n');
    return 0;
  }

  if (!jsonUit)
    console.log('\n  \x1b[32mAlle ' + m.totaal + ' routes zijn aangeraakt: 100%.\x1b[0m\n');
  return 0;
}

if (require.main === module) process.exit(main());
