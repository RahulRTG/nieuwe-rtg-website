/* ============================================================================
   DE GRAFEN EN HUN AS -- de meter die beslist of de aandachtlaag EEN laag wordt.

   WAAROM DEZE TOETS ZWAAR WEEGT. scripts/graafas.js beantwoordt een vraag die
   voor de aandachtlaag alles bepaalt: meten de grafen dringendheid op dezelfde
   as? Zegt hij ten onrechte JA, dan wordt er een laag gebouwd op een veld dat
   niet bestaat -- dezelfde fout als `Asset`, maar dan op de plek die bepaalt wat
   er bovenaan komt te staan.

   De meter leunt op een REGISTER waarin een mens beweert welk veld de as van
   een graaf is. Zo'n bewering veroudert. Deze toets bewaakt dus niet de uitkomst
   maar de ZELFIJKING: zakt de meter als het register niet meer klopt met de code?

   DE MUTATIES VOOR DIT BESTAND, elk een keer gedraaid en zien zakken:
     1. zet in het register de as van de socialegraaf op 'dringend'
        -> "een as die niet in de eenheid staat, laat de meter zakken" zakt;
     2. haal in kern/socialegraaf/hulp.js het veld `wacht` uit `moment`
        -> dezelfde toets zakt, nu vanuit de andere kant;
     3. zet de makerfunctie van de geldgraaf op 'feitje'
        -> "een makerfunctie die niet bestaat, laat de meter zakken" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const graafas = require('../scripts/graafas');
const { meet, REGISTER, veldenVanLiteraal } = graafas;

test('elke graaf in het register bestaat, en zijn eenheid is leesbaar', () => {
  const u = meet();
  assert.deepEqual(u.klachten, [], 'de meter hoort schoon te lopen: ' + u.klachten.join(' | '));
  for (const g of REGISTER) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', g.bestand)), g.id + ' wijst naar een bestand dat niet bestaat');
    assert.ok(g.waarom && g.waarom.length > 30, g.id + ' mist een uitgeschreven reden');
  }
});

test('een as die niet in de eenheid staat, laat de meter zakken', () => {
  /* DE ZELFIJKING IN ZIJN KERN. Het register mag beweren wat het wil; de code
     beslist. Deze toets voert een verzonnen as in en verwacht een klacht. */
  const echt = REGISTER.find(g => g.id === 'socialegraaf');
  const terug = echt.as;
  try {
    echt.as = 'dringend';
    const u = meet();
    assert.ok(u.klachten.some(k => /socialegraaf.*dringend/.test(k)),
      'een verzonnen as hoort een klacht op te leveren, kreeg: ' + JSON.stringify(u.klachten));
  } finally { echt.as = terug; }
  assert.deepEqual(meet().klachten, [], 'en daarna hoort hij weer schoon te lopen');
});

test('een makerfunctie die niet bestaat, laat de meter zakken', () => {
  const echt = REGISTER.find(g => g.id === 'geldgraaf');
  const terug = echt.maker;
  try {
    echt.maker = 'feitje';
    assert.ok(meet().klachten.some(k => /geldgraaf.*feitje/.test(k)));
  } finally { echt.maker = terug; }
});

test('een graaf die andermans vorm leest, wordt NIET vergeleken', () => {
  /* DE REGEL DIE EEN VERKEERD GETAL VOORKOMT. De eerste versie van de meter nam
     voor zo'n graaf "de grootste literaal in het bestand" en vergeleek die met
     `feit` en `moment`. Wat hij dan las was het ANTWOORD van de graaf
     ({knopen, lagen, diepte}) en niet zijn eenheid, en het overlapgetal ging
     nergens over. Nu staat er dat de eenheid niet is vastgesteld, mét de reden. */
  const u = meet();
  const zonder = u.grafen.filter(g => g.eenheidVastgesteld === false);
  assert.ok(zonder.length >= 1, 'er hoort minstens een graaf zonder eigen eenheid te zijn');
  for (const g of zonder) {
    assert.ok(g.waaromGeenEenheid && g.waaromGeenEenheid.length > 30, g.id + ' mist de reden');
    assert.equal(g.velden, undefined, g.id + ' hoort geen velden te dragen');
    for (const p of u.paren) assert.notEqual(p.a, g.id, g.id + ' staat toch in een vergelijking');
    for (const d of u.gedeeld) assert.ok(!d.grafen.includes(g.id), g.id + ' telt toch mee in de gedeelde velden');
  }
});

test('de uitkomst zegt wat hij meet: drie assen, en geen ervan gedeeld', () => {
  /* Dit is de bevinding zelf, en hij staat hier zodat hij niet stil kan
     veranderen. Wordt een as ooit wel gedeeld, dan hoort dat een gesprek te
     zijn en geen commit die niemand opvalt. */
  const u = meet();
  assert.equal(u.gemeten.metEenAs, 3);
  assert.equal(u.gemeten.verschillendeAssen, 3);
  assert.equal(u.gemeten.assenGedeeld, 0);
  const assen = u.assen.map(a => a.as).sort();
  assert.deepEqual(assen, ['richting', 'vervalt', 'wacht']);
});

test('de drie eenheden delen wel een verpakking: soort en bron', () => {
  const u = meet();
  const alledrie = u.gedeeld.filter(d => d.aantal === 3).map(d => d.veld).sort();
  assert.deepEqual(alledrie, ['bron', 'soort'],
    'de drie grafen delen precies deze velden; verandert dat, dan verandert de conclusie');
});

test('veldenVanLiteraal leest de VORM en niet het functielijf', () => {
  /* De eerste fout van deze meter, als voorbeeld vastgelegd: hij pakte de
     accolade van het functielijf en vond daar geen velden. */
  const code = 'function feit(o) {\n  const f = {\n    soort: 1,\n    titel: 2,\n    richting: 3\n  };\n  return f;\n}';
  const velden = veldenVanLiteraal(code, code.indexOf('(o)') + 3);
  assert.deepEqual(velden, ['soort', 'titel', 'richting']);
});

test('een geneste literaal levert geen velden van een ander niveau', () => {
  const code = 'const x = { a: 1, b: { verstopt: 2 }, c: 3 };';
  assert.deepEqual(veldenVanLiteraal(code, 0), ['a', 'b', 'c']);
});

test('GRAAFAS.json is gelijk aan de meting eronder', () => {
  const opSchijf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'GRAAFAS.json'), 'utf8'));
  assert.deepEqual(meet().gemeten, opSchijf.gemeten, 'draai: npm run graafas:vast');
});
