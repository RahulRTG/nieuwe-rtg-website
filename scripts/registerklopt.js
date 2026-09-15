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

   EN HIJ DRAAIDE ZIJN TOETSEN NAAST ELKAAR TERWIJL SOMMIGE ALLEEN MOETEN.
   Gevonden op 15 september 2026. `node --test` met negenentwintig bestanden
   draait ze CONCURRENT, en in die lijst zitten toetsen die echte bron muteren
   (scripts/lib/geisoleerd.js kent ze: capabilities.test.js zet een bestand in
   server/kern/, ondernemerslus.test.js een in server/routes/supplier/). Een
   meter die op dat moment de bronboom afloopt, ziet het bestand in de LIJST en
   is het bij het LEZEN alweer kwijt -- exact de vorm die scripts/keuring.js in
   zijn kop optekent, en die daar met een ENOENT-uitzondering is opgelost.

   Hier viel scripts/semantiek.js erover, en de fout wees de verkeerde kant op:
   de melding zei dat een REGISTER achterliep terwijl er een bestand was
   verdwenen. Dat is de duurste soort rood.

   De reparatie is niet nog een ENOENT-uitzondering maar de OORZAAK: deze poort
   respecteert nu dezelfde isolatielijst als de gewone loper. Wie een toets aan
   die lijst toevoegt, hoeft hem dus niet op twee plekken te melden.

   Draai: npm run registerklopt
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const TEST = path.join(WORTEL, 'test');

/* DE ZINNEN WAAROP ZE TE HERKENNEN ZIJN, en het zijn er TWEE omdat er twee
   vragen zijn. Beide staan in de FOUTMELDING van hun grendel, dus geen van beide
   is cosmetisch: wie hem weghaalt, haalt de melding weg die de gebruiker leest.

     inhoud      "loopt achter" -- geeft de meter vandaag nog hetzelfde getal?
     inventaris  "versheidslijst" -- is dit register überhaupt VERKLAARD, of
                 schrijft een script iets waarvan niemand de ouderdom meldt?
     meetlaag    "niet aan zijn eigen regels" -- houdt het INSTRUMENT zich aan de
                 huisregels voor meters (zegt het register wat het niet aantoont,
                 start het script niet bij het requiren)?

   DE TWEEDE IS ER BIJGEKOMEN OMDAT DE EERSTE HEM MISTE, en dat is de eerlijke
   les van deze poort. Op 13 september 2026 zakte `Toetsscherf 3 van 4` op
   test/versheidsdekking.test.js: twee nieuwe registers (AICONTEXT.json,
   METERKLASSE.json) werden geschreven zonder ergens verklaard te zijn. Lokaal
   stond `npm run check` groen EN `npm run registerklopt` groen -- want dat
   bestand draagt de zin "loopt achter" nergens. Exact dezelfde vorm als de
   vondst die deze poort deed ontstaan, een laag dieper.

   EN DAT GEBEURDE NOG DEZELFDE DAG, twee keer. Merk 2 kwam erbij toen
   versheidsdekking zakte; merk 3 een ronde later, toen test/meetkeuring.test.js
   zakte op dezelfde twee nieuwe registers. Drie formuleringen op een dag is geen
   toeval maar de vorm van deze poort.

   WAAROM HET TOCH MARKERS BLIJVEN, en dat is gemeten en niet aangenomen. De
   voor de hand liggende uitweg is afleiden op ONDERWERP: elke toets die een
   register uit de wortel noemt. Dat zijn er 198 van de suite -- dan is de poort
   zo traag als `npm test` zelf en heeft hij geen bestaansrecht meer als snelle
   controle vooraf. De markers houden hem op twintig bestanden.

   WAT DEZE POORT DUS NIET IS: een bewijs dat elke registergrendel meedraait. Een
   MARKERCONVENTIE dekt wat iemand eraan heeft gedacht te markeren, en verder
   niets. Wie een nieuwe grendel schrijft met een vierde formulering, hoort hem
   hier bij te zetten -- en merkt dat pas als CI het hem vertelt. */
const MERKEN = [
  { merk: 'loopt achter', klasse: 'inhoud' },
  { merk: 'versheidslijst', klasse: 'inventaris' },
  { merk: 'niet aan zijn eigen regels', klasse: 'meetlaag' }
];
const MERK = MERKEN[0].merk;   // voor aanroepers die de oude naam gebruiken

