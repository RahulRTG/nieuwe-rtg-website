/* Drie (public/shared/drie.js): de pure kern van de 3D-laag -- mat4/vec3 en de
   meshbouwers -- draait ook in Node en is hier los getoetst (geen canvas nodig).
   De WebGL-renderer zelf leeft alleen in de browser en valt daar stil terug.
   Draai los: node --experimental-sqlite --test test/drie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const Drie = require('../public/shared/drie');
const M = Drie.mat4;

function bijna(a, b, eps = 1e-9) { return Math.abs(a - b) <= eps; }

test('1. identiteit is neutraal bij vermenigvuldigen', () => {
  const m = M.perspectief(1.0, 1.5, 1, 100);
  const id = M.identiteit();
  const r = M.vermenigvuldig(id, m);
  for (let i = 0; i < 16; i++) assert.ok(bijna(r[i], m[i]), 'element ' + i);
});

test('2. vermenigvuldig(A, translatie) verplaatst zoals verwacht (kolom-hoofd)', () => {
  // model = T(2,3,4); een punt op de oorsprong moet naar (2,3,4)
  const T = M.translatie(2, 3, 4);
  // pas T toe op vec4 (0,0,0,1): kolom 3 (index 12..15) is de translatie
  assert.deepEqual([T[12], T[13], T[14], T[15]], [2, 3, 4, 1]);
});

test('3. perspectief: standaardposities kloppen', () => {
  const p = M.perspectief(Math.PI / 2, 1, 1, 101);
  // tan(45°)=1 => f=1; f/aspect op [0], f op [5], -1 op [11]
  assert.ok(bijna(p[0], 1));
  assert.ok(bijna(p[5], 1));
  assert.equal(p[11], -1);
});

test('4. kijkNaar levert een orthonormale rotatie (kolommen unit + loodrecht)', () => {
  const v = M.kijkNaar([10, 20, 30], [0, 0, 0], [0, 1, 0]);
  const x = [v[0], v[4], v[8]], y = [v[1], v[5], v[9]], z = [v[2], v[6], v[10]];
  assert.ok(bijna(Drie.lengte(x), 1, 1e-6), 'x unit');
  assert.ok(bijna(Drie.lengte(y), 1, 1e-6), 'y unit');
  assert.ok(bijna(Drie.lengte(z), 1, 1e-6), 'z unit');
  assert.ok(bijna(Drie.dot(x, y), 0, 1e-6), 'x⊥y');
  assert.ok(bijna(Drie.dot(x, z), 0, 1e-6), 'x⊥z');
});

test('5. kruisproduct + normaliseer', () => {
  const c = Drie.kruis([1, 0, 0], [0, 1, 0]);
  assert.deepEqual(c, [0, 0, 1]);
  const n = Drie.normaliseer([0, 3, 4]);
  assert.ok(bijna(n[1], 0.6) && bijna(n[2], 0.8));
});

test('6. doos-mesh (gebouw, bodemloos): 5 vlakken => 20 hoekpunten, 30 indices', () => {
  // een gebouw staat op de grond; de onderkant tekenen we bewust niet
  const m = Drie.doos(Drie.leegMesh(), 0, 0, 4, 10, 4, [0.5, 0.1, 0.2]);
  assert.equal(m.posities.length, 20 * 3);
  assert.equal(m.normalen.length, 20 * 3);
  assert.equal(m.kleuren.length, 20 * 3);
  assert.equal(m.indices.length, 30);
  assert.equal(Math.max(...m.indices), 19, 'geen index buiten de buffer');
});

test('7. lint volgt een polyline: n-1 segmenten => (n-1)*4 hoekpunten', () => {
  const punten = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const m = Drie.lint(punten, 3, [0.5, 0.1, 0.2], 0.6);
  assert.equal(m.posities.length, 3 * 4 * 3);
  assert.equal(m.indices.length, 3 * 6);
  // op grondhoogte y=0.6
  for (let i = 1; i < m.posities.length; i += 3) assert.ok(bijna(m.posities[i], 0.6), 'lint op y=0.6');
});

test('8. lint met te weinig punten is leeg maar geldig', () => {
  const m = Drie.lint([[0, 0]], 3, [1, 1, 1]);
  assert.equal(m.posities.length, 0);
  assert.equal(m.indices.length, 0);
});

test('9. pin bouwt boven op een bestaande mesh door (indices blijven sluitend)', () => {
  const m = Drie.leegMesh();
  Drie.pin(m, 5, -5, 6, [0.76, 0.11, 0.20]);
  assert.ok(m.indices.length > 0);
  assert.equal(m.posities.length / 3 - 1, Math.max(...m.indices), 'hoogste index == laatste hoekpunt');
  assert.equal(m.posities.length % 3, 0);
});
