/* DE HERKOMSTPOORT PER WERELD -- een schakelaar die per wereld te betalen is.

   WAAROM DIT EEN EIGEN TOETS HEEFT. `RTG_HERKOMST_AFDWINGEN=1` zette de poort
   voor lid, zaak en personeel tegelijk aan, en de prijs verschilt per wereld
   (ISOLATIEPROEF.json: een lid houdt 36 van 120 paden over, een zaak 9 van 53).
   CONTROLPLANE.md schrijft schaduw -> beperkt -> wereld voor wereld voor, en met
   een enkele boolean kan die middelste stap niet bestaan.

   DE DRIE DINGEN DIE HIER FOUT KUNNEN GAAN, en alle drie zijn ze stil:
     1. een tikfout in de omgeving zet een beveiliging uit zonder een woord;
     2. een onbekende wereld glipt langs een poort die hem niet herkent;
     3. `1` blijft niet werken en een bestaande omgeving valt stilletjes open.

   MUTATIES die zijn gedraaid en welke toets erop zakte:
   - de keuring van onbekende namen weglaten -> toets 2 ZAKT.
   - een onbekende wereld `false` laten teruggeven -> toets 3 ZAKT.
   - `1` niet meer als "alle" lezen -> toets 1 ZAKT. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const afdwingenVoor = require('../server/kern/stuur/herkomstschakelaar');

const zet = (waarde) => {
  if (waarde === null) delete process.env.RTG_HERKOMST_AFDWINGEN;
  else process.env.RTG_HERKOMST_AFDWINGEN = waarde;
  afdwingenVoor.vergeet();
};

test.afterEach(() => zet(null));

test('1. leeg is uit, en `1` blijft alle werelden aanzetten', () => {
  zet(null);
  for (const w of ['member', 'supplier', 'staff']) assert.equal(afdwingenVoor(w), false, w);

  /* ACHTERWAARTS COMPATIBEL, en dat is geen nettigheid: een draaiende omgeving
     met `=1` mag door deze wijziging niet stilletjes opengaan. */
  zet('1');
  for (const w of ['member', 'supplier', 'staff']) assert.equal(afdwingenVoor(w), true, w);
  zet('alle');
  assert.equal(afdwingenVoor('member'), true);
});

test('2. een tikfout gooit, en zet de beveiliging niet stil uit', () => {
  zet('leden');
  assert.throws(() => afdwingenVoor('member'), /onbekende wereld/i,
    'een onbekende wereldnaam hoort te gooien; een stille `false` is een beveiliging die uit staat ' +
    'terwijl de operator denkt van niet');
  zet('member,zaak');
  assert.throws(() => afdwingenVoor('member'), /zaak/);
});

test('3. per wereld, en een onbekende wereld valt DICHT', () => {
  zet('member');
  assert.equal(afdwingenVoor('member'), true);
  assert.equal(afdwingenVoor('supplier'), false, 'wat niet genoemd is, wordt niet afgedwongen');
  assert.equal(afdwingenVoor('staff'), false);

  /* SEC-LOCK-004 in het klein: "we weten niet welke wereld dit is" is bij
     onvertrouwde invoer geen grond om door te laten. */
  assert.equal(afdwingenVoor(''), true, 'een lege wereld hoort dicht te vallen');
  assert.equal(afdwingenVoor('verzonnen'), true, 'een onbekende wereld hoort dicht te vallen');

  /* Maar alleen als er iets AAN staat: met alles uit blijft alles uit, ook voor
     een onbekende wereld -- anders zou de poort bijten zonder dat iemand hem
     heeft aangezet. */
  zet(null);
  assert.equal(afdwingenVoor('verzonnen'), false);
});

test('4. hoofdletters en spaties zijn geen andere wereld', () => {
  zet(' Member , SUPPLIER ');
  assert.equal(afdwingenVoor('member'), true);
  assert.equal(afdwingenVoor('supplier'), true);
  assert.equal(afdwingenVoor('staff'), false);
});
