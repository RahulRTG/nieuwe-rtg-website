'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meet, ROUTES, oordeel } = require('../scripts/lib/verificatie-isolatie');
test('verificatie: echte accounts en opslag begrenzen alle drie POST-routes', { timeout: 120000 }, async () => {
  const rows = await meet();
  assert.deepEqual(Object.keys(rows), ROUTES.map(p => 'POST ' + p));
  for (const [route, row] of Object.entries(rows)) assert.equal(oordeel(row).stand, 'gemeten', route + ': ' + JSON.stringify(row));
});
