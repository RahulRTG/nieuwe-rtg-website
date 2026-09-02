const test = require('node:test');
const assert = require('node:assert/strict');
const { controleer } = require('../scripts/toegang-contract');

test('alle huidige inlog- en aanmeldschermen volgen RTG Access Experience', () => {
  const r = controleer();
  assert.deepEqual(r.fouten, []);
  assert.ok(r.schermen.length >= 19, 'de toegangscensus is onverwacht gekrompen');
  assert.ok(r.schermen.includes('public/apps/app.html'), 'de ledenentree ontbreekt');
  assert.ok(r.schermen.includes('public/apps/personeel.html'), 'WorkOS-personeel ontbreekt');
  assert.ok(r.schermen.includes('public/apps/foundation/registreren.html'), 'Foundation-registratie ontbreekt');
  assert.ok(r.schermen.includes('public/apps/reisuitnodiging.html'), 'TravelOS-uitnodigingsregistratie ontbreekt');
});

test('de officiële ledeningang blijft passkey-first zonder biometrie vanzelf te openen', () => {
  const r = controleer();
  assert.deepEqual(r.fouten, []);
});
