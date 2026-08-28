/* DE TOEGANKELIJKHEIDSADAPTER -- leest hij de keuring werkelijk goed uit?

   scripts/rtg-a11y.js voegt geen regels toe: hij richt de bestaande machinerie
   (scripts/a11ykeuring.js en scripts/raakvlakkeuring.js) op een bundel van een
   derde en vertaalt de uitkomst. Precies dat vertaalstuk is waar het misging, en
   het is de reden dat dit bestand bestaat.

   DE FOUT DIE HIER IS GEMAAKT. De eerste versie las `ruw.structureel`. Die sleutel
   bestaat niet -- de keuring geeft `overtredingen` terug -- en beide waarden zijn
   LIJSTEN en geen objecten. Gevolg: `Object.keys()` liep over de contrastlijst en
   die kwam er per ongeluk goed uit, terwijl de zes structurele controles
   stilletjes niets meldden. Een app met een afbeelding zonder alt, een knop
   zonder naam, een veld zonder label, een link zonder naam, geen lang en geen
   title kreeg "in orde".

   Dat is de gevaarlijkste soort stilte: een keuring die zwijgt ziet er precies zo
   uit als een keuring die niets vindt (LAT-regel 5). Deze toets voert daarom de
   ECHTE uitvoervorm van de keuring in en rekent na dat er zeven bevindingen
   uitkomen -- niet dat de functie "iets" doet.

   Draai los: node --test test/rtg-a11y.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../scripts/rtg-a11y');

const WORTEL = path.join(__dirname, '..');

/* De vorm die window.__a11yKeur() werkelijk teruggeeft:
   { overtredingen: [...], contrast: [...] }, allebei LIJSTEN van
   { id, help, aantal, waar[] }. Zie het slot van keurInPagina() in
   scripts/a11ykeuring.js. */
const ECHT = {
  overtredingen: [
    { id: 'afbeelding-alt', help: 'Afbeelding zonder alt-tekst', aantal: 1, waar: ['img'] },
    { id: 'knop-naam', help: 'Knop zonder toegankelijke naam', aantal: 1, waar: ['button#knop'] },
    { id: 'link-naam', help: 'Link zonder toegankelijke naam', aantal: 1, waar: ['a'] },
    { id: 'veld-label', help: 'Formulierveld zonder label', aantal: 2, waar: ['input', 'select'] },
    { id: 'html-taal', help: '<html> zonder lang-attribuut', aantal: 1, waar: [] },
    { id: 'titel', help: 'Document zonder <title>', aantal: 1, waar: [] }
  ],
  contrast: [
    { id: 'contrast', help: 'Te laag kleurcontrast (1.56:1)', aantal: 1, waar: ['p.flets'] }
  ]
};

test('1 - de zes structurele controles komen erdoor, niet alleen contrast', () => {
  /* De regressie. Zou de adapter weer de verkeerde sleutel lezen, dan blijft er
     een bevinding over -- en die ene ziet er uit als een keuring die werkt. */
  const b = A.naarBevindingen(ECHT, 'index.html');
  assert.equal(b.length, 7, 'zes structurele plus een contrast');
  const watten = b.map(x => x.wat).join(' | ');
  for (const stuk of ['Afbeelding zonder alt', 'Knop zonder toegankelijke naam',
    'Link zonder toegankelijke naam', 'Formulierveld zonder label',
    'lang-attribuut', 'Document zonder <title>', 'kleurcontrast']) {
    assert.ok(watten.includes(stuk), stuk + ' hoort in de uitslag te staan');
  }
});

test('2 - elke bevinding draagt WAAR, WAT en HOE', () => {
  const b = A.naarBevindingen(ECHT, 'tweede.html');
  for (const x of b) {
    assert.equal(x.bestand, 'tweede.html', 'zonder bestand is het een zoekopdracht');
    assert.ok(x.wat && x.wat.length > 5);
    assert.ok(x.hoe && x.hoe.length > 30, 'een bevinding zonder uitweg is een verwijt: ' + x.wat);
    assert.equal(x.ernst, 'fout');
  }
});

