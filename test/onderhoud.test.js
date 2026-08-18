/* DE VEGER MAG DE REM NIET LOSSEN.

   WAT ER MIS WAS, EN TWEE KEER. De onderhoudsronde gooide elke vijf minuten
   alles weg wat op dat moment niets TEGENHIELD. Een emmer die nog aan het
   tellen was ({ n: 3, until: 0 }) hield niets tegen en ging dus ook weg. Daarmee
   was "tien pogingen, dan vijf minuten dicht" in de praktijk "negen pogingen per
   opruimronde", en wie zijn gokken doseerde raakte de grens nooit. Hetzelfde
   gold voor het PIN-slot: vier cijfers, vijf pogingen per ronde, oneindig veel
   rondes.

   WAAROM DEZE TOETS ER PAS NU IS. De reparatie zat in de `setInterval` van
   opzet/start.js. Daar kon niemand bij: een toets zou vijf minuten moeten
   wachten om de veger een keer te zien draaien, en een toets die wacht wordt
   uitgezet. De regel stond er dus wel, en niets controleerde hem -- LAT.md
   regel 2. De ronde is nu een gewone functie met de tijd als parameter
   (opzet/onderhoud.js), en dit is wat hij moet doen.

   De klok hier is nagemaakt. Niet om het sneller te laten lijken maar omdat de
   grenzen die ertoe doen (een kwartier stilte, een slot van vijf minuten) anders
   niet te raken zijn.

   Draai los: node --test test/onderhoud.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { onderhoudsronde, ruimRemmen, STILTE_MS } = require('../server/opzet/onderhoud');
const { maakPinSlot } = require('../server/pinslot');

const NU = 1_700_000_000_000; // een vaste klok; het gaat om de afstanden, niet om de datum
const MIN = 60000;

/* De emmer zoals server.js hem maakt: { n, until, laatst }. */
const emmer = (n, until, laatst) => ({ n, until, laatst });

test('een emmer die nog aan het tellen is, blijft staan -- dit was het gat', () => {
  const fails = new Map([['auth:doel:abc', emmer(3, 0, NU - 1 * MIN)]]);
  const weg = ruimRemmen(fails, NU);
  assert.equal(weg, 0);
  assert.ok(fails.has('auth:doel:abc'),
    'een lopende telling hoort de ronde te overleven; anders begint een aanvaller elke vijf minuten bij nul');
  assert.equal(fails.get('auth:doel:abc').n, 3, 'en de stand blijft staan, hij wordt niet stilletjes op nul gezet');
});

test('een emmer die nu iets tegenhoudt, blijft staan -- ook als hij al een uur stil is', () => {
  /* Zo ziet een slot eruit: noteFailedTry zet n terug op 0 en until vooruit. De
     stilte zegt hier niets, want het slot doet zijn werk juist zonder pogingen. */
  const fails = new Map([['auth:1.2.3.4', emmer(0, NU + 2 * MIN, NU - 60 * MIN)]]);
  ruimRemmen(fails, NU);
  assert.ok(fails.has('auth:1.2.3.4'),
    'een slot dat nog loopt hoort niet weggeveegd te worden, hoe stil het er ook omheen is');
});

test('wat niets tegenhoudt en een kwartier stil is, gaat weg', () => {
  const fails = new Map([
    ['stil', emmer(2, 0, NU - 16 * MIN)],
    ['afgelopen slot', emmer(0, NU - 20 * MIN, NU - 20 * MIN)]
  ]);
  const weg = ruimRemmen(fails, NU);
  assert.equal(weg, 2, 'allebei horen ze weg te zijn; anders groeit het geheugen met elke unieke bezoeker');
  assert.equal(fails.size, 0);
});

test('precies op de grens van het kwartier blijft hij staan', () => {
  /* De veilige kant van de grens. Een emmer een ronde te lang bewaren kost
     geheugen; een emmer een tel te vroeg weggooien lost de rem. */
  const fails = new Map([['grens', emmer(4, 0, NU - STILTE_MS)]]);
  ruimRemmen(fails, NU);
  assert.ok(fails.has('grens'), 'op de grens hoort hij te blijven, niet te verdwijnen');

  const netErover = new Map([['erover', emmer(4, 0, NU - STILTE_MS - 1)]]);
  ruimRemmen(netErover, NU);
  assert.equal(netErover.size, 0, 'en een milliseconde later mag hij wel weg -- anders staat de grens nergens');
});

test('een emmer zonder tijdstempel gaat weg', () => {
  /* Emmers van voor de reparatie hebben geen `laatst`. Die mogen weg: ze houden
     niets tegen en er is niets waarvan we WETEN dat het nog telt. */
  const fails = new Map([['oud', { n: 1, until: 0 }]]);
  ruimRemmen(fails, NU);
  assert.equal(fails.size, 0, 'zonder tijdstempel valt niet te zeggen dat hij vers is, dus hij mag weg');
});

test('het PIN-slot krijgt dezelfde behandeling in dezelfde ronde', () => {
  /* Het PIN-slot heeft zijn eigen opruimen() met dezelfde regel. Dat die in de
     ronde MEEGENOMEN wordt, is het punt hier: drie tellers met dezelfde fout
     hoorden ook een gedeelde veger te hebben. */
  const slot = maakPinSlot();
  slot.fout('staff:AB:1');                       // telt: n = 1
  slot.map.set('staff:OUD:9', { n: 2, tot: 0, sinds: NU - 60 * MIN });
  for (let i = 0; i < slot.MAX_POGINGEN; i++) slot.fout('staff:DICHT:2'); // op slot

  onderhoudsronde({ pinSlot: slot });

  assert.ok(slot.map.has('staff:AB:1'), 'een pin die net verkeerd is ingetikt, telt nog');
  assert.ok(slot.dicht('staff:DICHT:2'), 'en een pin die dicht staat, blijft dicht na de ronde');
  assert.equal(slot.map.has('staff:OUD:9'), false, 'wat al een uur stilligt mag weg');
});

test('de ronde doet alle drie de vegers, en zegt wat hij deed', () => {
  const fails = new Map([['weg', emmer(1, 0, NU - 30 * MIN)], ['blijft', emmer(1, 0, NU)]]);
  const slot = maakPinSlot();
  let buffers = 0;
  const uit = onderhoudsronde({ loginFails: fails, pinSlot: slot, ruimBuffer: () => { buffers += 1; }, nu: NU });
  assert.equal(uit.remmen, 1, 'de ronde meldt hoeveel emmers er weg zijn -- anders is een stille veger niet van een kapotte te onderscheiden');
  assert.equal(buffers, 1, 'de SSE-buffer hoort in dezelfde ronde mee te gaan');
  assert.deepEqual([...fails.keys()], ['blijft']);
});

test('de ronde valt niet om als een van de drie er niet is', () => {
  /* start.js geeft ze alle drie mee, maar een toets die er een wil bekijken
     hoeft de andere twee niet op te tuigen -- en dat mag hem niet laten klappen. */
  assert.doesNotThrow(() => onderhoudsronde());
  assert.doesNotThrow(() => onderhoudsronde({ loginFails: new Map() }));
  assert.doesNotThrow(() => onderhoudsronde({ pinSlot: {} }));
});
