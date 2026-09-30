/* DE REKENING ACHTER DE OVERGANGSVORM: kan hij uitslaan?

   VERDER.md par. 2 rust op de uitkomst van scripts/overgangsvorm.js, en die
   rekent met scripts/lib/overgangsrekening.js. Een meter die "geen
   universele overgang" zegt, is alleen iets waard als dezelfde rekening met
   andere invoer ook UNIVERSEEL of FAMILIES kan zeggen. Deze toetsen voeren
   hem daarom met verzonnen overgangen waarvan de uitkomst vooraf vaststaat --
   in beide richtingen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../scripts/lib/overgangsrekening');

const D = ['van', 'naar', 'bewijs', 'bevoegdheid', 'kennis'];
const o = (id, standen) => ({ id, dimensies: Object.fromEntries(D.map((d, i) => [d, { stand: standen[i] }])) });
// p = poort, d = draagt, a = afwezig
const S = { p: 'poort', d: 'draagt', a: 'afwezig' };
const maak = (id, code) => o(id, [...code].map(c => S[c]));

test('1. zonder dilemma is de uitkomst UNIVERSEEL, met precies de dimensies die overal staan', () => {
  const lijst = [maak('x', 'ddpda'), maak('y', 'ddpda'), maak('z', 'dddda')];
  const u = R.oordeel(lijst, D, { een: ['x', 'y', 'z'] }, 0.6);
  assert.equal(u.uitkomst, 'UNIVERSEEL');
  assert.deepEqual(u.kern, ['van', 'naar', 'bewijs', 'bevoegdheid']);
  assert.deepEqual(u.dilemmas, []);
});

test('2. een poort hier en een gat daar is een dilemma, en dat breekt de universele vorm', () => {
  const lijst = [maak('x', 'ddpda'), maak('y', 'ddada')];
  const u = R.oordeel(lijst, D, {}, 0.6);
  assert.equal(u.uitkomst, 'GEEN');
  assert.deepEqual(u.dilemmas.map(x => x.dimensie), ['bewijs']);
  assert.deepEqual(u.dilemmas[0].poortIn, ['x']);
  assert.deepEqual(u.dilemmas[0].afwezigIn, ['y']);
});

test('3. de mutatieproef noemt de overgang die ten onrechte slaagt, en die die moet verzinnen', () => {
  const lijst = [maak('x', 'ddpda'), maak('y', 'ddada')];
  const m = R.mutatieproef(lijst, D, ['van', 'naar', 'bewijs']);
  const bewijs = m.find(r => r.dimensie === 'bewijs');
  assert.deepEqual(bewijs.zonderDimensieSlaagtTenOnrechte, ['x']);
  assert.deepEqual(bewijs.metDimensieVerzonnen, ['y']);
  // bevoegdheid zit niet in de vorm: niemand hoeft hem te verzinnen, niemand weigert erop
  const bev = m.find(r => r.dimensie === 'bevoegdheid');
  assert.equal(bev.inVorm, false);
  assert.deepEqual(bev.zonderDimensieSlaagtTenOnrechte, []);
});

test('4. families die intern dilemmavrij zijn en onderling verschillen: FAMILIES', () => {
  const lijst = [
    maak('t1', 'ddpaa'), maak('t2', 'ddpaa'),   // toestand: bewijs is een poort
    maak('k1', 'ddaap'), maak('k2', 'ddaap')    // kennis: kennis is een poort
  ];
  const u = R.oordeel(lijst, D, { toestand: ['t1', 't2'], kennis: ['k1', 'k2'] }, 0.6);
  assert.equal(u.uitkomst, 'FAMILIES');
  for (const h of u.families.hypothese) {
    assert.deepEqual(h.dilemmas, []);
    assert.equal(h.houdtStand, true);
  }
  // en de afgeleide indeling vindt dezelfde twee groepen zonder de hypothese te kennen
  assert.equal(u.families.afgeleid.groepen.length, 2);
  assert.ok(u.families.samenvallen.every(s => s.zuiver));
});

test('5. een verkeerde hypothese wordt verworpen, ook als de data wel families heeft', () => {
  const lijst = [maak('t1', 'ddpaa'), maak('t2', 'ddpaa'), maak('k1', 'ddaap'), maak('k2', 'ddaap')];
  // door elkaar ingedeeld: elke familie heeft nu een dilemma
  const u = R.oordeel(lijst, D, { a: ['t1', 'k1'], b: ['t2', 'k2'] }, 0.6);
  assert.notEqual(u.uitkomst, 'FAMILIES');
  assert.ok(u.families.hypothese.every(h => h.dilemmas.length > 0 && h.houdtStand === false));
  assert.ok(u.families.samenvallen.every(s => !s.zuiver));
});

test('6. een familie met een lid is niet te toetsen en draagt de uitkomst niet', () => {
  const lijst = [maak('t1', 'ddpaa'), maak('k1', 'ddaap')];
  const u = R.oordeel(lijst, D, { toestand: ['t1'], kennis: ['k1'] }, 0.6);
  assert.ok(u.families.hypothese.every(h => h.houdtStand === null));
  assert.equal(u.uitkomst, 'GEEN');
});

test('7. een overgang zonder drager telt niet mee in de noemer', () => {
  const lijst = [maak('x', 'ddpda')];
  assert.deepEqual(R.kernVan(lijst, D), ['van', 'naar', 'bewijs', 'bevoegdheid']);
  assert.deepEqual(R.kernVan([], D), []);
});

test('8. twee families zonder dilemma die niet van elkaar te onderscheiden zijn, zijn een indeling en geen families', () => {
  /* Bij het bouwen gevonden met een mutatie: zet `houdtStand` altijd op waar en
     toetsen 1 tot en met 7 bleven groen, want daar viel de uitkomst al op een
     dilemma. Deze toets heeft er geen, dus alleen de gelijkenis kan hem laten
     zakken. */
  const lijst = [maak('t1', 'ddpaa'), maak('t2', 'ddpaa'), maak('k1', 'ddpaa'), maak('k2', 'ddpaa')];
  const u = R.oordeel(lijst, D, { a: ['t1', 't2'], b: ['k1', 'k2'] }, 0.6);
  assert.ok(u.families.hypothese.every(h => h.dilemmas.length === 0));
  assert.ok(u.families.hypothese.every(h => h.houdtStand === false));
  /* zonder dilemma over het geheel is dit natuurlijk UNIVERSEEL -- en dat is
     precies het punt: de families voegen niets toe */
  assert.equal(u.uitkomst, 'UNIVERSEEL');
});

