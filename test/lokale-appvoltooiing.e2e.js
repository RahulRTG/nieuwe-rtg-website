/* Lokale browserproeven gebruiken dezelfde taakimplementaties als VOLTOOIPROEF.
   Geen registergroen, echte camera of wijziging van productiegegevens. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakWereld } = require('../scripts/lib/voltooiwereld');
const camera = require('../scripts/lib/voltooi/camera');

test('Juridisch: dezelfde browserketen als VOLTOOIPROEF', { timeout: 180000 }, async () => {
  const reg = await require('../scripts/voltooiproef').meet({ alleen: 'juridisch' });
  const a = reg.apps['link:juridisch'];
  assert.equal(a.afgebroken, null);
  for (const bewijs of ['voltooibaar', 'persistent', 'herstelbaar', 'menselijk'])
    assert.equal(a[bewijs].sluit, true, JSON.stringify(a[bewijs]));
  assert.ok(a.browser.bezocht.includes('/apps/juridisch/privacy.html'));
});

async function cameraProef(naam) {
  const w = await maakWereld('camera-' + naam, undefined, { behoudAdres: true });
  try {
    await camera.proeven[naam](w, async (bewijs, wat, fn) => {
      const uit = await fn();
      assert.equal(uit.klopt, true, bewijs + ': ' + wat);
    });
    assert.ok(w.browser.bezocht.includes(camera.ingang));
    assert.deepEqual(w.browser.fouten, []);
    assert.deepEqual(w.browser.documentfouten, []);
  } finally { w.klaar(); }
}

test('Camera: echte videoframes, lokale JPEG-export, opnieuw openen en annuleren',
  { timeout: 180000 }, () => cameraProef('opname'));

test('Camera: echte browserweigering blijft leesbaar en blokkeert opnemen',
  { timeout: 120000 }, () => cameraProef('weigering'));

test('Camera: herprobeeractie herstelt na één ingespoten platformweigering',
  { timeout: 120000 }, () => cameraProef('herprobeer'));