test('3 - de HOE hoort bij de bevinding en is niet de terugval', () => {
  const b = A.naarBevindingen(ECHT, 'x.html');
  const alt = b.find(x => /Afbeelding/.test(x.wat));
  assert.match(alt.hoe, /alt=""/, 'de uitweg voor een decoratieve afbeelding hoort erbij te staan');
  const label = b.find(x => /Formulierveld/.test(x.wat));
  assert.match(label.hoe, /placeholder is geen label/, 'juist die verwarring hoort te worden benoemd');
  const contrast = b.find(x => /kleurcontrast/.test(x.wat));
  assert.match(contrast.hoe, /4,5:1/);
  // en een onbekende regel valt terug op iets bruikbaars in plaats van op niets
  const onbekend = A.naarBevindingen({ overtredingen: [{ id: 'nieuw-iets', help: 'Iets nieuws', aantal: 1, waar: [] }] }, 'x.html');
  assert.match(onbekend[0].hoe, /TOEGANKELIJK\.md/);
});

test('4 - het aantal en de vindplaatsen gaan mee', () => {
  const b = A.naarBevindingen(ECHT, 'x.html');
  const veld = b.find(x => /Formulierveld/.test(x.wat));
  assert.match(veld.wat, /\(2x\)/, 'twee keer dezelfde fout hoort als aantal te tellen');
  assert.match(veld.wat, /input/, 'met een adres, anders zoekt de vinder');
  const taal = b.find(x => /lang-attribuut/.test(x.wat));
  assert.doesNotMatch(taal.wat, /--\s*$/, 'een paginabrede bevinding heeft geen element en hoort geen leeg adres te krijgen');
});

test('5 - een schone pagina levert niets op', () => {
  assert.deepEqual(A.naarBevindingen({ overtredingen: [], contrast: [] }, 'x.html'), []);
  assert.deepEqual(A.naarBevindingen({}, 'x.html'), [], 'en een lege uitkomst valt niet om');
  assert.deepEqual(A.naarBevindingen(null, 'x.html'), []);
});

test('6 - raakvlakken zijn LET-OP en geen fout', () => {
  /* WCAG 2.5.8 is een echte grens, maar hij hangt aan het formaat waarop je
     meet. Daarom staat hij hier apart van structuur en contrast: een uitgever
     hoort te zien dat het twee verschillende beweringen zijn. */
  const b = A.raakvlakBevindingen({ klein: ['button#knop  16x16', 'a  0x0'], gekeken: 5 }, 'index.html');
  assert.equal(b.length, 1);
  assert.equal(b[0].ernst, 'let-op');
  assert.match(b[0].wat, /2 raakvlak/);
  assert.match(b[0].wat, /24x24/);
  assert.match(b[0].hoe, /padding/, 'de goedkoopste uitweg hoort genoemd te worden');
  assert.deepEqual(A.raakvlakBevindingen({ klein: [] }, 'x.html'), []);
  assert.deepEqual(A.raakvlakBevindingen(null, 'x.html'), []);
});

test('7 - de adapter hergebruikt de machinerie en bouwt hem niet na', () => {
  /* De hele belofte van dit bestand. Zou hij zijn eigen contrastrekensom of zijn
     eigen elementregels krijgen, dan meet een derdenbundel iets anders dan onze
     eigen schermen -- en dan zeggen twee keuringen op een dag iets anders over
     hetzelfde (BESTUUR.md). */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/rtg-a11y.js'), 'utf8');
  assert.match(bron, /require\('\.\/a11ykeuring'\)/, 'de structuur- en contrastkeuring komt uit de bestaande module');
  assert.match(bron, /require\('\.\/raakvlakkeuring'\)/, 'de raakvlakkeuring ook');
  assert.match(bron, /a11y\.velt\(/, 'en het oordeel komt daar ook vandaan');
  assert.ok(!/luminantie|0\.2126|querySelectorAll\('img'\)/.test(bron),
    'de adapter hoort geen eigen contrastrekensom of eigen elementregels te hebben');
  assert.ok(!/24\s*;/.test(bron.replace(/GRENS/g, '')), 'en de raakvlakgrens hoort uit raakvlakkeuring.GRENS te komen');
});

test('8 - geen browser is geen goedkeuring', () => {
  /* Zelfde regel als de virusscanner in de machinepoort: een controle die niet
     heeft gedraaid, is geen stilzwijgend ja. De uitgangscode is daarom 3 en niet
     0 -- anders leest een CI-keten "geslaagd". */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/rtg-a11y.js'), 'utf8');
  assert.match(bron, /niet vast te stellen/, 'de derde uitslag hoort ook hier te bestaan');
  assert.match(bron, /return 3;/, 'en een eigen uitgangscode te hebben, geen 0');
});
