#!/usr/bin/env node
'use strict';
/* DE DEKKINGSVLOER OVER ALLE SCHERVEN -- één keer, over het totaal.

   Dit is de helft die het verdelen mogelijk maakt. `node --test
   --test-coverage-lines=78` rekent per PROCES; verdeel je de suite, dan meet
   elke scherf alleen wat hij zelf aanraakt en zakt hij op de vloer terwijl het
   geheel er ruim overheen zit. Hier worden de lcov-bestanden van alle scherven
   opgeteld (scripts/lib/lcov.js) en wordt de vloer één keer over het totaal
   gehandhaafd -- precies wat het ene proces ook deed.

   DE GETALLEN STAAN OP ÉÉN PLEK, in package.json bij `test:gate`. Ze hier nog
   eens intypen zou betekenen dat een verlaging op de ene plek niet op de andere
   doorkomt, en dan is er een vloer die niemand kent.

   FAIL-CLOSED. Ontbreekt er een scherf, dan wordt er NIET gerekend. Een som over
   drie van de vier scherven is geen lagere dekking maar een ándere meting, en
   die hoort niet te bepalen of een tak doorkomt.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { voegSamen, tel, lees } = require('./lib/lcov');

const WORTEL = path.join(__dirname, '..');
const ARG = process.argv.slice(2);
const getal = (naam, standaard) => {
  const i = ARG.indexOf(naam);
  return i >= 0 ? Number(ARG[i + 1]) : standaard;
};

/* De eisen komen uit package.json, waar ze naast het commando staan dat ze
   afdwingt -- niet hier nog eens overgeschreven.

   ANDERE GETALLEN DAN test:gate, EN DAT IS GEEN VERSLAPPING. Deze vloer las
   jarenlang de getallen van het ENKELE PROCES, en die zijn op een ander
   universum geijkt. De dekkingstabel die Node op de terminal drukt telt de
   TOETSBESTANDEN mee -- op main zijn dat 973 rijen, en een toetsbestand draait
   van boven naar beneden en staat dus op bijna 100%. De lcov-uitvoer die hier
   wordt opgeteld bevat ze niet: alleen server, scripts en public. Dezelfde
   suite, twee universa, en het verschil is de kant op die vleit: main haalt
   81,30% MET de toetsbestanden erbij en ongeveer 70% zonder (gemeten aan de
   2361 bestanden die ook op main staan).

   De vloer 78/78/65 is dus nooit door enige versie van dit huis gehaald in DIT
   universum -- ook niet door main. Hem hier laten staan is geen streng zijn maar
   een lat ophangen die nergens de grond raakt. De optelling krijgt daarom haar
   eigen vloer, geijkt op haar eigen eerste eerlijke meting (27 augustus 2026,
   vier scherven: regels 72,52 takken 69,90 functies 50,38) en net als hiervoor
   een paar punten daaronder, zodat ruis niet flakeert en echte terugval opvalt.
   De getallen van test:gate blijven staan voor wie hem lokaal draait; die meet
   de tabel en hoort bij de tabel. */
function eisen() {
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  const gate = String(pkg.scripts['dekking:scherven'] || pkg.scripts['test:gate'] || '');
  const pak = (naam) => {
    const m = new RegExp('--test-coverage-' + naam + '=(\\d+(?:\\.\\d+)?)').exec(gate);
    return m ? Number(m[1]) : null;
  };
  const uit = { regels: pak('lines'), takken: pak('branches'), functies: pak('functions') };
  for (const [k, v] of Object.entries(uit)) {
    if (v == null) throw new Error('geen --test-coverage-' + k + ' gevonden in package.json > scripts.test:gate');
  }
  return uit;
}

const map = ARG.includes('--map') ? ARG[ARG.indexOf('--map') + 1] : path.join(WORTEL, 'dekking-scherven');
const verwacht = getal('--scherven', 0);

let paden = [];
try {
  paden = fs.readdirSync(map, { withFileTypes: true })
    .filter((n) => !n.isDirectory() && /\.info$|\.lcov$/.test(n.name))
    .map((n) => path.join(map, n.name)).sort();
} catch (e) {
  console.error('\x1b[31mDe map met scherfdekking is niet te lezen: ' + map + '\x1b[0m');
  process.exit(2);
}

console.log('\n=== De dekkingsvloer, over alle scherven ===\n');
const toon = (p) => { const r = path.relative(WORTEL, p); return r.startsWith('..') ? p : r; };
console.log('  ' + paden.length + ' dekkingsbestand(en) gevonden in ' + toon(map));

/* FAIL-CLOSED: een ontbrekende scherf maakt de meting anders, niet lager.

   Geteld worden SCHERVEN en niet BESTANDEN. Dat verschil is een keer duur
   geweest: elke scherf schreef naar dekking/scherf.info, en die vier bestanden
   heten na `merge-multiple` allemaal hetzelfde -- drie ervan overschreven
   elkaar. De teller zag er twee (scherf.info en solo.info) en riep sinds die
   dag dat er scherven ontbraken, terwijl er in werkelijkheid vier hadden
   geupload. Sindsdien draagt elk bestand zijn scherfnummer, en leest deze
   wachter dat nummer terug: een scherf die twee bestanden oplevert (een solo-
   ronde naast de gewone) telt een keer, en een scherf die er nul oplevert valt
   op met naam en nummer. */
const nummers = new Set();
for (const p of paden) {
  const m = /-(\d+)\.(?:info|lcov)$/.exec(path.basename(p));
  if (m) nummers.add(Number(m[1]));
}
if (verwacht) {
  const zoek = [];
  for (let i = 1; i <= verwacht; i++) if (!nummers.has(i)) zoek.push(i);
  if (zoek.length) {
    console.error('\n\x1b[31m  Er werden ' + verwacht + ' scherven verwacht; scherf ' + zoek.join(', ') +
      ' ontbreekt.\x1b[0m\n  Een som over een deel van de scherven is geen lagere dekking maar een ANDERE\n' +
      '  meting, en die hoort niet te bepalen of een tak doorkomt.\n');
    process.exit(1);
  }
  console.log('  scherven met dekking: ' + [...nummers].sort((a, b) => a - b).join(', '));
}
if (!paden.length) {
  console.error('\n\x1b[31m  Geen enkele scherf: er valt niets te handhaven.\x1b[0m\n');
  process.exit(1);
}

const totaal = tel(voegSamen(lees(paden)));
const eis = eisen();

console.log('  ' + totaal.bestanden + ' bestand(en) in de opgetelde meting\n');
const rij = [
  ['regels', totaal.regels, eis.regels],
  ['takken', totaal.takken, eis.takken],
  ['functies', totaal.functies, eis.functies]
];
let gezakt = 0;
for (const [naam, m, e] of rij) {
  const ok = m.pct >= e;
  if (!ok) gezakt++;
  console.log('  ' + (ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m') + ' ' + naam.padEnd(10) +
    String(m.pct).padStart(6) + '%  (' + m.gedekt + '/' + m.totaal + ')   vloer ' + e + '%');
}

if (gezakt) {
  console.error('\n\x1b[31mDE DEKKINGSVLOER IS NIET GEHAALD (' + gezakt + ' van de 3).\x1b[0m');
  console.error('Dit is dezelfde eis als bij het enkele proces; het verdelen verandert er niets aan.\n');
  process.exit(1);
}
console.log('\n\x1b[32mDe vloer is gehaald.\x1b[0m\n');
