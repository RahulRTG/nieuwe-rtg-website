/* RTG scan-codes (public/shared/rtgcode.js): het vaste formaat achter de QR's.
   We toetsen dat bouwen + lezen elkaars omgekeerde zijn, dat tafelnamen met
   dubbele punt en spatie heel terugkomen, en dat vreemde tekst netjes als
   'tekst' geldt (zodat een Zegel-token niet als code wordt aangezien).
   Draai los: node --experimental-sqlite --test test/rtgcode.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/shared/rtgcode');

test('1. tafel: bouwen en lezen is heen-en-terug, ook met dubbele punt/spatie', () => {
  for (const [code, tafel] of [['RITZ', '12'], ['CAFE', 'Terras 3'], ['BAR', 'Hoek: links'], ['X', '']]) {
    const p = C.bouwTafel(code, tafel);
    const r = C.lees(p);
    assert.equal(r.soort, 'tafel');
    assert.equal(r.code, code, 'code heel');
    assert.equal(r.tafel, tafel, 'tafel heel (' + tafel + ')');
  }
});

test('2. kas en entree', () => {
  assert.deepEqual(C.lees(C.bouwKas('AB7Q9')), { soort: 'kas', code: 'AB7Q9' });
  assert.deepEqual(C.lees(C.bouwEntree('CLUB1')), { soort: 'entree', code: 'CLUB1' });
});

test('3. gewone tekst (Zegel-token) blijft tekst, met trim', () => {
  const token = 'v1.eyJhIjoxfQ.zzz-_AAA';
  assert.deepEqual(C.lees('  ' + token + '  '), { soort: 'tekst', tekst: token });
  assert.equal(C.lees('').soort, 'tekst');
});
