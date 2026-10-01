'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inventaris, tapSamenvatting, zelfdeInventaris } = require('../scripts/lib/schermsuite-bewijs');

test('scherminventaris bindt exact aantal, pad en inhoud', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schermbewijs-'));
  fs.mkdirSync(path.join(root, 'test'));
  fs.writeFileSync(path.join(root, 'test', 'a.e2e.js'), 'eerste\n');
  fs.writeFileSync(path.join(root, 'test', 'b.e2e.js'), 'tweede\n');
  fs.writeFileSync(path.join(root, 'test', 'geen.test.js'), 'buiten\n');
  const voor = inventaris(root);
  assert.equal(voor.bestanden, 2);
  fs.writeFileSync(path.join(root, 'test', 'a.e2e.js'), 'gewijzigd\n');
  const na = inventaris(root);
  assert.equal(na.bestanden, 2);
  assert.notEqual(na.bestandenSha256, voor.bestandenSha256);
  assert.equal(zelfdeInventaris(voor, na), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('TAP-samenvatting behandelt ontbrekend niet als nul skips', () => {
  assert.equal(tapSamenvatting('# tests 1\n# pass 1\n').volledig, false);
  const uit = tapSamenvatting([
    '# tests 12', '# pass 11', '# fail 0', '# cancelled 0', '# skipped 1', '# todo 0'
  ].join('\n'));
  assert.equal(uit.volledig, true);
  assert.equal(uit.tests, 12);
  assert.equal(uit.overgeslagen, 1);
});

test('TAP-diagnose bewaart welke toetsen zijn overgeslagen of todo', () => {
  const uit = tapSamenvatting([
    'TAP version 13',
    'ok 1 - echte browser # SKIP chromium ontbreekt',
    'not ok 2 - providercontract # TODO wacht op sandbox',
    '# tests 2', '# pass 0', '# fail 0', '# cancelled 0', '# skipped 1', '# todo 1'
  ].join('\n'));
  assert.deepEqual(uit.overgeslagenTests,
    [{ test: 'echte browser', reden: 'chromium ontbreekt' }]);
  assert.deepEqual(uit.todoTests,
    [{ test: 'providercontract', reden: 'wacht op sandbox' }]);
});
