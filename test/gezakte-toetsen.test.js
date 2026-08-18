/* De herhaling onderaan een rode CI-stap moet de REDEN dragen, niet alleen de
   naam. Dat is een belofte in .github/workflows/ci.yml ("zodat een rode stap
   zichzelf uitlegt"), en een belofte in tekst is een belofte in code.

   Waarom dit een eigen toets heeft: het script draait alleen als CI rood is, en
   dat is precies het moment waarop niemand er nog achteraan kan. Een fout hierin
   merk je dus pas als je hem het hardst niet kunt gebruiken. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { blokken, tellingen, rapport } = require('../scripts/gezakte-toetsen');

/* Een stuk echte TAP-uitvoer van node --test: een geslaagde toets, een gezakte
   met blok, en de tellingen. Letterlijk overgenomen uit CI-job 95666993170. */
const LOG = [
  '# Subtest: iets dat wel goed gaat',
  'ok 171 - iets dat wel goed gaat',
  '  ---',
  '  duration_ms: 12.5',
  '  type: \'test\'',
  '  ...',
  '# Subtest: Scanner: de PDF landt in de kluis',
  'not ok 172 - Scanner: de PDF landt in de kluis',
  '  ---',
  '  duration_ms: 8322.35339',
  '  location: \'test/scanner.e2e.js:20:1\'',
  '  failureType: \'testCodeFailure\'',
  '  error: \'de PDF staat als gewoon bestand in de map Scans\'',
  '  code: \'ERR_ASSERTION\'',
  '  expected: true',
  '  actual: false',
  '  stack: |-',
  '    TestContext.<anonymous> (test/scanner.e2e.js:62:12)',
  '  ...',
  '# Subtest: en verder gaat het goed',
  'ok 173 - en verder gaat het goed',
  '1..173',
  '# tests 242',
  '# pass 241',
  '# fail 1',
  '# skipped 0'
].join('\n');

test('het blok van een gezakte toets komt heel terug, met de reden erin', () => {
  const b = blokken(LOG);
  assert.equal(b.length, 1, 'precies de ene gezakte toets');
  assert.match(b[0], /not ok 172 - Scanner/);
  /* DIT is waar het om gaat. De oude herhaling in ci.yml gaf alleen de regel
     hierboven; wie dat las wist welke toets zakte en niet waarom. */
  assert.match(b[0], /error: 'de PDF staat als gewoon bestand in de map Scans'/);
  assert.match(b[0], /expected: true/);
  assert.match(b[0], /scanner\.e2e\.js:62:12/);
});

test('een geslaagde toets sleept niets mee de melding in', () => {
  const b = blokken(LOG);
  assert.doesNotMatch(b[0], /iets dat wel goed gaat/);
  assert.doesNotMatch(b[0], /en verder gaat het goed/);
});

/* Een gezakte toets ZONDER blok eronder mag de rest van het log niet opslurpen.
   Zonder deze grens kwam bij zo'n toets de hele dekkingstabel mee, en dan is de
   herhaling net zo onleesbaar als het origineel. */
test('een gezakte toets zonder blok stopt bij de volgende toets', () => {
  const kort = ['not ok 4 - zonder blok', 'ok 5 - de volgende', '  ---', '  duration_ms: 1', '  ...'].join('\n');
  const b = blokken(kort);
  assert.equal(b.length, 1);
  assert.equal(b[0], 'not ok 4 - zonder blok');
});

test('de tellingen komen mee, want een van zesduizend is iets anders dan een van drie', () => {
  const t = tellingen(LOG);
  assert.deepEqual(t, ['# tests 242', '# pass 241', '# fail 1', '# skipped 0']);
});

/* Afkappen mag, stil afkappen niet: anders leest een lijst van veertig als "dit
   was alles" terwijl er tweehonderd zakten. */
test('boven de veertig zegt hij hoeveel er niet zijn afgedrukt', () => {
  const veel = Array.from({ length: 45 }, (x, i) => 'not ok ' + (i + 1) + ' - toets ' + (i + 1)).join('\n');
  const r = rapport(veel);
  assert.equal(r.aantal, 45);
  assert.match(r.tekst, /nog 5 gezakte toetsen, hier niet afgedrukt/);
});

test('een log zonder gezakte toets levert geen valse lijst op', () => {
  const r = rapport('ok 1 - alles goed\n# tests 1\n# pass 1\n# fail 0');
  assert.equal(r.aantal, 0);
});
