/* Eén scenario voor e2e en de bestaande VOLTOOIPROEF; geen dubbele taaklogica. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
test('RTFoundation: vijf keuzes, vervolgtoestand, geschiedenis en serverherstel', { timeout: 240000 }, async () => {
  const reg = await require('../scripts/voltooiproef').meet({ alleen: 'rtfoundation-keuze' });
  const a = reg.apps['os:rtf'];
  assert.equal(a.afgebroken, null, JSON.stringify({ fout: a.afgebroken, details: a.browser?.foutdetails }));
  for (const bewijs of ['voltooibaar', 'persistent', 'herstelbaar', 'menselijk'])
    assert.equal(a[bewijs].sluit, true, JSON.stringify(a[bewijs]));
  assert.equal(a.browser.bezocht.filter(p => p.startsWith('/apps/foundation/index.html?groep=')).length, 5);
});
