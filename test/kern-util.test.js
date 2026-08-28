/* Zuivere kern-hulpjes (server/kern/util.js): los testbaar, geen server nodig.
   Draai: node --test test/kern-util.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../server/kern/util');

test('schoon verwijdert < en >, knipt af en trimt', () => {
  assert.equal(u.schoon('  <b>hoi</b>  '), 'bhoi/b');
  assert.equal(u.schoon('abcdef', 3), 'abc');
  assert.equal(u.schoon(null), '');
});

test('ledenPrijs rekent nooit meer dan de publieke prijs', () => {
  assert.equal(u.ledenPrijs(10, 8), 8);   // ledenprijs lager: die geldt
  assert.equal(u.ledenPrijs(10, 12), 10); // ledenprijs hoger: geplafonneerd
  assert.equal(u.ledenPrijs(10), 10);     // geen aparte ledenprijs
});

/* HEETTE `centen` en rondde EURO'S af -- de naam zei het tegenovergestelde van
   wat hij deed. Zie de kop van kern/geld/eenheid.js; test/geldeenheid.test.js
   houdt de naam weg. */
test('rondEuro rondt af op twee decimalen en LAAT het euro\'s', () => {
  assert.equal(u.rondEuro(3.14159), 3.14);
  assert.equal(u.rondEuro(1.999), 2);
  assert.equal(u.centen, undefined, 'de oude naam hoort weg te zijn, niet ernaast te staan');
});

test('codes zijn leesbaar en van de juiste lengte', () => {
  assert.equal(u.entreeCode().length, 6);
  assert.equal(u.pickupCode().length, 4);
  assert.match(u.entreeCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.doesNotMatch(u.pickupCode(), /[01OI]/); // geen verwarrende tekens
});
