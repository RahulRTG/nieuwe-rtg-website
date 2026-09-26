#!/usr/bin/env node
/* DE GOUDEN REFERENTIE SCHRIJVEN -- eenmalig, tegen de OUDE motor.

   Dit script is bewaard als bewijs van HOE test/fixtures/magnaat-economie-
   gouden.json is ontstaan, niet om het opnieuw te draaien. Het laadt
   server/kern/magnaat-economie.js, en dat bestand bestaat na ronde A1 niet meer
   (MAGNAAT.md par. 7). Een gouden referentie die je na de verbouwing opnieuw
   uit de nieuwe code zou schrijven, bewijst niets: dan vergelijk je de motor
   met zichzelf. Daarom weigert het script als de oude motor er niet is, en
   overschrijft het een bestaande referentie alleen met --opnieuw.

   Draai:  node scripts/magnaat-gouden.js            (schrijft, als hij er nog niet is)
           node scripts/magnaat-gouden.js --opnieuw
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { SCENARIOS, draai } = require('../test/lib/magnaat-economie-scenarios');

const WORTEL = path.join(__dirname, '..');
const OUD = 'server/kern/magnaat-economie.js';
const DOEL = path.join(WORTEL, 'test/fixtures/magnaat-economie-gouden.json');

if (require.main === module) {
  if (!fs.existsSync(path.join(WORTEL, OUD))) {
    console.error('[magnaat-gouden] ' + OUD + ' bestaat niet meer; de referentie komt uit de oude motor en wordt niet uit de nieuwe nagemaakt.');
    process.exit(2);
  }
  if (fs.existsSync(DOEL) && !process.argv.includes('--opnieuw')) {
    console.error('[magnaat-gouden] de referentie bestaat al; overschrijven alleen met --opnieuw.');
    process.exit(2);
  }
  const maak = require(path.join(WORTEL, OUD));
  const nieuweEconomie = () => { const wereld = {}; return maak({ wereldState: () => wereld, save: () => {}, motorklant: { aan: false } }); };
  const bron = execFileSync('git', ['log', '-1', '--format=%h', '--', OUD], { cwd: WORTEL, encoding: 'utf8' }).trim();
  const uit = {
    uitleg: 'Vingerafdrukken per stap van de Magnaat-economie VOOR ronde A1, gemaakt met scripts/magnaat-gouden.js ' +
      'tegen ' + OUD + ' (laatste wijziging ' + bron + '). test/magnaat-economische-motor.test.js eist dat de nieuwe ' +
      'motor dezelfde afdrukken geeft. Niet opnieuw uit de nieuwe code schrijven: dan vergelijkt de motor zichzelf.',
    bron: OUD, bronCommit: bron,
    scenarios: Object.fromEntries(Object.keys(SCENARIOS).map(n => [n, draai(nieuweEconomie, n)]))
  };
  fs.mkdirSync(path.dirname(DOEL), { recursive: true });
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
  for (const [n, s] of Object.entries(uit.scenarios)) {
    console.log('  ' + n.padEnd(10) + s.length + ' stappen, ' + s.reduce((t, x) => t + (x.posten || 0), 0) + ' boekingen');
  }
  console.log('test/fixtures/magnaat-economie-gouden.json geschreven.');
}
