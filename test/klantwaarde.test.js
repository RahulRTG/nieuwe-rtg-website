/* KLANTWAARDE PER WERELD -- server/kern/bedrijfsmaat/klantwaarde.js (besluit C3).

   Vier maten naast elkaar. Wat hier vastligt:
   1. elke wereld telt alleen haar eigen geslaagde uitkomst, in de juiste maand;
   2. `n` is de groep waar de poort naar kijkt -- mensen, zaken of casussen, en
      nooit het aantal uitkomsten;
   3. er is GEEN functie die de vier optelt (INT-04);
   4. elke maat in de catalogus draagt een andere wereld waar dat hoort (C1).

   Draai: node --test test/klantwaarde.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../server/kern/bedrijfsmaat/klantwaarde');
const M = '2026-09';

test('1 en 2. LivingOS: ritten en bestellingen, en de groep is het aantal leden', () => {
  const r = K.living([
    { status: 'afgerond', customerCodename: 'A', finishedAt: '2026-09-02T09:00:00Z' },
    { status: 'afgerond', customerCodename: 'A', finishedAt: '2026-09-03T09:00:00Z' },
    { status: 'onderweg', customerCodename: 'B', at: '2026-09-03T09:00:00Z' }
  ], [
    { status: 'bezorgd', customerCodename: 'B', finishedAt: '2026-09-04T09:00:00Z' },
    { status: 'bezorgd', customerCodename: 'C', finishedAt: '2026-08-30T09:00:00Z' }
  ], M);
  assert.deepEqual(r, { aantal: 3, n: 2 });
});

test('1 en 2. TravelOS: alleen reizen die thuis zijn, in de maand van thuiskomst', () => {
  const r = K.travel([
    { status: 'thuis', customerKey: 'user-1', thuis: { at: '2026-09-10T10:00:00Z' } },
    { status: 'thuis', customerKey: 'user-1', thuis: { at: '2026-09-20T10:00:00Z' } },
    { status: 'bevestigd', customerKey: 'user-2' },
    { status: 'thuis', customerKey: 'user-3', thuis: { at: '2026-10-01T10:00:00Z' } }
  ], M);
  assert.deepEqual(r, { aantal: 2, n: 1 });
});

test('1 en 2. WorkOS: definitieve loonruns, en de groep is het aantal zaken', () => {
  const r = K.work([
    { stand: 'definitief', code: 'Z1', definitiefOp: '2026-09-25T10:00:00Z' },
    { stand: 'definitief', code: 'Z1', definitiefOp: '2026-09-26T10:00:00Z' },
    { stand: 'manager', code: 'Z2', definitiefOp: null }
  ], M);
  assert.deepEqual(r, { aantal: 2, n: 1 });
});

test('1 en 2. FoundationOS: afgerond op de dag van afronden, ook als hij daarna in nazorg ging', () => {
  const r = K.foundation([
    { status: 'afgerond', afgerondOp: '2026-09-05' },
    { status: 'nazorg', afgerondOp: '2026-09-06' },
    { status: 'in_uitvoering' },
    { status: 'afgerond' }
  ], M);
  assert.deepEqual(r, { aantal: 2, n: 2 });
});

test('3. er is geen totaal over de vier werelden', () => {
  assert.deepEqual(Object.keys(K).sort(), ['foundation', 'living', 'travel', 'work'],
    'een extra functie hier is waarschijnlijk een optelling -- dat is het samengestelde cijfer van INT-04');
});

test('4. elke klantwaardemaat heeft een eigen wereld en een eigen groepsgrens', () => {
  const { MATEN } = require('../server/kern/bedrijfsmaat');
  const kw = Object.fromEntries(MATEN.filter(m => m.id.startsWith('uitkomst.klantwaarde')).map(m => [m.id, m]));
  assert.deepEqual(Object.keys(kw).sort(), ['uitkomst.klantwaarde-foundation', 'uitkomst.klantwaarde-living',
    'uitkomst.klantwaarde-travel', 'uitkomst.klantwaarde-work']);
  assert.equal(kw['uitkomst.klantwaarde-foundation'].wereld, 'rtfoundation', 'de RTFoundation blijft haar eigen wereld (C1)');
  assert.equal(kw['uitkomst.klantwaarde-work'].wereld, 'commercieel');
  assert.equal(kw['uitkomst.klantwaarde-work'].privacy, 'zaken');
  assert.equal(kw['uitkomst.klantwaarde-foundation'].privacy, 'gezinnen');
});
