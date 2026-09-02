'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const platform = require('../server/kern/workspace-platform');
const { FUNCTIES } = require('../server/functies/register');

test('Workspace Platform omvat elke serverfunctie zonder routebeleid naar de browser te kopieren', () => {
  const services = platform.services();
  assert.equal(services.length, FUNCTIES.length); assert.ok(services.length >= 204);
  assert.ok(services.every(x => x.capability === 'service.' + x.id && x.governance === 'server-feature-gate'));
  assert.ok(services.every(x => x.paden === undefined), 'interne routeprefixen horen niet in het workspacecatalogus');
  assert.equal(new Set(services.map(x => x.id)).size, services.length);
});

test('Living Modules kunnen alleen bestaande servercapabilities claimen', () => {
  const goed = platform.coverage([{ services: ['kern-comm', 'dom-veiligheid'] }], [{ items: [{}, {}] }]);
  assert.deepEqual(goed.unknownClaims, []); assert.equal(goed.claimedByLivingModules, 2);
  const fout = platform.coverage([{ services: ['bestaat-niet'] }], []);
  assert.deepEqual(fout.unknownClaims, ['bestaat-niet']);
});
