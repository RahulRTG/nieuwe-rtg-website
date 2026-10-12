/* DE DUURZAME IDEM-RING van de betaal- en de munt-naad (server/lib/idemring.js).

   server.js koppelde twee keer dezelfde opslag aan server/betaal.js en
   server/muntbetaal.js: een object met de ring onder `_keys`, en `in` om te
   kijken of een sleutel nieuw was. Dezelfde fout als in server/lib/idem.js
   (test/idem-sleutelnaam.test.js): `in` leest het prototype, dus `constructor`
   gold als al gezien en kreeg nooit een plek in de ring; `_keys` werd stil
   genegeerd, zodat een herhaling opnieuw betaalde; `__proto__` verving het
   prototype. De betaalnaad geeft de sleutel van de aanroeper ONGEWIJZIGD door
   (server/betaal-connect.js, server/betaal/ontvangst.js), dus de grens hoort
   in de opslag zelf en niet bij elke aanroeper. Een gereserveerde naam wordt
   bij het OPZOEKEN geweigerd: dat is voor het geld beweegt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakIdemRing = require('../server/lib/idemring');

function ring(max) {
  const data = {};
  let saves = 0;
  const r = maakIdemRing({ data: () => data, naam: 'proefIdem', max, save: () => { saves++; } });
  return { r, data, saves: () => saves };
}

test('een naam van het prototype is een gewone sleutel', () => {
  const { r, data } = ring();
  for (const k of ['constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(r.get(k), undefined, k + ' is nog niet gezien');
    r.set(k, { id: k });
    assert.deepEqual(r.get(k), { id: k }, k);
  }
  assert.deepEqual(data.proefIdem._keys, ['constructor', 'toString', 'hasOwnProperty'], 'elk in de ring');
});

test('_keys en __proto__ worden bij het opzoeken geweigerd, en de opslag blijft heel', () => {
  const { r, data } = ring();
  r.set('a', 1);
  for (const k of ['_keys', '__proto__']) {
    assert.throws(() => r.get(k), /idempotentiesleutel/, k);
    assert.throws(() => r.set(k, { kapot: true }), /idempotentiesleutel/, k);
  }
  assert.deepEqual(data.proefIdem._keys, ['a']);
  assert.equal(Object.getPrototypeOf(data.proefIdem), Object.prototype);
});

test('de ring is begrensd, de oudste gaat eerst, en een bestaande sleutel telt niet dubbel', () => {
  const { r, data, saves } = ring(5);
  for (let i = 0; i < 12; i++) r.set('k' + i, { id: i });
  assert.equal(data.proefIdem._keys.length, 5);
  assert.equal(r.get('k0'), undefined);
  assert.deepEqual(r.get('k11'), { id: 11 });
  r.set('k11', { id: 'nieuw' });
  assert.equal(data.proefIdem._keys.length, 5);
  assert.equal(saves(), 13);
});

test('een beschadigde opslag wordt hersteld in plaats van te breken', () => {
  const data = { proefIdem: 'kapot' };
  const r = maakIdemRing({ data: () => data, naam: 'proefIdem', save: () => { throw new Error('schijf vol'); } });
  r.set('x', 1); // een save die gooit laat het geheugenresultaat staan
  assert.equal(r.get('x'), 1);
  data.proefIdem._keys = null;
  r.set('y', 2);
  assert.deepEqual(data.proefIdem._keys, ['y']);
});

test('door de echte betaalnaad: `constructor` betaalt een keer, `__proto__` betaalt niet', async () => {
  process.env.NODE_ENV = 'test';
  process.env.RTG_MAGNAAT_TEST = '1';
  const betaal = require('../server/betaal');
  const { r } = ring();
  betaal.koppelStore(r);
  const a = await betaal.maakBetaling({ bedrag: 500, referentie: 'R-1', idempotentieSleutel: 'constructor' });
  assert.equal(a.herhaald, undefined, 'een nieuwe betaling, geen vals herhaald antwoord');
  const b = await betaal.maakBetaling({ bedrag: 500, referentie: 'R-1', idempotentieSleutel: 'constructor' });
  assert.equal(b.id, a.id);
  assert.equal(b.herhaald, true);
  await assert.rejects(betaal.maakBetaling({ bedrag: 500, referentie: 'R-2', idempotentieSleutel: '__proto__' }), /idempotentiesleutel/);
});
