/* DE VERSMALLING ALS MACHINEWET -- kan deze doorsnede ooit iets TOEVOEGEN?

   REPRESENTATIE.md REP-03 zegt: een gedelegeerde bevoegdheid kan nooit groter
   zijn dan de effectieve bevoegdheid van de gever. Dat is een bewering over
   ALLE mogelijke invoer, niet over de drie gevallen die iemand toevallig
   opschrijft -- dus staat er hieronder een gegenereerde proef naast de gerichte
   toetsen. Vijfhonderd willekeurige combinaties die alle vier de bronnen laten
   variëren, en elke uitkomst gaat door `overtreding()`.

   DE WET WORDT NIET NAGEBOUWD IN DE TOETS, en dat is met opzet. `overtreding()`
   woont in de bron en wordt hier AANGEROEPEN; zou de toets zijn eigen
   doorsnede uitrekenen en die vergelijken, dan toetst hij twee implementaties
   van dezelfde gedachte tegen elkaar en zakt hij pas als ze allebei anders
   kapot gaan. Nu is er één wet, en de toets vraagt of de uitvoering hem houdt.

   TOETS 5 IS DE BESTURINGSPROEF. Een doorsnede die ALTIJD leeg teruggeeft
   haalt elke toets hierboven -- leeg bevat immers nooit iets ongeldigs. Er moet
   dus aantoonbaar iets doorkomen, anders meet deze hele suite niets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../server/kern/namens/versmalling');

test('1. de doorsnede houdt alleen wat in ALLE vier de bronnen zit', () => {
  const invoer = { gevraagd: ['a', 'b', 'c', 'd'], geverEffectief: ['a', 'b', 'c'],
    beleid: ['a', 'b', 'd'], context: ['a', 'c', 'd'] };
  const r = V.doorsnede(invoer);
  assert.deepEqual(r.effectief, ['a'], 'alleen `a` zit in alle vier');
  assert.equal(V.overtreding(r, invoer), null);
});

test('2. elke geweigerde sleutel draagt de bron die hem tegenhield', () => {
  const r = V.doorsnede({ gevraagd: ['a', 'b'], geverEffectief: ['a'], beleid: ['a', 'b'], context: ['a', 'b'] });
  const b = r.geweigerd.find(g => g.sleutel === 'b');
  assert.equal(b.bron, 'geverEffectief');
  assert.match(b.reden, /gever mag dit zelf niet/,
    'de reden noemt de gever; "het viel af" zonder waarom is voor de lezer onbruikbaar');
});

test('3. leeg is dicht, en ONBEKEND is iets anders dan LEEG', () => {
  /* Allebei leveren ze niets op -- bij twijfel gebeurt er niets -- maar alleen
     de tweede is een gebrek dat gerepareerd hoort te worden. Een laag die ze
     samenvoegt kan een kapotte bron nooit onderscheiden van een dichte deur. */
  const ontbreekt = V.doorsnede({ gevraagd: ['a'] });
  assert.deepEqual(ontbreekt.effectief, [], 'een ontbrekende bron telt als leeg en niet als alles');
  assert.deepEqual(ontbreekt.onbekendeBronnen, ['geverEffectief', 'beleid', 'context']);
  assert.match(ontbreekt.let, /niet opgegeven/, 'en de uitslag zegt het hardop');

  const gemeten = V.doorsnede({ gevraagd: ['a'], geverEffectief: [], beleid: [], context: [] });
  assert.deepEqual(gemeten.effectief, []);
  assert.deepEqual(gemeten.onbekendeBronnen, [], 'een LEGE lijst is gemeten en dus bekend');
  assert.equal(gemeten.let, null);
});

test('4. DE MACHINEWET: over 500 willekeurige invoeren voegt de doorsnede nooit iets toe', () => {
  const alfabet = 'abcdefgh'.split('');
  /* Vaste zaadwaarde: een proef die per ronde andere invoer neemt, laat een
     gevonden overtreding niet reproduceren. */
  let zaad = 20260914;
  const rnd = () => (zaad = (zaad * 1103515245 + 12345) % 2147483648) / 2147483648;
  const trek = () => alfabet.filter(() => rnd() < 0.5);

  for (let i = 0; i < 500; i++) {
    const invoer = { gevraagd: trek(), geverEffectief: trek(), beleid: trek(), context: trek() };
    /* Eén van de vier af en toe helemaal weglaten, want `undefined` is precies
       de invoer waarop een doorsnede stilletjes "alles" kan gaan betekenen. */
    if (rnd() < 0.15) delete invoer[V.SLEUTELS[Math.floor(rnd() * 4)]];
    const r = V.doorsnede(invoer);
    const fout = V.overtreding(r, invoer);
    assert.equal(fout, null, 'ronde ' + i + ': ' + JSON.stringify(invoer) + ' -> ' +
      JSON.stringify(r.effectief) + (fout ? ' :: ' + fout.reden : ''));
    assert.ok(r.effectief.length <= (invoer.gevraagd || []).length,
      'de uitkomst is nooit groter dan wat er gevraagd is');
  }
});

test('5. besturingsproef: er komt aantoonbaar iets DOOR', () => {
  /* Zonder deze toets haalt een doorsnede die altijd leeg teruggeeft de vier
     hierboven met gemak: leeg bevat nooit iets ongeldigs. */
  const r = V.doorsnede({ gevraagd: ['a', 'b'], geverEffectief: ['a', 'b'], beleid: ['a', 'b'], context: ['a', 'b'] });
  assert.deepEqual(r.effectief, ['a', 'b'], 'wat in alle vier zit, komt er ook uit');
});

test('6. `overtreding` VINDT een toegevoegde sleutel -- anders bewijst toets 4 niets', () => {
  /* De wet is alleen iets waard als hij kan uitslaan. Hier wordt met de hand
     een uitkomst verzonnen die iets bevat dat de gever niet mag, en die MOET
     worden aangewezen. */
  const invoer = { gevraagd: ['a'], geverEffectief: ['a'], beleid: ['a'], context: ['a'] };
  const vals = { effectief: ['a', 'stiekem'] };
  const fout = V.overtreding(vals, invoer);
  assert.ok(fout, 'een toegevoegde sleutel wordt gevonden');
  assert.equal(fout.sleutel, 'stiekem');
  assert.match(fout.reden, /privilege-amplification/);
});

test('7. een bron van het verkeerde type is STUK en niet leeg', () => {
  /* Een typefout in een aanroeper mag niet lezen als "deze gever mag niets":
     dat zou een fout omzetten in een stille, plausibele weigering. */
  const r = V.doorsnede({ gevraagd: ['a'], geverEffectief: 'a', beleid: ['a'], context: ['a'] });
  assert.deepEqual(r.stukkeBronnen, ['geverEffectief']);
  assert.deepEqual(r.effectief, [], 'en er komt niets door, want bij twijfel gebeurt er niets');
});

test('8. mag(): één sleutel, altijd een reden -- ook bij ja', () => {
  const basis = { geverEffectief: ['a'], beleid: ['a'], context: ['a'] };
  const ja = V.mag('a', basis);
  assert.equal(ja.mag, true);
  assert.ok(ja.reden.length > 20, '"waarom mag dit wel" is bij een machtiging een redelijke vraag');

  const nee = V.mag('b', basis);
  assert.equal(nee.mag, false);
  assert.equal(nee.bron, 'geverEffectief');
});
