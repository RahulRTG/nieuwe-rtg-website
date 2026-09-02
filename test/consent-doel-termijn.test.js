/* ============================================================================
   ELK VENSTER ZEGT WAARVOOR HET BESTAAT EN WANNEER HET DICHTGAAT

   HDI.md par. 7 regel 6. Het Consent Center gaf per toestemming wel WIE en WAT,
   maar niet WAARVOOR -- en de termijn was bij vijf van de negen lagen een kale
   `tot: null`. Die null betekende twee verschillende dingen die op een scherm
   identiek lezen:

     "loopt door tot u hem stopt"      (met opzet geen einddatum)
     "deze laag houdt geen datum bij"  (een gat)

   Dat is precies wat KOSTEN.md verbiedt (nooit een getal waar er geen is) en wat
   rapport.js oplost met `gemeten: false` in plaats van nette nullen. Vier zinnen:

     1. elke laag in het register noemt een doel;
     2. elke laag noemt een termijnsoort, en "zolang het staat" draagt een reden;
     3. er is geen restpost: elke laag is een van de twee, geen derde stand;
     4. het scherm toont de termijn ALTIJD, ook zonder datum.

   MET EEN MUTATIE NAGETROKKEN:
     - het doel van een laag weghalen: RAAK op 1;
     - de termijnUitleg van een laag weghalen: RAAK op 2;
     - een laag de soort 'onbekend' geven: RAAK op 3;
     - in toestemming.html de termijnregel weer voorwaardelijk maken: RAAK op 4.

   WAT HIER NIET IN STAAT, want het is al gemeten en het bleek geen gat: alle
   vier de lagen MET een einddatum filteren verlopen vensters bij de bron
   (care/leden.js, rtgid-regie.js twee keer, en consent.js rekent de paspoortkant
   zelf na). Er wordt dus nergens een dicht venster als open getoond.

   Draai los: node --test test/consent-doel-termijn.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { LAGEN } = require('../server/kern/consent-register');
const SOORTEN = ['venster', 'zolang-het-staat'];

test('1. elke laag noemt waarvoor hij bestaat', () => {
  for (const l of LAGEN) {
    assert.ok(l.doel && l.doel.length > 20,
      'laag "' + l.id + '" noemt geen doel. Een lijst zonder doel is een inventaris, geen toestemming.');
    assert.match(l.doel, /\.$/, 'het doel van "' + l.id + '" hoort een hele zin te zijn');
  }
});

test('2. een venster zonder einddatum zegt waarom het er geen heeft', () => {
  for (const l of LAGEN.filter(x => x.termijn === 'zolang-het-staat')) {
    assert.ok(l.termijnUitleg && l.termijnUitleg.length > 20,
      'laag "' + l.id + '" loopt door zonder einddatum en zegt niet waarom. Dat leest op een scherm ' +
      'als een vergeten datum in plaats van een keuze.');
  }
});

test('3. er is geen derde stand, en dus geen restpost', () => {
  for (const l of LAGEN) {
    assert.ok(SOORTEN.includes(l.termijn),
      'laag "' + l.id + '" heeft termijn "' + l.termijn + '"; dat hoort ' + SOORTEN.join(' of ') +
      ' te zijn. Een restpost is binnen een jaar de plek waar een nieuwe laag stil in verdwijnt.');
  }
  /* De verdeling is GEMETEN en niet aangenomen: vier met een datum, zeven
     zonder. Dit getal is met opzet hard: het dwingt een mens om bij elke nieuwe
     laag te kiezen welke termijn hij draagt, in plaats van hem stil in een
     restpost te laten vallen.

     HIJ HEEFT ZIJN WERK GEDAAN. Op 2 september 2026 stond hier 4 en 5, en de
     toets zakte bij het binnenhalen van de hoofdlijn: die had er twee lagen bij
     gezet (`metier-naam` en `commercieel`) die nog geen termijn hadden. Allebei
     `zolang-het-staat`, allebei met een uitleg -- en dat is een besluit dat
     iemand heeft genomen omdat deze regel hem stelde. */
  assert.equal(LAGEN.filter(l => l.termijn === 'venster').length, 4);
  assert.equal(LAGEN.filter(l => l.termijn === 'zolang-het-staat').length, 7);
});

test('4. het scherm toont de termijn altijd, ook zonder datum', () => {
  /* Op de BRON en niet op een draaiende server: wat hier fout kan gaan is dat
     iemand de regel weer voorwaardelijk maakt op t.tot, en dan verdwijnt hij bij
     precies de vijf lagen die er geen hebben. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'toestemming.html'), 'utf8');
  assert.match(bron, /'<div class="tot">' \+ esc\(termijn\(t\)\)/,
    'de termijnregel hoort onvoorwaardelijk te worden getekend');
  assert.ok(!/t\.tot \? '<div class="tot">/.test(bron),
    'de termijnregel is weer voorwaardelijk op t.tot; dan verdwijnt hij bij de lagen zonder einddatum');
  assert.match(bron, /t\.doel \? '<div class="doel">/, 'het scherm hoort het doel te tonen');
});
