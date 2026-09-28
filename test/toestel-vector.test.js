/* Wat vóór en na het vectormodel zeker moet zijn (public/shared/toestel/vector.js,
   TOESTEL.md par. 12). Het model zelf wordt hier niet gedraaid -- dat staat met
   opzet niet in de repo en wordt gemeten door scripts/vectorproef.js -- maar een
   tokenizer die net anders knipt, geeft een vector die er goed uitziet en over
   een andere tekst gaat. Die fout zie je aan geen enkele uitkomst.
   Draai los: node --test test/toestel-vector.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../public/shared/toestel/vector.js');
const ref = require('./fixtures/minilm-tokens.json');

test('1. de tokens zijn die van de HF-tokenizer zelf, over accenten, leestekens, CJK, emoji en adressen', () => {
  /* Een onafhankelijke referentie: test/fixtures/minilm-tokens.json komt uit
     de Python-bibliotheek tokenizers, niet uit deze code. */
  ref.zinnen.forEach((z, i) => {
    assert.deepEqual(['[CLS]', ...V.tokens(z, ref.vocab), '[SEP]'], ref.tokens[i], 'zin ' + i + ': ' + z);
  });
});

test('2. de ids voor de runtime zijn die van de referentie, als BigInt64, een run per tekst', () => {
  const inv = V.invoer(ref.zinnen, ref.vocab);
  assert.equal(inv.reeks.length, ref.zinnen.length, 'een run per tekst, geen batch');
  inv.reeks.forEach((r, i) => {
    assert.ok(r.input_ids.data instanceof BigInt64Array);
    assert.deepEqual(r.input_ids.dims, [1, ref.ids[i].length]);
    assert.deepEqual(Array.from(r.input_ids.data, Number), ref.ids[i]);
    assert.ok(Array.from(r.attention_mask.data).every((x) => x === 1n));
    assert.ok(Array.from(r.token_type_ids.data).every((x) => x === 0n));
  });
});

test('3. afkappen gebeurt nooit stil', () => {
  const lang = Array(20).fill('park').join(' ');
  const inv = V.invoer([lang, 'park'], ref.vocab, 8);
  assert.deepEqual(inv.afgekapt, [true, false]);
  assert.equal(inv.reeks[0].input_ids.dims[1], 8, 'CLS + 6 + SEP');
  assert.equal(Number(inv.reeks[0].input_ids.data[7]), ref.vocab['[SEP]'], 'ook afgekapt eindigt hij met SEP');
});

test('4. een woord dat niet te knippen is wordt EEN [UNK], niet een half woord', () => {
  assert.deepEqual(V.tokens('park qqq park', { park: 1, q: 2, '[UNK]': 3 }), ['park', '[UNK]', 'park']);
  assert.deepEqual(V.tokens('x'.repeat(101), { x: 1, '##x': 2 }), ['[UNK]'], 'boven 100 tekens is het een [UNK]');
});

test('5. pool: het gemiddelde over de tokens, daarna lengte 1; cosinus is het inproduct', () => {
  const v = V.pool({ dims: [1, 2, 3], data: [1, 2, 2, 3, 2, 2] }); // gemiddelde (2,2,2)
  const w = 1 / Math.sqrt(3);
  Array.from(v).forEach((x) => assert.ok(Math.abs(x - w) < 1e-6));
  assert.ok(Math.abs(V.cosinus(v, v) - 1) < 1e-6);
  const nul = V.pool({ dims: [1, 1, 2], data: [0, 0] });
  assert.ok(Array.from(nul).every((x) => x === 0), 'een nulvector deelt niet door nul');
});
