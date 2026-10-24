'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isBrowserruis, meldingen } = require('../scripts/lib/browserruis');

test('alleen de drie bekende browsermeldingen over afgebroken overgangen zijn ruis', () => {
  assert.equal(meldingen.length, 3);
  for (const bericht of meldingen) {
    assert.equal(isBrowserruis(bericht), true);
    assert.equal(isBrowserruis(Object.assign(new Error(bericht), { name: 'InvalidStateError' })), true);
  }
  assert.equal(isBrowserruis('Transition failed in application code'), false);
  assert.equal(isBrowserruis(new TypeError('Page already revealed by our own code')), false);
});
