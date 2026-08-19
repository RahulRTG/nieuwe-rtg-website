/* ============================================================================
   DE REM PER AANROEPER.

   De meter ernaast (./ai-meter.test.js) draait de kraan dicht op een DAGbedrag.
   Dat is een terugblik: hij grijpt in als het geld al op is. Deze rem stopt
   iemand die er in een MINUUT doorheen gaat -- de generieke deurrem laat 300
   verzoeken per minuut per IP toe, en die ziet geen verschil tussen een
   endpoint van een tiende cent en een Opus-aanroep van $0,0136.

   Drie dingen moeten kloppen:

     1. HIJ TELT MODELAANROEPEN EN GEEN ROUTES, zodat route nummer 101 er
        automatisch onder valt zonder dat iemand een lijst bijwerkt.
     2. GEEN CONTEXT IS GEEN REM. Achtergrondwerk, een script en de opstart
        komen niet van buiten en horen niet stil te vallen doordat een bezoeker
        druk was.
     3. OP NUL STAAT HIJ UIT, en dan ook echt helemaal.

   Draai los: node --test test/ai-rem.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const rem = require('../server/ai-rem');
const ctx = require('../server/ai-context');

const schoon = () => { delete process.env.RTG_AI_BEURTEN_PER_MINUUT; rem.nulstel(); };

test('1. de rem telt modelaanroepen per aanroeper, niet routes', () => {
  schoon();
  process.env.RTG_AI_BEURTEN_PER_MINUUT = '3';
  const t = Date.parse('2026-08-19T10:00:00Z');
  assert.equal(rem.magNogVoor('1.2.3.4', t), true);
  assert.equal(rem.magNogVoor('1.2.3.4', t), true);
  assert.equal(rem.magNogVoor('1.2.3.4', t), true);
  assert.equal(rem.magNogVoor('1.2.3.4', t), false, 'de vierde valt buiten');
  // een ANDERE aanroeper heeft zijn eigen bak
  assert.equal(rem.magNogVoor('5.6.7.8', t), true, 'de buurman wordt niet meegeremd');
  // en een minuut later mag het weer
  assert.equal(rem.magNogVoor('1.2.3.4', t + 61000), true, 'nieuw venster');
  schoon();
});

test('2. zonder context geen rem -- achtergrondwerk hoort niet stil te vallen', () => {
  schoon();
  process.env.RTG_AI_BEURTEN_PER_MINUUT = '1';
  // buiten een context: rem.wie() is null, dus de rem laat door
  assert.equal(rem.wie(), null);
  for (let i = 0; i < 20; i++) assert.equal(rem.magNogVoor(), true);
  // binnen een context telt hij wel
  ctx.inContext('9.9.9.9', () => {
    assert.equal(rem.wie(), '9.9.9.9');
    assert.equal(rem.magNogVoor(), true);
    assert.equal(rem.magNogVoor(), false, 'binnen de context remt hij wel');
  });
  schoon();
});

test('3. op nul staat de rem uit', () => {
  schoon();
  process.env.RTG_AI_BEURTEN_PER_MINUUT = '0';
  assert.equal(rem.beurtGrens(), 0);
  for (let i = 0; i < 200; i++) assert.equal(rem.magNogVoor('1.2.3.4'), true);
  schoon();
});

