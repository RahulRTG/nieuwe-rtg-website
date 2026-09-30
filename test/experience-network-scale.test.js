'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, supplier, request } = require('./network-fixture');
test('stream en bestaande Mall-lijst leveren identieke openbare bronobjecten', () => {
  const h = fixture([supplier('A'), supplier('B')]);
  const expected = h.kern.mall.aanbodAlles(), received = [];
  const r = h.kern.mall.aanbodBezoek(a => received.push(a));
  assert.deepEqual(received, expected.aanbod);
  assert.deepEqual(r.stuk, []); assert.deepEqual(r.aanbod, []);
});
test('100.000 testbedrijven: verse volledige projectie, geen per-aanbod suppliers.find, begrensde uitvoer', t => {
  const suppliers = Array.from({ length: 100000 }, (_, i) => supplier('P' + i));
  suppliers.find = () => { throw Error('Kwadratische leverancierszoeklus'); };
  const h = fixture(suppliers), start = performance.now();
  const r = h.experience.network(request());
  t.diagnostic(JSON.stringify({ syntheticRetailOrganizations: suppliers.length,
    projectionMs: Number((performance.now() - start).toFixed(1)),
    processRssMiB: Math.round(process.memoryUsage().rss / 1048576) }));
  assert.equal(r.completeness.status, 'COMPLETE', JSON.stringify(r.completeness));
  assert.equal(r.proposal.needs[0].matches, 100000);
  assert.equal(r.proposal.needs[0].options.length, 3);
  assert.ok(JSON.stringify(r).length < 12000);
  assert.equal(h.saves(), 0);
});
