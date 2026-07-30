/* De verwijzing-schuiver van het rekenblad (shared/rekenschuif.js): het
   stuk dat kopiëren, plakken en doorvoeren EERLIJK maakt. Wie =B2*C2 een
   rij lager plakt bedoelt =B3*C3; een dollarteken zet vast; en wat van het
   blad af zou schuiven wordt een ZICHTBARE fout, geen stille klem op een
   andere cel. Draai los: node --test test/rekenschuif.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/shared/rekenschuif.js');

test('relatief schuift mee; dollartekens zetten vast', () => {
  assert.equal(S.verschuif('=B2*C2', 1, 0), '=B3*C3');
  assert.equal(S.verschuif('=B2*C2', 0, 2), '=D2*E2');
  assert.equal(S.verschuif('=$B$2+B$2+$B2', 5, 3), '=$B$2+E$2+$B7');
  assert.equal(S.verschuif('=SOM(A1:A9)', 1, 1), '=SOM(B2:B10)');
  assert.equal(S.verschuif('=ALS(A1>0;B1;C1)', 2, 0), '=ALS(A3>0;B3;C3)');
});

test('tekst en functienamen blijven met rust', () => {
  assert.equal(S.verschuif('="A1 blijft"&B1', 1, 0), '="A1 blijft"&B2');
  assert.equal(S.verschuif('=LOG10(A1)', 1, 0), '=LOG10(A2)');
  assert.equal(S.verschuif('gewone tekst A1', 3, 3), 'gewone tekst A1',
    'zonder = is het geen formule en schuift er niets');
  assert.equal(S.verschuif('=A1', 0, 0), '=A1', 'niet schuiven is niet aanraken');
});

test('van het blad af is zichtbaar kapot, geen stille klem', () => {
  assert.equal(S.verschuif('=A1+B2', -1, 0), '#VERW!');
  assert.equal(S.verschuif('=A1', 0, -1), '#VERW!');
  // en een vastgezette verwijzing kan niet van het blad af schuiven
  assert.equal(S.verschuif('=$A$1', -5, -5), '=$A$1');
});

test('kolommen voorbij Z schuiven gewoon door', () => {
  assert.equal(S.verschuif('=Z1', 0, 1), '=AA1');
  assert.equal(S.verschuif('=AA10', 0, -1), '=Z10');
});
