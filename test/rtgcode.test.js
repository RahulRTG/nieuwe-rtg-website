/* RTG scan-codes (public/shared/rtgcode.js): het vaste formaat achter de QR's.
   We toetsen dat bouwen + lezen elkaars omgekeerde zijn, dat tafelnamen met
   dubbele punt en spatie heel terugkomen, en dat vreemde tekst netjes als
   'tekst' geldt (zodat een Zegel-token niet als code wordt aangezien).
   Draai los: node --test test/rtgcode.test.js */
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

/* De contactpin (server/kern/sociaal/pin.js) reist als 'rtg:pin:<pin>'. Het
   scherm toont hem met een streepje ertussen; de code draagt hem zonder, want
   korter scant prettiger. Allebei komen ze op dezelfde pin uit. */
test('3. contactpin: het streepje van het scherm hoort niet in de code', () => {
  assert.equal(C.bouwPin('7K2M9-XPQH3'), 'rtg:pin:7K2M9XPQH3', 'v2 met tien tekens');
  assert.deepEqual(C.lees(C.bouwPin('7K2M9-XPQH3')), { soort: 'pin', pin: '7K2M9XPQH3' });
  assert.equal(C.bouwPin('7K2M-9XPQ'), 'rtg:pin:7K2M9XPQ');
  assert.equal(C.bouwPin('7k2m9xpq'), 'rtg:pin:7K2M9XPQ', 'kleine letters mogen');
  assert.deepEqual(C.lees(C.bouwPin('7K2M-9XPQ')), { soort: 'pin', pin: '7K2M9XPQ' });
  // en een pin-QR is geen kas-QR: de twee voorvoegsels zijn even lang
  assert.equal(C.lees('rtg:kas:7K2M9XPQ').soort, 'kas');
});

test('4. gewone tekst (Zegel-token) blijft tekst, met trim', () => {
  const token = 'v1.eyJhIjoxfQ.zzz-_AAA';
  assert.deepEqual(C.lees('  ' + token + '  '), { soort: 'tekst', tekst: token });
  assert.equal(C.lees('').soort, 'tekst');
});

test('een ondertekende code is hoofdlettergevoelig, een getypte code niet', () => {
  /* DE FOUT DIE DEZE REGEL TEGENHOUDT stond bij de kassa: het scanscherm zette
     alles in kapitalen (prettig voor een code van zes tekens), en maakte daarmee
     elke RTG1-code stuk -- base64url is hoofdlettergevoelig, dus de handtekening
     klopte ineens niet meer. Het loket zei "geen geldige code" over een code die
     prima was, en niemand kon zien waarom. */
  assert.equal(C.hoofdlettersMogen('a1b2c3'), true, 'een getypte kassacode mag in kapitalen');
  assert.equal(C.hoofdlettersMogen('rtg:pin:7k2m9xpq'), true, 'een pin normaliseert de server toch');
  assert.equal(C.hoofdlettersMogen('RTG1.Y2FwfFZlUk9n.aBcDeF'), false, 'een ondertekende code niet');
  assert.equal(C.lees('RTG1.Y2FwfFZlUk9n.aBcDeF').token, 'RTG1.Y2FwfFZlUk9n.aBcDeF',
    'en hij komt er ongeschonden uit');
});
