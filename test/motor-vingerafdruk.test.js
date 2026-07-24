/* De saldi-vingerafdruk (drift-detector): borgt dat de JS-berekening BYTE-VOOR-
   BYTE gelijk is aan de Rust-motor (motor/src/pay.rs::vingerafdruk), zodat de
   schaduw-drift-detector per-rekening-drift vangt die de totaalsom mist.
   Draai: node --test test/motor-vingerafdruk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { vingerafdruk } = require('../server/kern/pay/vingerafdruk');

// Exact dezelfde stand als de Rust-test pay::tests::vingerafdruk_stabiel_en_vaste_vector:
// NEVEL laadt 100000, stuurt 40000 naar SPOOK.
const VASTE_VECTOR = 'e1c42b2abf34f03f';

test('vingerafdruk: vaste vector (lockstep met de Rust-motor)', () => {
  const saldi = { 'lid:NEVEL': 60000, 'lid:SPOOK': 40000, 'extern:oplaad': -100000 };
  assert.equal(vingerafdruk(saldi), VASTE_VECTOR);
});

test('vingerafdruk: invoegvolgorde en nul-saldi doen er niet toe', () => {
  const a = vingerafdruk({ 'lid:NEVEL': 60000, 'lid:SPOOK': 40000, 'extern:oplaad': -100000 });
  const b = vingerafdruk({ 'extern:oplaad': -100000, 'lid:LEEG': 0, 'lid:SPOOK': 40000, 'lid:NEVEL': 60000 });
  assert.equal(a, b, 'andere volgorde + een nul-rekening geeft dezelfde afdruk');
});

test('vingerafdruk: per-rekening-drift die de som mist wordt zichtbaar', () => {
  // Beide standen sluiten op som 0, maar A staat +100 te hoog en B -100 te laag.
  const goed = { 'lid:A': 500, 'lid:B': 500, 'extern:oplaad': -1000 };
  const scheef = { 'lid:A': 600, 'lid:B': 400, 'extern:oplaad': -1000 };
  const som = (o) => Object.values(o).reduce((s, v) => s + v, 0);
  assert.equal(som(goed), 0);
  assert.equal(som(scheef), 0, 'de som is in beide gevallen 0 (de grove check mist dit)');
  assert.notEqual(vingerafdruk(goed), vingerafdruk(scheef), 'de vingerafdruk vangt de wegvallende drift wel');
});

test('vingerafdruk: lege stand is stabiel', () => {
  assert.equal(vingerafdruk({}), vingerafdruk({ 'lid:X': 0 }), 'alleen nul-saldi telt als leeg');
});
