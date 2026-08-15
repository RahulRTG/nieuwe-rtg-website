'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { geldigeImageId, geldigeTag, valideerBon, SERVICES, BUILD_SERVICES } = require('../scripts/uitrol');
const fs = require('node:fs');
const path = require('node:path');

test('uitrol bewaakt app, motor en de onafhankelijke voordeur', () => {
  assert.deepEqual(SERVICES, ['app', 'motor', 'sentinel']);
  assert.deepEqual(BUILD_SERVICES, ['app', 'motor']);
});

test('de drie eigen containers hebben een onveranderlijke root en geen Linux-capabilities', () => {
  const compose = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
  for (const dienst of ['app', 'sentinel', 'motor']) {
    const gevonden = compose.match(new RegExp('^  ' + dienst + ':\\n[\\s\\S]*?(?=^  [a-z][a-z0-9_-]*:\\n|^volumes:\\n)', 'm'));
    assert.ok(gevonden, dienst + ' staat in Compose');
    const blok = gevonden[0];
    assert.match(blok, /read_only: true/, dienst + ' rootfs is read-only');
    assert.match(blok, /no-new-privileges:true/, dienst + ' kan geen privileges winnen');
    assert.match(blok, /cap_drop: \["ALL"\]/, dienst + ' heeft geen Linux-capabilities');
  }
});

test('rollback accepteert alleen exacte Docker-image-id’s en veilige tags', () => {
  const id = 'sha256:' + 'a'.repeat(64);
  assert.equal(geldigeImageId(id), true);
  assert.equal(geldigeImageId('latest'), false);
  assert.equal(geldigeTag('rtg-app:local'), true);
  assert.equal(geldigeTag('rtg app;wis'), false);
  assert.doesNotThrow(() => valideerBon({ formaat: 'rtg-uitrol-v1', images: {
    app: { id, tags: ['rtg-app:local'] }, motor: null, sentinel: { id, tags: ['rtg-app:local'] }
  } }));
});

test('rollback weigert een gemanipuleerde bon voordat Docker wordt aangeraakt', () => {
  assert.throws(() => valideerBon({ formaat: 'rtg-uitrol-v1', images: {
    app: { id: '$(kwaad)', tags: ['rtg-app:local'] }
  } }), /image-id/);
  assert.throws(() => valideerBon({ formaat: 'rtg-uitrol-v1', images: {
    app: { id: 'sha256:' + 'b'.repeat(64), tags: ['rtg-app:ok;rm'] }
  } }), /image-tag/);
});
