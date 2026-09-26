'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { inspect, scan } = require('../scripts/document-fitness');
test('Documents production source graph satisfies enforced capability boundaries', () => {
  const result = scan(path.join(__dirname, '..'));
  assert.ok(result.scannedFiles > 0);
  assert.deepEqual(result.violations, []);
  assert.ok(result.references.some(r => r.kind === 'LIFECYCLE_WRITE'));
});
test('fitness rejects direct persistence, private handlers and fabricated authority from interfaces', () => {
  const cases = [
    ['public/apps/bestanden/new.js', "require('node:sqlite')", 'interface-persistence-import'],
    ['public/edge.js', "require('../server/kern/document-capability')", 'private-handler-import'],
    ['server/kern/stuur.js', "require('./bestanden-delen')", 'private-handler-import'],
    ['server/kern/world.js', 'db.data.bestanden.owner = {}', 'unreviewed-collection-access'],
    ['server/kern/world.js', "bewerkCollectie('bestanden', fn)", 'unreviewed-collection-writer'],
    ['server/routes/bestanden.js', 'bestanden.documentActie(key, body, () => true)', 'adapter-policy-bypass'],
    ['public/apps/work.js', 'item.documentRevision++', 'lifecycle-writer-bypass'],
    ['server/kern/bestanden-new.js', 'item.weg = false', 'lifecycle-writer-bypass']
  ];
  for (const [file, source, rule] of cases) assert.ok(inspect(source, file).violations.some(v => v.rule === rule), file);
});
