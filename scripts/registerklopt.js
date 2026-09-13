#!/usr/bin/env node
/* ============================================================================
   KLOPT HET REGISTER NOG MET EEN VERSE METING?

   WAAROM DIT BESTAAT, en het is een vondst van 13 september 2026. Een ronde die
   vier modules afsplitste (ze gingen over de 10 KB van keuringsregel 13) liet
   twee registers achterlopen: MAGNAATLAB.json telde 2066 kernmodules waar er
   2070 waren, CAPABILITEIT.json 3393 waar er 3401 waren. Lokaal stond
   `npm run check` op *Alles in orde*; CI zakte op `Toetsscherf 2 van 4`.

   DE REGEL DIE ERUIT VOLGT:

     Een register dat door een TOETS wordt bewaakt, is niet gedekt door een
     groene keuring -- tenzij die toets onderdeel is van die keuring.

   Dat klinkt triviaal en is het niet: negentien toetsbestanden dragen deze
   grendel, en geen van hen zit in `npm run check`. Wie lokaal de keuring draait
   en pusht, hoort het pas van CI.

   DIT IS EEN VIERDE BEGRIP EN GEEN VIJFDE NAAM VOOR EEN BESTAAND. Dit huis had
   er al drie die erop lijken, en ze beantwoorden andere vragen:

     scripts/versheid.js   is het register op een RECENTE COMMIT gemeten?
                           (de stempel; vier poortklassen blokkeren)
     test/meterijk.test.js ziet de meter een bekend-FOUTE invoer?
                           (de ijking van het instrument, LAT.md regel 10)
     scripts/check.js      de statische huisregels
     dit bestand           geeft de meter VANDAAG nog hetzelfde getal?
                           (de inhoud)

   Een verse stempel zegt niets over de inhoud: een register kan vanmorgen zijn
   gemeten en vanmiddag achterlopen. En een geijkte meter zegt niets over wat er
   in het bestand staat.

   DE LIJST WORDT AFGELEID EN NIET GETYPT. Twee lijsten van dezelfde toetsen
   lopen uiteen zodra er een bij komt (LAT.md regel 4), en dan mist juist de
   nieuwe zijn poort. Hij wordt gevonden op de zin die deze toetsen delen --
   dezelfde zin die ze aan de gebruiker tonen.

   Draai: npm run registerklopt
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const TEST = path.join(WORTEL, 'test');

/* De zin waarop ze te herkennen zijn. Hij staat in de FOUTMELDING van elke
   grendel ("X.json loopt achter op ..."), dus hij is niet cosmetisch: wie hem
   weghaalt, haalt de melding weg die de gebruiker moet lezen. */
const MERK = 'loopt achter';

function vind() {
  return fs.readdirSync(TEST)
    .filter(n => /\.(test|e2e)\.js$/.test(n))
    .filter(n => {
      try { return fs.readFileSync(path.join(TEST, n), 'utf8').includes(MERK); }
      catch (e) { return false; }
    })
    .sort();
}

const K = { rood: '\x1b[31m', groen: '\x1b[32m', grijs: '\x1b[2m', vet: '\x1b[1m', uit: '\x1b[0m' };

if (require.main === module) {
  const namen = vind();
  console.log('\n' + K.vet + 'KLOPPEN DE REGISTERS NOG MET EEN VERSE METING?' + K.uit +
    K.grijs + '  -- ' + namen.length + ' toetsbestand(en)' + K.uit + '\n');

  /* NUL TOETSEN IS GEEN GROEN. Zou de afleiding ooit niets vinden -- een
     hernoemde melding, een verplaatste map -- dan meldt dit script vrolijk
     succes over een poort die niets bewaakt. Zelfde grendel als in
     scripts/pgtoetsen.js, en om dezelfde reden. */
  if (namen.length < 10) {
    console.error('  ' + K.rood + 'Er zijn maar ' + namen.length + ' toetsen gevonden met "' + MERK + '".' + K.uit);
    console.error('  ' + K.grijs + 'Dat is te weinig om een poort te zijn. Is de melding hernoemd, pas dan MERK aan --' +
      '\n  maar laat hem niet stil op nul staan: een poort die niets vindt, laat alles door.' + K.uit + '\n');
    process.exit(2);
  }

  for (const n of namen) console.log('  ' + K.grijs + n + K.uit);
  console.log('');

  const uit = spawnSync(process.execPath,
    ['--test', ...namen.map(n => path.join('test', n))],
    { cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const tekst = String(uit.stdout || '') + String(uit.stderr || '');
  /* Alleen de regels die zeggen WELK register achterloopt en HOE het te
     herstellen is. De volle testuitvoer is duizenden regels; wie moet
     handelen, heeft deze twee nodig. */
  const meldingen = tekst.split('\n').filter(r => r.includes(MERK) || /draai: npm run/.test(r));
  if (uit.status === 0) {
    console.log('  ' + K.groen + 'Alle registers kloppen met een verse meting.' + K.uit + '\n');
    process.exit(0);
  }
  console.error('  ' + K.rood + K.vet + 'EEN OF MEER REGISTERS LOPEN ACHTER.' + K.uit);
  for (const m of [...new Set(meldingen)]) console.error('    ' + m.trim());
  console.error('\n  ' + K.grijs + 'Draai de genoemde opdracht(en), commit het register, en draai dit opnieuw.' + K.uit + '\n');
  process.exit(1);
}

module.exports = { vind, MERK };
