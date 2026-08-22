/* DE VERBINTENIS: aansluiten zonder alles te laten zien.

   Zes beweringen.

   1. DE WORTEL GEEFT NIETS PRIJS. Wat de inspecteur krijgt is een bedrag en een
      vingerafdruk -- geen factuurnummer, geen datum, geen bedrag per regel.
   2. DEZELFDE FEITEN GEVEN DEZELFDE WORTEL, ook in een andere volgorde. Anders
      krijgen twee partijen met dezelfde administratie verschillende wortels en
      betekent een verschil niets meer.
   3. EEN CENT VERSCHIL GEEFT EEN ANDERE WORTEL.
   4. EEN BEWIJS VOOR EEN FEIT VERIFIEERT ZONDER DE REST -- de controle krijgt
      de verzameling niet eens mee.
   5. EEN VERVALST FEIT VERIFIEERT NIET.
   6. EEN ONEVEN VERZAMELING WERKT, en een dubbele laatste regel geeft niet
      dezelfde wortel als een enkele. Dat is de val bij merklebomen die een
      oneven knoop verdubbelen.

   Draai los: node --experimental-sqlite --test test/fiscaal-verbintenis.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakVerbintenis } = require('../server/kern/fiscaal/verbintenis');

const { verbintenis } = maakVerbintenis({ crypto });
const feiten = (n) => Array.from({ length: n }, (_, i) =>
  ({ nummer: 'F-' + (i + 1), datum: '2026-07-' + String(i + 1).padStart(2, '0'), btwCenten: (i + 1) * 100 }));

test('de wortel geeft niets prijs', () => {
  const set = feiten(5);
  const v = verbintenis.leg(set, 1500);
  const tekst = JSON.stringify(v);
  for (const f of set) {
    assert.ok(!tekst.includes(f.nummer), 'het factuurnummer staat niet in de verbintenis');
    assert.ok(!tekst.includes(f.datum), 'de datum ook niet');
  }
  /* Wat er WEL in staat: het totaal en hoeveel het er waren. Dat is precies wat
     een inspecteur nodig heeft om aan te sluiten. */
  assert.equal(v.totaalCenten, 1500);
  assert.equal(v.aantal, 5);
  assert.match(v.wortel, /^[0-9a-f]{64}$/);
});

test('dezelfde feiten geven dezelfde wortel, ook in een andere volgorde', () => {
  const set = feiten(6);
  const omgekeerd = set.slice().reverse();
  assert.equal(verbintenis.leg(set, 0).wortel, verbintenis.leg(omgekeerd, 0).wortel,
    'de volgorde van aanlevering mag niet uitmaken');
});

test('een cent verschil geeft een andere wortel', () => {
  const set = feiten(6);
  const anders = set.map((f, i) => (i === 3 ? Object.assign({}, f, { btwCenten: f.btwCenten + 1 }) : f));
  assert.notEqual(verbintenis.leg(set, 0).wortel, verbintenis.leg(anders, 0).wortel);
});

test('een bewijs voor een feit verifieert zonder de rest', () => {
  const set = feiten(9);
  const v = verbintenis.leg(set, 4500);
  const b = verbintenis.bewijs(set, set[4]);
  assert.ok(b.ok);

  /* DE CONTROLE KRIJGT DE VERZAMELING NIET. Alleen de wortel, dat ene feit en
     het pad -- dat is de hele opzet. */
  const uit = verbintenis.controleer(v.wortel, b.feit, b.pad);
  assert.equal(uit.ok, true);
  assert.match(uit.let, /zat in de verzameling/i);

  // elk feit in de verzameling is te bewijzen
  for (const f of set) {
    const p = verbintenis.bewijs(set, f);
    assert.equal(verbintenis.controleer(v.wortel, f, p.pad).ok, true, f.nummer);
  }
  // en een feit dat er niet in zit, levert geen bewijs op
  assert.equal(verbintenis.bewijs(set, { nummer: 'F-999', datum: '2026-07-01', btwCenten: 1 }).status, 404);
});

test('een vervalst feit verifieert niet', () => {
  const set = feiten(7);
  const v = verbintenis.leg(set, 2800);
  const b = verbintenis.bewijs(set, set[2]);

  const vervalst = Object.assign({}, set[2], { btwCenten: 999999 });
  const uit = verbintenis.controleer(v.wortel, vervalst, b.pad);
  assert.equal(uit.ok, false);
  assert.match(uit.let, /hoort niet bij deze wortel/i);

  // en een verdraaid pad ook niet
  const stukPad = b.pad.map(s => Object.assign({}, s, { hash: s.hash.replace(/^./, '0') }));
  assert.equal(verbintenis.controleer(v.wortel, set[2], stukPad).ok, false);
});

test('een oneven verzameling werkt, en een dubbele laatste regel is niet hetzelfde', () => {
  for (const n of [1, 2, 3, 5, 7, 11]) {
    const set = feiten(n);
    const v = verbintenis.leg(set, 0);
    const b = verbintenis.bewijs(set, set[n - 1]);
    assert.equal(verbintenis.controleer(v.wortel, set[n - 1], b.pad).ok, true, n + ' feiten');
  }

  /* DE VAL: een merkleboom die een oneven knoop VERDUBBELT, geeft voor
     [a, b, c] dezelfde wortel als voor [a, b, c, c]. Dan kun je een regel
     toevoegen zonder dat de wortel verandert. Deze boom schuift de knoop
     ongewijzigd door, en dan kan dat niet. */
  const drie = feiten(3);
  const vier = drie.concat([drie[2]]);
  assert.notEqual(verbintenis.leg(drie, 0).wortel, verbintenis.leg(vier, 0).wortel,
    'een dubbele laatste regel hoort een andere wortel te geven');

  assert.equal(verbintenis.leg([], 0).wortel, null, 'een lege verzameling legt niets vast');
});
