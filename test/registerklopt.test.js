/* DE POORT DIE NIETS MAG VINDEN -- scripts/registerklopt.js

   Deze poort leidt zijn lijst AF uit de toetsbestanden (op de zin die hun
   foutmelding draagt) in plaats van hem te typen. Dat is de juiste keuze -- twee
   lijsten van dezelfde toetsen lopen uiteen zodra er een bij komt, en dan mist
   juist de nieuwe zijn poort -- maar het verplaatst het risico: een afleiding
   die NIETS vindt, meldt succes over een poort die niets bewaakt.

   Dat is geen hypothetisch risico. `scripts/pgtoetsen.js` draagt dezelfde
   grendel met dezelfde kop ("NUL TOETSEN IS GEEN GROEN"), en die staat er omdat
   het een keer is misgegaan.

   Draai los: node --test test/registerklopt.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const poort = require('../scripts/registerklopt.js');

test('de afleiding vindt de toetsen die registers tegen een verse meting houden', () => {
  const namen = poort.vind();
  assert.ok(namen.length >= 15,
    'maar ' + namen.length + ' toetsbestand(en) gevonden met "' + poort.MERK + '" -- ' +
    'een poort die niets vindt, laat alles door. Is de melding hernoemd, pas dan MERK aan.');
  /* De twee die deze poort hebben opgeleverd horen er sowieso in te zitten:
     zij zakten in CI terwijl `npm run check` lokaal groen stond. */
  for (const n of ['magnaatlab.test.js', 'capabilities.test.js']) {
    assert.ok(namen.includes(n), n + ' zit niet in de afleiding, terwijl juist die toets deze poort opleverde');
  }
});

test('het script weigert bij een te dunne afleiding in plaats van groen te melden', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'registerklopt.js'), 'utf8');
  assert.match(bron, /namen\.length < \d+/,
    'er staat geen ondergrens in het script; zonder die grendel meldt een lege afleiding succes');
  assert.match(bron, /process\.exit\(2\)/,
    'een te dunne afleiding hoort een EIGEN exitcode te geven, niet dezelfde als een echt achterlopend register -- ' +
    'anders is een kapotte poort niet van een echte bevinding te onderscheiden');
});

test('de poort staat in package.json en is dus lokaal te draaien', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts.registerklopt,
    'zonder npm-script is de poort er wel maar draait niemand hem -- en dat was precies het probleem');
});
