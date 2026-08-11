/* DE ZES GETALLEN VAN DE VERRAADRONDE (scripts/lib/verraadtelling.js).

   WAAROM DEZE APART GETOETST WORDEN. De ronde zelf start vier servers en duurt
   minuten; daar komt nooit een mutatie bij. Maar een verkeerde telling maakt van
   een blinde ronde een groene, en dat is precies de fout waar deze hele motor
   tegen is gebouwd. Dus staan de regels los, en staan ze hier onder een toets.

   Draai los: node --test test/verraadtelling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { telSamen, isSchending, zakt } = require('../scripts/lib/verraadtelling');

const ronde = (o) => ({ toegediend: true, waargenomen: false, gezien: [], herhaalbaar: true, ...o });

test('een ronde waarin alles werd gezien, heeft nul blinde injecties', () => {
  const t = telSamen([
    ronde({ waargenomen: true, gezien: ['terugNaHerstart: true -> false'] }),
    ronde({ waargenomen: true, gezien: ['schrijfStatus: 200 -> 500'] })
  ], 2);
  assert.equal(t.toegediend, 2);
  assert.equal(t.waargenomen, 2);
  assert.equal(t.blindeInjecties, 0);
});

test('BLIND: toegediend maar niets zag het -- en dat is het getal dat telt', () => {
  /* Hier is niets geleerd. Zonder dit getal leest deze ronde als "het systeem
     is er niet door van slag geraakt", terwijl er niemand keek. */
  const t = telSamen([ronde({ waargenomen: false, gezien: [] })], 1);
  assert.equal(t.toegediend, 1);
  assert.equal(t.waargenomen, 0);
  assert.equal(t.blindeInjecties, 1);
});

test('blinde injecties zijn precies toegediend min waargenomen', () => {
  const t = telSamen([
    ronde({ waargenomen: true, gezien: ['iets'] }),
    ronde({ waargenomen: false }),
    ronde({ waargenomen: false })
  ], 3);
  assert.equal(t.blindeInjecties, t.toegediend - t.waargenomen);
  assert.equal(t.blindeInjecties, 2);
});

test('een verraad dat niet is toegediend, telt nergens in mee', () => {
  /* Anders zou een verraad dat nooit aan de beurt kwam als blinde injectie
     tellen, en dan staat de poort rood om iets wat niet is geprobeerd. */
  const t = telSamen([ronde({ toegediend: false }), ronde({ waargenomen: true, gezien: ['x'] })], 2);
  assert.equal(t.toegediend, 1);
  assert.equal(t.blindeInjecties, 0);
});

test('verklaard komt van buiten en niet uit de rondes', () => {
  /* Verklaard is hoeveel er AANSTONDEN; dat kan hoger zijn dan wat er is
     gedraaid, en juist dat verschil hoort zichtbaar te blijven. */
  const t = telSamen([ronde({ waargenomen: true, gezien: ['x'] })], 5);
  assert.equal(t.verklaard, 5);
  assert.equal(t.toegediend, 1);
});

/* ---------- schending versus verschil ---------- */

test('een bevestigde schrijfactie die na herstart weg is, is een SCHENDING', () => {
  assert.equal(isSchending(['terugNaHerstart: true -> false']), true);
});

test('een schrijfactie die zelf al faalde, is geen schending maar een nette fout', () => {
  /* Het systeem zei "nee" en hield zich eraan. Dat is gedrag, geen gebroken
     belofte -- en die twee door elkaar halen levert paniek over nette fouten. */
  assert.equal(isSchending(['schrijfStatus: 200 -> 500', 'terugNaHerstart: true -> false']), false);
  assert.equal(isSchending(['schrijfStatus: 200 -> null', 'terugNaHerstart: true -> null']), false);
});

test('een verschil zonder verlies is geen schending', () => {
  assert.equal(isSchending(['inlogNaHerstart: true -> false']), false);
  assert.equal(isSchending([]), false);
});

test('schendingen worden apart geteld van waarnemingen', () => {
  const t = telSamen([
    ronde({ waargenomen: true, gezien: ['terugNaHerstart: true -> false'] }),
    ronde({ waargenomen: true, gezien: ['schrijfStatus: 200 -> null'] })
  ], 2);
  assert.equal(t.waargenomen, 2);
  assert.equal(t.invariantschendingen, 1, 'alleen de eerste brak een belofte');
});

/* ---------- waar de ronde op zakt ---------- */

test('de ronde ZAKT op blindheid', () => {
  assert.equal(zakt(telSamen([ronde({ waargenomen: false })], 1)), true);
});

test('de ronde ZAKT op onherhaalbaarheid', () => {
  const t = telSamen([ronde({ waargenomen: true, gezien: ['x'], herhaalbaar: false })], 1);
  assert.equal(t.onherhaalbareRondes, 1);
  assert.equal(zakt(t), true);
});

test('de ronde zakt NIET op een bevinding -- die is winst', () => {
  /* Zou een bevinding de poort rood maken, dan is de beloning voor goed zoeken
     een rode CI, en dan zoekt niemand meer. */
  const t = telSamen([ronde({ waargenomen: true, gezien: ['terugNaHerstart: true -> false'] })], 1);
  assert.equal(t.invariantschendingen, 1);
  assert.equal(zakt(t), false);
});

test('een ronde zonder enige injectie zakt niet, maar bewijst ook niets', () => {
  const t = telSamen([], 0);
  assert.equal(zakt(t), false);
  assert.equal(t.toegediend, 0);
  assert.equal(t.waargenomen, 0);
});
