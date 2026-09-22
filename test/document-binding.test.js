'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { CONTRACTEN, policyDigest } = require('../server/kern/document-contracten');
const { digest, verify } = require('../scripts/document-evidence');
test('evidence binding rejects changed contract bytes commit capability version and forged PASS', () => {
  const expected = { domain: 'RTG:DOCUMENT-EVIDENCE:v1', commit: 'a'.repeat(40), artifactDigest: 'b'.repeat(64), policyDigest,
    contractDigests: Object.fromEntries(Object.values(CONTRACTEN).map(c => [c.capability_id, c.digest])) };
  const files = { 'run.tap': Buffer.from('TAP version 13\nok 1 - owned lifecycle proof\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n') };
  const b = { ...expected, files: [{ name: 'run.tap', sha256: digest(files['run.tap']) }], runs: [{ log: 'run.tap', exitCode: 0, requiredTests: ['owned lifecycle proof'] }] };
  assert.equal(verify(b, expected, files).valid, true);
  for (const key of ['commit', 'artifactDigest', 'policyDigest', 'domain']) assert.equal(verify({ ...b, [key]: 'wrong' }, expected, files).valid, false, key);
  const altered = { ...expected.contractDigests, 'documents.trash@1': 'c'.repeat(64) };
  assert.equal(verify({ ...b, contractDigests: altered }, expected, files).valid, false);
  assert.equal(verify({ ...b, contractDigests: { 'documents.trash@2': CONTRACTEN['documents.trash'].digest } }, expected, files).valid, false);
  assert.equal(verify(b, expected, { 'run.tap': Buffer.from('PASS') }).valid, false);
  const forged = { ...b, status: 'PASS', runs: [{ ...b.runs[0], exitCode: 1 }] };
  assert.equal(verify(forged, expected, files).valid, false);
  assert.equal(verify({ ...b, runs: [] }, expected, files).valid, false);
  assert.equal(verify({ ...b, runs: [{ ...b.runs[0], requiredTests: ['a test never executed'] }] }, expected, files).valid, false);
});
