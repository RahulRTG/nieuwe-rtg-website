/* ============================================================================
   DE POORTEN IN DE HANDLER -- de map, en de twee fouten die erin zaten.

   server/kern/handlerpoorten.js zegt wat de bewakers doen die NIET in de router
   staan maar in het lichaam van een handler. Dat is een map die met de hand is
   gevuld na het lezen van zestig functies, en precies daarom staan hier toetsen:
   een handgevulde map is de plek waar een aanname binnenkomt.

   TWEE FOUTEN DIE ER ECHT IN ZATEN:

   1. DE SLEUTEL WAS 'bestand:naam'. Bedoeld om drie homoniemen uit elkaar te
      houden (`profiel`, `beheerVan`, `lidVan` betekenen elders iets anders),
      maar het werkte de verkeerde kant op: een poort wordt gedefinieerd in EEN
      bestand en gebruikt in tientallen. Van de 300 herkende poortvormen matchten
      er nog 41. De sleutel is nu de naam, met NIET_IN voor de uitzonderingen.

   2. HET BRONPAD IS NIET HET ROUTEPAD. Een submodule schrijft
      `router.post('/school/aandacht')` en hangt op
      /api/foundation/school/aandacht. Koppelen op achtervoegsel, en alleen bij
      precies een treffer -- twee treffers betekent dat we niet weten welke het
      is, en dan is niets toewijzen het enige eerlijke.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { POORTEN, poortVan, NIET_IN } = require('../server/kern/handlerpoorten');
const { TOEGANGNAMEN } = require('../server/kern/mutatiecontract');

const WORTEL = path.join(__dirname, '..');

test('elke poort noemt een bestaande toegangsklasse, of is expliciet geen deur', () => {
  for (const [naam, p] of Object.entries(POORTEN)) {
    if (p.toegang === null) {
      assert.strictEqual(p.soort, 'geen-deur',
        naam + ' heeft geen toegang en ook geen soort; "hier zit een rem" hoort iets anders te zijn dan "hier zit niets"');
      continue;
    }
    assert.ok(TOEGANGNAMEN.includes(p.toegang), naam + ' noemt toegang "' + p.toegang + '", en die bestaat niet');
  }
});

test('elke OBJECT_SCOPED poort noemt het VELD dat het object aanwijst', () => {
  /* Zonder dat veld kan geen proefopstelling de toestand bouwen, en dan is de
     classificatie een etiket in plaats van een opdracht. */
  for (const [naam, p] of Object.entries(POORTEN)) {
    if (p.toegang !== 'OBJECT_SCOPED') continue;
    assert.ok(p.veld && p.veld.length > 1, naam + ' is OBJECT_SCOPED zonder veld');
  }
});

test('elke poort zegt WAT hij doet, in meer dan een paar woorden', () => {
  for (const [naam, p] of Object.entries(POORTEN)) {
    assert.ok(p.wat && p.wat.length > 20,
      naam + ' heeft geen (of een te korte) beschrijving; deze map is met de hand gevuld en dan is ' +
      'de reden het enige wat de volgende lezer heeft');
  }
});

test('een genre-eis wordt NIET CAPABILITY_GATED genoemd', () => {
  /* CLAUDE.md/OS.md hebben die twee met opzet uit elkaar getrokken: een genre-cap
     (`retail`, `vracht`) zegt wat voor SOORT ZAAK dit is en staat niet in
     kern/bevoegdheid/lijst.js. Ze hier CAPABILITY_GATED noemen zou de twee
     begrippen weer laten versmelten -- precies de naamsverwarring die dat huis
     een keer een dode btw-tak heeft gekost. */
  for (const [naam, p] of Object.entries(POORTEN)) {
    if (!p.genre) continue;
    assert.notStrictEqual(p.toegang, 'CAPABILITY_GATED',
      naam + ' heeft een genre-eis en heet CAPABILITY_GATED; dat is een genre-cap en geen bevoegdheid');
  }
});

test('de homoniemen staan met naam en bestand in NIET_IN', () => {
  for (const naam of ['profiel', 'beheerVan', 'lidVan']) {
    assert.ok(Array.isArray(NIET_IN[naam]) && NIET_IN[naam].length,
      naam + ' betekent elders in dit huis iets anders en hoort in NIET_IN te staan');
    for (const bestand of NIET_IN[naam]) {
      assert.ok(fs.existsSync(path.join(WORTEL, bestand)),
        'NIET_IN noemt ' + bestand + ' en dat bestand bestaat niet (meer)');
      assert.strictEqual(poortVan(bestand, naam), null,
        naam + ' hoort in ' + bestand + ' GEEN poort te zijn');
    }
  }
});

test('een homoniem-bestand registreert nog steeds geen routes', () => {
  /* De hele reden dat de sleutel de NAAM mag zijn, is dat deze drie bestanden
     geen routes hebben -- dan kan geen handler er per ongeluk een aanroepen.
     Krijgt een van hen ooit een route, dan valt de aanname hier om en niet stil
     ergens in het register. */
  for (const bestanden of Object.values(NIET_IN)) {
    for (const bestand of bestanden) {
      const bron = fs.readFileSync(path.join(WORTEL, bestand), 'utf8');
      assert.ok(!/\b(?:app|router)\s*\.\s*(?:post|put|patch|delete)\s*\(/.test(bron),
        bestand + ' registreert nu wel routes; dan is de naam-als-sleutel niet meer veilig');
    }
  }
});

test('buiten NIET_IN geeft dezelfde naam wel de poort', () => {
  assert.ok(poortVan('server/foundation/gasten/keuken.js', 'familieVan'),
    'familieVan wordt in negen bestanden gebruikt en is in server/foundation.js gedefinieerd; ' +
    'een sleutel op het gebruikende bestand zou hem hier missen');
  assert.ok(poortVan('server/routes/rtfschool.js', 'profiel'));
});

test('de map dekt de vormen die de meting in de vastzittende bak vond', () => {
  /* HANDLERBEWAKERS.json is de meting; deze map is het antwoord erop. Vindt de
     meting een vorm die hier niet staat, dan blijven die routes zonder toegang
     -- en dat hoort op te vallen. */
  let meting = null;
  try { meting = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HANDLERBEWAKERS.json'), 'utf8')); } catch (e) {}
  if (!meting) return;                       // zonder meting valt er niets te vergelijken
  const missend = (meting.inDeBak || []).map(x => x.naam).filter(n => !POORTEN[n]);
  assert.deepStrictEqual(missend, [],
    'deze poortvormen kwamen uit de meting maar staan niet in de map: ' + missend.join(', '));
});
