/* De 3D-tegellaag (public/shared/tegel3d.js): de pure meetkunde -- isometrische
   projectie, de staafvlakken en de kantel-hoeken -- draait ook in Node en is hier
   los getoetst. Het tekenen zelf (2D-canvas) en de kantel-interactie leven in de
   browser.
   Draai los: node --experimental-sqlite --test test/tegel3d.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/shared/tegel3d');

test('1. iso: oorsprong blijft de oorsprong; y omhoog = kleinere schermwaarde Y', () => {
  const o = T.iso(0, 0, 0, 10, 20);
  assert.deepEqual(o, { X: 10, Y: 20 });
  const laag = T.iso(0, 0, 0, 10, 20).Y, hoog = T.iso(0, 10, 0, 10, 20).Y;
  assert.ok(hoog < laag, 'hoger (grotere y) staat hoger op het scherm');
});

test('2. iso: diepte z schuift naar linksboven (kleinere X en Y)', () => {
  const voor = T.iso(0, 0, 0, 50, 50), achter = T.iso(0, 0, 10, 50, 50);
  assert.ok(achter.X < voor.X && achter.Y < voor.Y, 'diepte gaat naar linksachter');
});

test('3. staafVlakken: n waarden => n staven, elk met drie vlakken van 4 punten', () => {
  const v = T.staafVlakken([3, 5, 4, 8, 6], { breedte: 120, hoogte: 44 });
  assert.equal(v.length, 5);
  for (const s of v) {
    assert.equal(s.top.length, 4); assert.equal(s.voor.length, 4); assert.equal(s.zij.length, 4);
    for (const p of s.top.concat(s.voor, s.zij)) { assert.ok(Number.isFinite(p.X) && Number.isFinite(p.Y)); }
  }
});

test('4. staafVlakken: de hoogste waarde geeft de hoogste staaf', () => {
  const v = T.staafVlakken([2, 9, 4], {});
  const h = v.map(s => s.hoogte);
  assert.ok(h[1] > h[0] && h[1] > h[2], 'index 1 (waarde 9) is het hoogst');
  assert.ok(h[0] > 0 && h[2] > 0, 'positieve waarden geven positieve hoogte');
});

test('5. staafVlakken: bovenvlak staat hoger op het scherm dan het voorvlak', () => {
  const s = T.staafVlakken([5], { hoogte: 50 })[0];
  const topY = Math.min.apply(null, s.top.map(p => p.Y));
  const basisY = Math.max.apply(null, s.voor.map(p => p.Y));
  assert.ok(topY < basisY, 'de top ligt boven de basis');
});

test('6. lege invoer is veilig', () => {
  assert.deepEqual(T.staafVlakken([], {}), []);
});

test('7. kantel: midden = recht; randen kantelen begrensd en tegengesteld', () => {
  const m = T.kantel(0.5, 0.5, 8);
  assert.ok(Math.abs(m.rx) < 1e-9 && Math.abs(m.ry) < 1e-9, 'midden staat recht');
  assert.ok(T.kantel(1, 0.5, 8).ry > 0 && T.kantel(0, 0.5, 8).ry < 0, 'links/rechts tegengesteld');
  assert.ok(T.kantel(0.5, 0, 8).rx > 0 && T.kantel(0.5, 1, 8).rx < 0, 'boven/onder tegengesteld');
  assert.equal(T.kantel(1, 1, 8).rx, -8, 'begrensd op de max');
});
