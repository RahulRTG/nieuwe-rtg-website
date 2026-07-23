/* De RTG-signatuurmond (public/shared/mond.js): het puntenveld dat de lippen
   vormt is een pure functie met diepte (z). Hier los getoetst in Node -- de
   WebGL-render en de 2D-terugval leven alleen in de browser.
   Draai los: node --experimental-sqlite --test test/mond.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const Mond = require('../public/shared/mond');

// een deterministische "random" zodat het veld reproduceerbaar is
function nepRandom(zaad) {
  let s = zaad >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('1. puntenVeld levert een flinke wolk met alle velden', () => {
  const v = Mond.puntenVeld(nepRandom(42));
  assert.ok(v.length > 2000, 'duizenden puntjes: ' + v.length);
  for (const p of v.slice(0, 50)) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), 'x,y,z eindig');
    assert.ok(['b', 'o', 'm'].includes(p.lip), 'geldige lip');
    assert.ok(p.maat > 0, 'maat > 0');
    assert.match(p.kleur, /^#[0-9A-F]{6}$/i, 'hex-kleur');
  }
});

test('2. beide lippen en de middellijn komen voor', () => {
  const v = Mond.puntenVeld(nepRandom(7));
  const soorten = new Set(v.map(p => p.lip));
  assert.ok(soorten.has('b') && soorten.has('o') && soorten.has('m'), 'boven, onder en middellijn');
});

test('3. de diepte (z) bolt naar de kijker: lippen positief, middellijn terug', () => {
  const v = Mond.puntenVeld(nepRandom(9));
  const lip = v.filter(p => p.lip !== 'm');
  const mid = v.filter(p => p.lip === 'm');
  assert.ok(lip.some(p => p.z > 0.05), 'lippen bollen naar voren');
  assert.ok(mid.every(p => p.z < 0), 'de middellijn ligt terug');
  // de z blijft in een net, klein bereik (geen gekke uitschieters)
  assert.ok(v.every(p => p.z >= -0.2 && p.z <= 0.4), 'z binnen bereik');
});

test('4. het kleurenpalet is de signatuur (bordeaux, goud, wit)', () => {
  const v = Mond.puntenVeld(nepRandom(3));
  const kleuren = new Set(v.map(p => p.kleur.toUpperCase()));
  for (const k of kleuren) assert.ok(['#9E1C40', '#C9A24B', '#FFFFFF'].includes(k), 'alleen huiskleuren: ' + k);
  assert.ok(kleuren.has('#9E1C40') && kleuren.has('#C9A24B'), 'bordeaux en goud aanwezig');
});

test('5. reproduceerbaar met dezelfde random-bron', () => {
  const a = Mond.puntenVeld(nepRandom(123));
  const b = Mond.puntenVeld(nepRandom(123));
  assert.equal(a.length, b.length);
  assert.deepEqual(a[0], b[0]);
  assert.deepEqual(a[a.length - 1], b[b.length - 1]);
});