function vind() {
  return fs.readdirSync(TEST)
    .filter(n => /\.(test|e2e)\.js$/.test(n))
    .filter(n => {
      try {
        const bron = fs.readFileSync(path.join(TEST, n), 'utf8');
        return MERKEN.some(m => bron.includes(m.merk));
      } catch (e) { return false; }
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
    console.error('  ' + K.rood + 'Er zijn maar ' + namen.length + ' toetsen gevonden met ' +
      MERKEN.map(m => '"' + m.merk + '"').join(' of ') + '.' + K.uit);
    console.error('  ' + K.grijs + 'Dat is te weinig om een poort te zijn. Is een melding hernoemd, pas dan MERKEN aan --' +
      '\n  maar laat hem niet stil op nul staan: een poort die niets vindt, laat alles door.' + K.uit + '\n');
    process.exit(2);
  }

  for (const n of namen) console.log('  ' + K.grijs + n + K.uit);
  console.log('');

  /* DE ISOLATIELIJST IS VAN DE LOPER EN WORDT HIER NIET OVERGETYPT (LAT.md
     regel 4). Wat daar alleen moet draaien, moet dat hier ook: deze poort start
     dezelfde toetsen, alleen met een andere selectie. */
  const { GEISOLEERD } = require('./lib/geisoleerd');
  const alleen = namen.filter(n => GEISOLEERD.includes(n));
  const samen = namen.filter(n => !GEISOLEERD.includes(n));
  if (alleen.length) console.log('  ' + K.grijs + alleen.length +
    ' toets(en) draaien apart (scripts/lib/geisoleerd.js)' + K.uit + '\n');

  const draai = (lijst) => spawnSync(process.execPath,
    ['--test', ...lijst.map(n => path.join('test', n))],
    { cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const rondes = [];
  for (const n of alleen) rondes.push(draai([n]));
  if (samen.length) rondes.push(draai(samen));

  const tekst = rondes.map(u => String(u.stdout || '') + String(u.stderr || '')).join('\n');
  const uit = { status: rondes.some(u => u.status !== 0) ? 1 : 0 };
  /* Alleen de regels die zeggen WELK register achterloopt en HOE het te
     herstellen is. De volle testuitvoer is duizenden regels; wie moet
     handelen, heeft deze twee nodig. */
  /* ALLEEN REGELS DIE OVER EEN GEZAKTE TOETS GAAN. Zonder die tweede eis kwam
     hier een OK-regel als bewijs onder "een register loopt achter" te staan --
     de melding stond in de naam van een geslaagde subtest. Een poort die een
     groene regel als bewijs van rood toont, stuurt de lezer de verkeerde kant
     op, en dat is precies wat deze poort moet voorkomen. */
  const meldingen = tekst.split('\n').filter(r =>
    !/^\s*(ok|# Subtest:)/.test(r) &&
    (MERKEN.some(m => r.includes(m.merk)) || /draai: npm run/.test(r)));
  if (uit.status === 0) {
    console.log('  ' + K.groen + 'Alle registers kloppen met een verse meting.' + K.uit + '\n');
    process.exit(0);
  }
  console.error('  ' + K.rood + K.vet + 'EEN OF MEER REGISTERS LOPEN ACHTER.' + K.uit);
  const regels = [...new Set(meldingen)];
  /* NIETS TE MELDEN IS GEEN LEGE LIJST MAAR EEN ANDER SOORT FOUT. Zakte er een
     toets zonder dat hij over een register ging (een verdwenen bestand, een
     stukke meter), dan hoort daar de NAAM van die toets te staan in plaats van
     een stilte onder een kop die zegt dat een register achterloopt. */
  if (regels.length) for (const m of regels) console.error('    ' + m.trim());
  else {
    console.error('    ' + K.grijs + 'geen register meldde dat het achterloopt; er zakte iets anders:' + K.uit);
    for (const r of tekst.split('\n').filter(r => /^not ok /.test(r)).slice(0, 10))
      console.error('    ' + r.trim());
  }
  console.error('\n  ' + K.grijs + 'Draai de genoemde opdracht(en), commit het register, en draai dit opnieuw.' + K.uit + '\n');
  process.exit(1);
}

module.exports = { vind, MERK, MERKEN };
