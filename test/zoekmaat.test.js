/* Het meetinstrument van de zoekproefset (scripts/lib/zoekmaat.js). Een meter
   die niet kan uitslaan is geen meter, dus hier de gevallen waarin hij moet
   uitslaan. Draai los: node --test test/zoekmaat.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../scripts/lib/zoekmaat');

const notities = [{ id: 'a', tekst: 'De hond rent door het park.' }, { id: 'b', tekst: 'Mijn vlucht naar Rome.' },
  { id: 'c', tekst: 'Een kat slaapt op de bank.' }];

test('1. treffer@1, treffer@3 en MRR per soort en over alles', () => {
  const vragen = [{ relevant: ['a'], soort: 'x' }, { relevant: ['c'], soort: 'x' }, { relevant: ['b'], soort: 'y' }];
  const m = Z.maat(vragen, [['a', 'b', 'c'], ['a', 'b', 'c'], ['c', 'a', 'd', 'b']]);
  assert.deepEqual(m.x, { vragen: 2, treffer1: 0.5, treffer3: 1, mrr: +((1 + 1 / 3) / 2).toFixed(3) });
  assert.deepEqual(m.y, { vragen: 1, treffer1: 0, treffer3: 0, mrr: 0.25 });
  assert.equal(m.alles.vragen, 3);
  const nergens = Z.maat([{ relevant: ['z'], soort: 'x' }], [['a', 'b']]);
  assert.deepEqual(nergens.x, { vragen: 1, treffer1: 0, treffer3: 0, mrr: 0 }, 'niet gevonden is geen treffer');
});

test('2. bm25 vindt het woord, en weet niets als er geen woord gedeeld wordt', () => {
  const s = Z.bm25(notities);
  assert.equal(Z.rangorde(notities, (i) => s('vlucht Rome', i))[0], 'b');
  assert.ok(notities.every((_, i) => s('luchtvaart', i) === 0), 'geen gedeeld woord is nul, geen gok');
});

test('3. een gelijke stand wordt op id beslist en niet op plek in de set', () => {
  const omgekeerd = notities.slice().reverse();
  assert.deepEqual(Z.rangorde(omgekeerd, () => 0), ['a', 'b', 'c']);
});

test('4. samen: wat in beide lijsten hoog staat wint, en niets is af te stellen', () => {
  assert.deepEqual(Z.samen([['a', 'b', 'c'], ['b', 'a', 'c']]).slice(0, 2), ['a', 'b'], 'gelijk wordt op id beslist');
  /* a: 1/61 + 1/65 = 0,0318; b: 2/62 = 0,0323. Met drie notities zou a winnen
     (1/61 + 1/63 = 0,03227): de plek telt, niet alleen de volgorde. */
  assert.equal(Z.samen([['a', 'b', 'd', 'e', 'c'], ['c', 'b', 'd', 'e', 'a']])[0], 'b', 'twee keer tweede verslaat eerste en laatste van vijf');
});
