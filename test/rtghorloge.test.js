/* Het RTG-signatuurhorloge (public/shared/rtghorloge.js): de pure meetkunde --
   het plaatsen op een klok-hoek, het achthoekige cassement en de uur-hoeken --
   draait ook in Node en is hier los getoetst. Het tekenen (SVG + WebGL) leeft in
   de browser.
   Draai los: node --experimental-sqlite --test test/rtghorloge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/shared/rtghorloge');

test('1. opKlok: 0 graden = 12 uur (recht omhoog, kleinere y)', () => {
  const p = H.opKlok(0, 100, 500, 500);
  assert.ok(Math.abs(p.x - 500) < 1e-9, 'x blijft op het midden');
  assert.ok(Math.abs(p.y - 400) < 1e-9, '12 uur ligt 100 boven het midden');
});

test('2. opKlok: 90 graden = 3 uur (rechts), 180 = 6 uur (onder)', () => {
  const drie = H.opKlok(90, 100, 500, 500);
  assert.ok(Math.abs(drie.x - 600) < 1e-9 && Math.abs(drie.y - 500) < 1e-9, '3 uur ligt rechts');
  const zes = H.opKlok(180, 100, 500, 500);
  assert.ok(Math.abs(zes.x - 500) < 1e-9 && Math.abs(zes.y - 600) < 1e-9, '6 uur ligt onder');
});

test('3. achthoek: acht hoekpunten, allemaal op dezelfde straal', () => {
  const p = H.achthoek(400, 500, 500);
  assert.equal(p.length, 8);
  for (const q of p) {
    const r = Math.hypot(q.x - 500, q.y - 500);
    assert.ok(Math.abs(r - 400) < 1e-6, 'elk hoekpunt ligt op straal 400');
  }
});

test('4. achthoek: een platte kant boven (geen punt op 12 uur)', () => {
  const p = H.achthoek(400, 500, 500);
  // geen hoekpunt recht boven het midden; de bovenrand is een vlakke kant
  const boven = p.filter(q => Math.abs(q.x - 500) < 1e-6 && q.y < 500);
  assert.equal(boven.length, 0, 'geen schroef/punt recht op 12 uur -> vlakke kant');
  // wel symmetrisch rond de verticale as
  const xs = p.map(q => q.x - 500).sort((a, b) => a - b);
  assert.ok(Math.abs(xs[0] + xs[xs.length - 1]) < 1e-6, 'links/rechts symmetrisch');
});

test('5. uurHoeken: twaalf uren, 30 graden uit elkaar', () => {
  const u = H.uurHoeken();
  assert.equal(u.length, 12);
  assert.equal(u[0], 0);
  assert.equal(u[3], 90);
  assert.equal(u[6], 180);
  for (let i = 1; i < 12; i++) assert.equal(u[i] - u[i - 1], 30);
});
