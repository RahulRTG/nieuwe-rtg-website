const test = require('node:test');
const assert = require('node:assert/strict');
const { primitiveBlock } = require('../scripts/lib/osm-pbf');

function varint(n) {
  let x = BigInt(n), uit = [];
  while (x > 127n) { uit.push(Number(x & 127n) | 128); x >>= 7n; }
  uit.push(Number(x)); return Buffer.from(uit);
}
const zigzag = n => { const x = BigInt(n); return x < 0n ? (-x * 2n - 1n) : x * 2n; };
const veld = (nr, wire, inhoud) => Buffer.concat([varint((nr << 3) | wire), wire === 2 ? varint(inhoud.length) : Buffer.alloc(0), inhoud]);
const getal = (nr, n) => veld(nr, 0, varint(n));
const bytes = (nr, b) => veld(nr, 2, Buffer.from(b));
const gepakt = (nr, rij, signed) => bytes(nr, Buffer.concat(rij.map(x => varint(signed ? zigzag(x) : x))));

test('de eigen PBF-lezer vertaalt DenseNodes, tags en een Way zonder dependency', () => {
  const strings = ['', 'highway', 'residential', 'name', 'Testweg'];
  const stringTable = Buffer.concat(strings.map(s => bytes(1, Buffer.from(s))));
  const dense = Buffer.concat([
    gepakt(1, [1, 1], true),
    gepakt(8, [520000000, 10000], true),
    gepakt(9, [40000000, 10000], true),
    gepakt(10, [0, 0], false)
  ]);
  const way = Buffer.concat([
    getal(1, 77), gepakt(2, [1, 3], false), gepakt(3, [2, 4], false), gepakt(8, [1, 1], true)
  ]);
  const groep = Buffer.concat([bytes(2, dense), bytes(3, way)]);
  const blok = Buffer.concat([bytes(1, stringTable), bytes(2, groep), getal(17, 100)]);
  const nodes = [], ways = [];
  primitiveBlock(blok, { node: n => nodes.push(n), way: w => ways.push(w) });
  assert.equal(nodes.length, 2);
  assert.ok(Math.abs(nodes[0].lat - 52) < 1e-8);
  assert.ok(Math.abs(nodes[0].lng - 4) < 1e-8);
  assert.deepEqual(ways[0].refs, [1, 2]);
  assert.equal(ways[0].tags.highway, 'residential');
  assert.equal(ways[0].tags.name, 'Testweg');
});
