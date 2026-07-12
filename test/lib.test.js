/* Unit-tests voor de zuivere hulplibs (server/lib). Geen server nodig.
   Draai: node --test test/lib.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../server/lib/geo');
const leeftijd = require('../server/lib/leeftijd');

test('geo.haversine: afstand Amsterdam <-> Rotterdam is ~57 km', () => {
  const ams = { lat: 52.3676, lng: 4.9041 }, rot = { lat: 51.9244, lng: 4.4777 };
  const m = geo.haversine(ams, rot);
  assert.ok(m > 55000 && m < 60000, 'afstand plausibel: ' + m);
  assert.equal(geo.haversine(null, rot), null);
  assert.equal(geo.haversine({ lat: 'x' }, rot), null);
});

test('geo.etaMinutes: lopen duurt langer dan rijden, vliegen het kortst', () => {
  const d = 10000; // 10 km
  const lopen = geo.etaMinutes(d, 'walking');
  const rijden = geo.etaMinutes(d, 'driving');
  const vliegen = geo.etaMinutes(d, 'flying');
  assert.ok(lopen > rijden && rijden > vliegen, `${lopen} > ${rijden} > ${vliegen}`);
  assert.equal(geo.etaMinutes(null), null);
  assert.equal(geo.etaMinutes(1, 'driving'), 1); // minstens 1 minuut
});

test('leeftijd.leeftijdVan + groep: paspoortdatum stuurt de groep', () => {
  const jaar = new Date().getFullYear();
  assert.equal(leeftijd.leeftijdVan('bla'), null);
  assert.equal(leeftijd.leeftijdVan((jaar - 30) + '-01-01') >= 29, true);
  assert.equal(leeftijd.leeftijdsgroepVan(16), '15-17');
  assert.equal(leeftijd.leeftijdsgroepVan(20), '18-21');
  assert.equal(leeftijd.leeftijdsgroepVan(40), '21+');
  assert.equal(leeftijd.leeftijdsgroepVan(null), null);
});
