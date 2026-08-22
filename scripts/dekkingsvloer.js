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

/* De eisen komen uit package.json, waar ze ook voor het enkele proces staan. */
function eisen() {
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  const gate = String(pkg.scripts['test:gate'] || '');
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
console.log('  ' + paden.length + ' scherf/scherven gevonden in ' + toon(map));

/* FAIL-CLOSED: een ontbrekende scherf maakt de meting anders, niet lager. */
if (verwacht && paden.length !== verwacht) {
  console.error('\n\x1b[31m  Er werden ' + verwacht + ' scherven verwacht en er zijn er ' + paden.length +
    '.\x1b[0m\n  Een som over een deel van de scherven is geen lagere dekking maar een ANDERE\n' +
    '  meting, en die hoort niet te bepalen of een tak doorkomt.\n');
  process.exit(1);
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
