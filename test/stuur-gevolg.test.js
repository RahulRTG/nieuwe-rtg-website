/* DE GEVOLGVOORSPELLING (server/kern/stuur/gevolg.js, EXECUTIE.md blok 4).

   Een gebruiker vraagt voor het bevestigen niet "welke routes roep je aan" maar
   "wat verandert er dan". Deze laag beantwoordt daar een deel van uit een echte
   meting -- de idempotentieproef noteerde per route WELKE collecties veranderden
   -- en de rest van het werk van deze suite is bewaken dat het ontbrekende deel
   zichtbaar blijft.

   DE SCHERPSTE EIS: "de proef kwam er niet bij" mag NOOIT lezen als "er gebeurt
   niets". Dat zijn twee verschillende dingen en het verschil is precies de
   gevaarlijke kant: een plan dat zegt "raakt niets aan" terwijl niemand heeft
   gekeken, is een geruststelling zonder grond. Over de paden die de AI mag
   bedienen staat 96 van de 176 op onbekend; een voorspelling die dat verzwijgt
   leest als volledigheid (PROOF.md par. 9.1, bon.js).

   En net als plan.js: hij voert niets uit, en hij hangt NAAST het plan. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { voorspel, gevolgVan, GRENZEN } = require('../server/kern/stuur/gevolg');
const { compileer } = require('../server/kern/stuur/plan');

const RUW = fs.readFileSync(path.join(__dirname, '..', 'server/kern/stuur/gevolg.js'), 'utf8');
const BRON = RUW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('1. HIJ VOERT NIETS UIT: geen weg naar een effect in de code', () => {
  for (const verboden of [/\bfetch\s*\(/, /stuurRoep/, /child_process/, /fs\.write/])
    assert.ok(!verboden.test(BRON), 'gevolg.js bevat een weg naar uitvoering: ' + verboden);
});

test('2. een gemeten route noemt zijn collecties, en die komen uit het register', () => {
  const g = gevolgVan('/api/bank/overboek');
  assert.equal(g.graad, 'gemeten');
  assert.ok(g.collecties.includes('bankSaldi'), 'bankSaldi ontbreekt: ' + g.collecties.join(' '));
  const rijen = require('../IDEMPROEF.json').perRoute.filter(r => r.pad === '/api/bank/overboek');
  const echt = new Set();
  for (const r of rijen) for (const k of ['a', 'b', 'c']) for (const c of Object.keys((r.opslag || {})[k] || {})) echt.add(c);
  assert.deepEqual(g.collecties, [...echt].sort(), 'de voorspelling wijkt af van het register');
});

test('3. NIET GEMETEN IS GEEN "GEEN EFFECT": de graden worden niet door elkaar gehaald', () => {
  const onbekend = gevolgVan('/api/site/publiceer');
  assert.equal(onbekend.graad, 'onbekend', 'een route waar de proef niet bij kwam heet geen "geen effect"');
  assert.match(onbekend.reden, /niet bij|nooit gemeten/i);
  const verzonnen = gevolgVan('/api/bestaat/niet');
  assert.equal(verzonnen.graad, 'onbekend');
  assert.deepEqual(verzonnen.collecties, []);
});

test('4. elke uitslag draagt een graad EN een reden', () => {
  for (const pad of ['/api/bank/overboek', '/api/site/publiceer', '/api/pay/saldo', '/api/zomaar/iets']) {
    const g = gevolgVan(pad);
    assert.ok(['gemeten', 'geen-effect-gemeten', 'onbekend'].includes(g.graad), pad + ': onbekende graad ' + g.graad);
    assert.ok(g.reden && g.reden.length > 20, pad + ': graad zonder reden');
  }
});

test('5. de voorspelling over een plan telt het onbekende MEE en noemt het', () => {
  const plan = compileer({ doel: 'gemengd', stappen: [
    { id: 'a', capability: '/api/bank/overboek' },
    { id: 'b', capability: '/api/agenda/toevoegen' },
    { id: 'c', capability: '/api/site/publiceer' }] }, 'member');
  const g = voorspel(plan);
  assert.equal(g.telling.gemeten + g.telling['geen-effect-gemeten'] + g.telling.onbekend, 3);
  assert.ok(g.telling.onbekend >= 1, 'geen enkele onbekende stap -- verdacht');
  assert.match(g.samenvatting, /NIET gemeten/, 'de samenvatting verzwijgt wat niet gemeten is');
  assert.match(g.grens, /onbekend/);
  assert.ok(g.geraakteCollecties.includes('bankSaldi'));
});

test('6. de voorspelling verandert het plan niet: PLAN bezit niets', () => {
  const plan = compileer({ doel: 'x', stappen: [{ id: 'a', capability: '/api/bank/overboek' }] }, 'member');
  const voor = JSON.stringify(plan);
  voorspel(plan);
  assert.equal(JSON.stringify(plan), voor, 'voorspel() heeft het plan aangeraakt');
});

test('7. de grenzen staan IN de uitslag en niet alleen in een commentaarregel', () => {
  const g = voorspel(compileer({ doel: 'x', stappen: [{ id: 'a', capability: '/api/pay/saldo' }] }, 'member'));
  assert.ok(Array.isArray(g.grenzen) && g.grenzen.length >= 4, 'te weinig uitgeschreven grenzen');
  assert.equal(g.grenzen.length, GRENZEN.length);
  assert.ok(g.grenzen.some(x => /invoer van de proef/i.test(x)), 'de invoergrens ontbreekt');
  assert.ok(g.grenzen.some(x => /mail|derde partij/i.test(x)), 'de buitenwereld-grens ontbreekt');
});

test('8. een leeg of afgewezen plan levert een lege maar eerlijke voorspelling', () => {
  const g = voorspel({ uitvoerbaar: false, stappen: [] });
  assert.deepEqual(g.geraakteCollecties, []);
  assert.ok(g.samenvatting.length > 10);
  assert.equal(g.telling.onbekend, 0);
});
