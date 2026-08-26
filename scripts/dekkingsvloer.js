#!/usr/bin/env node
'use strict';

/* ============================================================================
   DE DEKKINGSVLOER OVER MEERDERE DELEN.

   WAAROM DIT ER IS

   De dekkingsvloer stond in de vlaggen van `npm run test:gate`:
   --test-coverage-lines=78 --test-coverage-branches=78 --test-coverage-functions=65.
   Die vlaggen rekenen PER PROCES. Zodra de suite over vier runners wordt
   verdeeld, meet elk deel alleen zijn eigen kwart en zakt elke vloer -- of erger,
   iemand verlaagt de vloer tot een kwart hem haalt, en dan bewaakt hij niets meer.

   Daarom rekent de vloer nu buiten de testrun: elk deel schrijft een lcov-bestand
   (--test-reporter=lcov), en dit script telt die bestanden bij elkaar op voordat
   het oordeelt. Een regel die in deel 3 geraakt is, telt ook als deel 1 hem
   nooit heeft geladen. Dat is precies wat de vlaggen deden toen alles nog in een
   proces liep.

   WAT ER GEMETEN WORDT, EN WAT NIET

   Node meet de dekking van wat er IN HET TESTPROCES ZELF is geladen. De
   kindservers die de toetsen starten zijn eigen processen en tellen hier niet
   mee -- dat was voor deze verdeling ook al zo, en het is dus geen verlies. Wat
   die servers werkelijk hebben afgehandeld, staat in het routejournaal en wordt
   door scripts/dekking.js gemeten. De twee meters kijken bewust naar iets anders.

   DE VLOEREN

   GEMETEN OP 17 AUGUSTUS 2026, volledige suite (6520 toetsen) in EEN proces:
     regels 80,63   takken 80,60   functies 67,73   -> vloer 78 / 78 / 65
   NAGEMETEN OP 26 AUGUSTUS 2026, de suite (975 toetsbestanden) over vier
   delen, opgeteld:
     regels 81,32   takken 80,66   functies 68,80
   Het opdelen kost de vloeren dus niets: de drie cijfers liggen op of boven de
   basislijn van augustus. De afstand tot de vloer is ook dezelfde gebleven als
   toen hij gezet werd (ruim drie, bijna drie en bijna vier punten), dus de
   vloeren blijven staan waar ze staan.

   EEN WAARSCHUWING UIT DEZELFDE MIDDAG, want hij kost anders een uur. Een eerste
   ronde gaf 78,91 / 80,04 / 65,07 en dat leek dunne lucht. Het was een kapotte
   meting: er kwam tijdens die ronde een toetsbestand bij, en omdat de delen om
   en om over de GESORTEERDE lijst lopen, schoof daarmee de verdeling een plek
   op -- een kwart van de bestanden draaide nooit. Wie hier een cijfer ziet dat
   niet klopt, kijkt dus eerst of alle delen dezelfde lijst zagen.

   Gebruik:
     node scripts/dekkingsvloer.js <map-of-lcov-bestand> [...meer]
     node scripts/dekkingsvloer.js dekking --json
   ========================================================================== */

const { meet, voegSamen, tel, lcovBestanden } = require('./lib/lcov');

const VLOER = { regels: 78, takken: 78, functies: 65 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const jsonUit = argv.includes('--json');
  const paden = argv.filter(a => !a.startsWith('--'));
  if (!paden.length) {
    console.error('Geef minstens een lcov-bestand of een map met lcov-bestanden mee.');
    process.exit(2);
  }
  const uitslag = meet(paden);

  /* GEEN LCOV IS GEEN UITSLAG. Zonder deze regel zou een deel dat zijn bestand
     niet heeft weggeschreven -- een gevallen runner, een verkeerd pad -- hier
     als 100% dekking van nul regels binnenkomen, en dan meldt de vloer groen
     over een meting die nooit heeft plaatsgevonden. Dat is precies de vorm waar
     LAT.md regel 10 voor waarschuwt. */
  if (!uitslag.delen || !uitslag.bestanden) {
    console.error('Geen lcov-gegevens gevonden in: ' + paden.join(', ') +
      ' -- dan stelt deze vloer niets vast.');
    process.exit(1);
  }

  if (jsonUit) {
    console.log(JSON.stringify({ vloer: VLOER, gemeten: uitslag }, null, 2));
  } else {
    console.log('\nDE DEKKINGSVLOER -- ' + uitslag.delen + ' deel/delen samengeteld over ' +
      uitslag.bestanden + ' bronbestanden\n');
    for (const [soort, waarde] of [['regels', uitslag.regels], ['takken', uitslag.takken], ['functies', uitslag.functies]]) {
      const vloer = VLOER[soort];
      const merk = waarde + 1e-9 >= vloer ? '  ' : '<-';
      console.log('  ' + soort.padEnd(10) + waarde.toFixed(2).padStart(6) + '%   vloer ' +
        String(vloer).padStart(3) + '   ' + merk);
    }
    console.log('');
  }

  const gezakt = ['regels', 'takken', 'functies'].filter(s => uitslag[s] + 1e-9 < VLOER[s]);
  if (gezakt.length) {
    console.error('DEKKING GEZAKT op: ' + gezakt.map(s => s + ' ' + uitslag[s].toFixed(2) + '% < ' + VLOER[s] + '%').join(', '));
    process.exit(1);
  }
  if (!jsonUit) console.log('De dekking haalt elke vloer.');
}

/* De meetfuncties gaan hier ook weer naar buiten: test/delen.test.js leest de
   vloer en de samenvoeging als een geheel, en dat is precies wat de CI doet. */
module.exports = { VLOER, meet, voegSamen, tel, lcovBestanden };
