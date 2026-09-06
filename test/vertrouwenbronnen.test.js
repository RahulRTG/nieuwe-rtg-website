/* LEEST DE VERSHEIDSMETER ALLE REGISTERS DIE DE MATRIX LEEST?

   scripts/bewijsmatrix.js bepaalt per route zijn elf cellen uit een stapel
   registers. scripts/vertrouwen.js rekent daar de ouderdom van het bewijs bij:
   de OUDSTE stempel van zijn BRONNEN, want bewijs is zo vers als zijn oudste
   been. Staat een register wel in de matrix en niet in die lijst, dan telt zijn
   ouderdom niet mee -- en dan kan een verouderde ronde het bewijs niet ouder
   maken. Twee gaten die elkaar dekken.

   DAT IS HIER DRIE KEER GEBEURD. HANDELINGPROEF.json en UITVOERPROEF.json
   stonden er niet (het staat in de kop van BRONNEN uitgeschreven), en toen de
   FAILURE-kolom werd aangesloten gold hetzelfde voor FAALPROEF.json. Een fout
   die zich drie keer herhaalt, is geen slordigheid maar een ontbrekende toets.

   Deze toets vergelijkt de twee lijsten en niet hun inhoud: hij leest welke
   `inWortel('X.json')`-registers de matrix noemt, en eist dat elk daarvan in
   BRONNEN staat -- tenzij het met een reden op de uitzonderingslijst hieronder
   staat.

   Draai los: node --test test/vertrouwenbronnen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { BRONNEN } = require('../scripts/vertrouwen.js');

/* Registers die de matrix leest maar die met opzet GEEN bron van versheid zijn.
   Elk met de reden, want een uitzondering zonder reden is een gat met een naam. */
const GEEN_VERSHEIDSBRON = new Map([
  ['IDEMBESLUIT.json', 'een BESLUIT en geen meting: hij veroudert niet, hij wordt herzien'],
  ['ROLLBACKBESLUIT.json', 'idem -- een besluit over herstel, geen ronde'],
  ['AUDITPROEF-JOURNAAL.json', 'het journaal NAAST AUDITPROEF.json; die laatste draagt de stempel'],
]);

test('elk register dat de matrix leest, telt mee voor de versheid', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'bewijsmatrix.js'), 'utf8');
  const gelezen = [...new Set([...bron.matchAll(/inWortel\('([A-Z][A-Z0-9-]*\.json)'\)/g)].map(m => m[1]))];
  assert.ok(gelezen.length >= 10, 'de matrix hoort een stapel registers te lezen, gevonden: ' + gelezen.length);

  const mist = gelezen.filter(n => !BRONNEN.includes(n) && !GEEN_VERSHEIDSBRON.has(n));
  assert.deepEqual(mist, [],
    'deze registers leest de bewijsmatrix wel en scripts/vertrouwen.js niet. Zet ze in BRONNEN, ' +
    'of in GEEN_VERSHEIDSBRON hierboven MET de reden waarom hun ouderdom niet telt.');
});

test('en er staat niets in BRONNEN dat de matrix helemaal niet leest', () => {
  /* De andere kant op, want een bron die nergens wordt gelezen maakt het bewijs
     ouder zonder dat hij er iets aan bijdraagt -- dat is geen strengheid maar
     ruis. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'bewijsmatrix.js'), 'utf8');
  const overbodig = BRONNEN.filter(n => !bron.includes(n));
  assert.deepEqual(overbodig, [],
    'deze bronnen wegen mee voor de versheid maar worden door de matrix niet gelezen');
});

test('de uitzonderingen dragen allemaal een reden', () => {
  for (const [naam, reden] of GEEN_VERSHEIDSBRON) {
    assert.ok(reden && reden.length > 20, naam + ' staat als uitzondering zonder bruikbare reden');
  }
});
