'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lees, controleer, VERWACHT } = require('../scripts/rust-migraties');

test('het Rust-register bevat exact de 13 zware modules in veilige volgorde', () => {
  const register = lees();
  assert.deepEqual(controleer(register), []);
  assert.deepEqual(register.modules.map(m => m.pad), VERWACHT);
  assert.equal(register.modules.filter(m => ['schaduw', 'canary'].includes(m.fase)).length, 1);
});

test('het Rust-register weigert dubbele modules, fasesprongen en een ontbrekende noodstop', () => {
  const register = structuredClone(lees());
  register.modules[1].pad = register.modules[0].pad;
  register.modules[2].fase = 'direct-live';
  register.modules[3].noodstop = '';
  register.modules[4].fase = 'schaduw';
  register.modules[0].rust = 'motor/src/bestaat-niet.rs';
  const fouten = controleer(register);
  assert.ok(fouten.some(f => /uniek/.test(f)));
  assert.ok(fouten.some(f => /onbekende fase/.test(f)));
  assert.ok(fouten.some(f => /noodstop ontbreekt/.test(f)));
  assert.ok(fouten.some(f => /vereist de bestaande Rust-bron/.test(f)));
  assert.ok(fouten.some(f => /maximaal één/.test(f)));
});