test('9. de hypothese houdt niet, maar de data vindt zelf families die wel houden: ANDERE_FAMILIES', () => {
  const lijst = [maak('t1', 'ddpaa'), maak('t2', 'ddpaa'), maak('k1', 'ddaap'), maak('k2', 'ddaap')];
  // verkeerd ingedeeld, maar de afgeleide groepen zijn {t1,t2} en {k1,k2}
  const u = R.oordeel(lijst, D, { a: ['t1', 'k1'], b: ['t2', 'k2'] }, 0.6);
  assert.equal(u.uitkomst, 'ANDERE_FAMILIES');
  assert.ok(u.families.afgeleid.groepen.every(g => g.dilemmas.length === 0));
});

test('10. onderscheiden is niet hetzelfde als dilemmavrij', () => {
  // twee families die elkaar niet lijken, maar binnen elk een dilemma
  const lijst = [maak('t1', 'ddpaa'), maak('t2', 'ddaaa'), maak('k1', 'ddaap'), maak('k2', 'ddaad')];
  const u = R.oordeel(lijst, D, { toestand: ['t1', 't2'], kennis: ['k1', 'k2'] }, 0.9);
  const t = u.families.hypothese.find(h => h.familie === 'toestand');
  assert.equal(t.dilemmavrij, false);
  assert.equal(t.houdtStand, false);
});

test('11. afgeleide groepen met een dilemma zijn geen andere families: dan blijft het GEEN', () => {
  /* Gevonden met een mutatie: laat ANDERE_FAMILIES de dilemma's negeren en
     toetsen 1 tot en met 10 bleven groen. Hier vormt de data twee groepen,
     en een ervan draagt een poort die een lid niet kent. */
  const lijst = [maak('t1', 'ddpaa'), maak('t2', 'ddaaa'), maak('k1', 'ddaap'), maak('k2', 'ddaad')];
  const u = R.oordeel(lijst, D, { a: ['t1', 'k1'], b: ['t2', 'k2'] }, 0.6);
  const meer = u.families.afgeleid.groepen.filter(g => g.leden.length > 1);
  assert.equal(meer.length, 2);
  assert.ok(meer.some(g => g.dilemmas.includes('bewijs')));
  assert.equal(u.uitkomst, 'GEEN');
});
