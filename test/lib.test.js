/* Unit-tests voor de zuivere hulplibs (server/lib). Geen server nodig.
   Draai: node --test test/lib.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../server/lib/geo');
const leeftijd = require('../server/lib/leeftijd');
const { merge3 } = require('../server/db');

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

test('db.merge3: gelijktijdige wijzigingen in dezelfde collectie worden samengevoegd', () => {
  // maps (bijv. foundation.gezinnen of sessions): elk props een andere sleutel
  const base = { A: 1 };
  assert.deepEqual(merge3(base, { A: 1, B: 2 }, { A: 1, C: 3 }), { A: 1, B: 2, C: 3 });
  // een kant wijzigt een waarde, de andere niet: de wijziging wint
  assert.deepEqual(merge3({ A: 1 }, { A: 9 }, { A: 1 }), { A: 9 });
  assert.deepEqual(merge3({ A: 1 }, { A: 1 }, { A: 9 }), { A: 9 });
  // verwijderen werkt door
  assert.deepEqual(merge3({ A: 1, B: 2 }, { A: 1 }, { A: 1, B: 2 }), { A: 1 });
  // arrays met id (bijv. orders, snaps): toevoegingen van beide kanten blijven
  const ords = merge3([{ id: 1 }], [{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 3 }]);
  assert.deepEqual(ords.map(o => o.id).sort(), [1, 2, 3]);
  // connecties (array zonder id, sleutel uit a+b)
  const conns = merge3([], [{ a: 'x', b: 'y' }], [{ a: 'p', b: 'q' }]);
  assert.equal(conns.length, 2);
  // geneste map (bijv. foundation.gezinnen[code].profielen)
  const nested = merge3({ g: { profielen: { p1: 1 } } }, { g: { profielen: { p1: 1, p2: 2 } } }, { g: { profielen: { p1: 1, p3: 3 } } });
  assert.deepEqual(nested.g.profielen, { p1: 1, p2: 2, p3: 3 });
});
