/* De vragenmotor van De Residence: ruim tienduizend verschillende vragen
   in zes genres, van superluchtig tot een traan tot zakelijk en door en
   door. Pure unit-test op de module zelf. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const vragen = require('../server/kern/residentie/vragen');

test('de motor kan ruim tienduizend verschillende vragen stellen', () => {
  assert.ok(vragen.totaal() >= 10000, 'minstens 10.000; nu ' + vragen.totaal());
  assert.equal(vragen.GENRES.length, 6, 'zes genres, van luchtig tot zakelijk');
});

test('elk genre levert een echte, goedgevormde vraag in het eigen register', () => {
  for (const genre of vragen.GENRES) {
    for (let i = 0; i < 25; i++) {
      const v = vragen.genereer(genre);
      assert.equal(v.genre, genre);
      assert.ok(v.tekst.includes('?') || v.tekst.includes('.'), 'een zin met een einde');
      assert.ok(v.tekst.length > 20 && v.tekst.length < 220, 'niet te kort, niet te lang');
      assert.ok(!v.tekst.includes('{'), 'alle gaten zijn gevuld: ' + v.tekst);
    }
  }
});

test('de variatie is echt: honderd trekkingen leveren tientallen verschillende vragen', () => {
  const gezien = new Set();
  for (let i = 0; i < 100; i++) gezien.add(vragen.genereer().tekst);
  assert.ok(gezien.size >= 60, 'ruim de helft uniek; nu ' + gezien.size);
});
