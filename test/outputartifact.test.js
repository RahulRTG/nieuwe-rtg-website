'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { verifyUpload, githubBytes } = require('../scripts/lib/outputartifact');
const name = 'schermjournaal-deel-2', stepName = 'Schermjournaal van dit deel bewaren';
const digest = '8fa04f7e70b0ef26d29e4e42f0f9b01e4354669f159d1802e99b72792e3ad548';
function fixture() {
  // Real v7 log structure (CI run 36848308388, 2026-10-01), journal name substituted.
  const job = { status: 'completed', steps: [{ name: 'Scherm-tests (PDA in de browser)', conclusion: 'success' },
    { name: stepName, status: 'completed', conclusion: 'success', started_at: '2026-10-01T10:41:15Z', completed_at: '2026-10-01T10:41:17Z' }] };
  const artifact = { name, id: 11155711538, digest: 'sha256:' + digest };
  const text = [
    '2026-10-01T10:41:15.9484694Z ##[group]Run actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
    '2026-10-01T10:41:15.9485120Z with:',
    '2026-10-01T10:41:15.9485352Z   name: ' + name,
    '2026-10-01T10:41:15.9487473Z ##[endgroup]',
    '2026-10-01T10:41:16.7726201Z SHA256 digest of uploaded artifact is ' + digest,
    '2026-10-01T10:41:17.1690509Z Artifact ' + name + ' successfully finalized. Artifact ID 11155711538',
    '2026-10-01T10:41:17.1691840Z Artifact ' + name + ' has been successfully uploaded! Final size is 1071 bytes. Artifact ID is 11155711538',
    '2026-10-01T10:41:17.1810174Z ##[group]Run actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
    '2026-10-01T10:41:17.1810765Z   name: other-artifact'
  ].join('\n');
  return { job, artifact, text };
}
const verify = f => verifyUpload(name, stepName, f.job, f.artifact, f.text);
test('GitHub ANSI logs retain exact bytes while upload identity remains strict', () => {
  const f = fixture();
  const raw = Buffer.from(f.text.split('\n').map(line => '\x1b[32m' + line + '\x1b[0m').join('\n'));
  const bytes = githubBytes('owner/repo', '/actions/jobs/42/logs', (command, args, options) => {
    assert.equal(command, 'gh');
    assert.deepEqual(args, ['api', 'repos/owner/repo/actions/jobs/42/logs', '--allow-escape-sequences']);
    assert.equal(options.maxBuffer, 256 * 1024 * 1024);
    return raw;
  });
  assert.strictEqual(bytes, raw, 'raw evidence bytes must not be rewritten before hashing');
  f.text = bytes.toString('utf8');
  assert.equal(verify(f).artifactId, f.artifact.id);
  for (const change of [g => { g.artifact.id++; },
    g => { g.artifact.digest = 'sha256:' + '0'.repeat(64); },
    g => { g.job.steps[1].conclusion = 'failure'; },
    g => { g.job.steps[1].started_at = '2026-10-01T11:41:15Z'; }]) {
    const altered = structuredClone(f); change(altered);
    assert.throws(() => verify(altered), 'ANSI handling must not relax provenance checks');
  }
  const failure = new Error('GitHub read failed');
  assert.throws(() => githubBytes('owner/repo', '/actions/jobs/42/logs', () => { throw failure; }),
    error => error === failure, 'transport failures must propagate');
});
test('v7 upload proof binds the exact journal ID and digest to the successful step', () => {
  const f = fixture(), proof = verify(f);
  assert.equal(proof.artifactId, f.artifact.id);
  assert.equal(proof.artifactDigest, f.artifact.digest);
  assert.equal(proof.step, stepName);
  assert.equal(proof.finalizedAt, '2026-10-01T10:41:17.1690509Z');
});
test('a new passing test cannot borrow an old artifact or an older upload log', () => {
  const oldArtifact = fixture(); oldArtifact.artifact.id--;
  assert.throws(() => verify(oldArtifact), /not finalized/);
  const oldLog = fixture();
  oldLog.job.steps[1].started_at = '2026-10-01T11:41:15Z';
  oldLog.job.steps[1].completed_at = '2026-10-01T11:41:17Z';
  assert.throws(() => verify(oldLog), /selected step/);
});
test('failed, skipped, missing or duplicate upload steps cannot supply a journal', () => {
  for (const conclusion of ['failure', 'skipped', 'cancelled', null]) {
    const f = fixture(); f.job.steps[1].conclusion = conclusion;
    assert.throws(() => verify(f), /did not succeed/);
  }
  const missing = fixture(); missing.job.steps.pop();
  assert.throws(() => verify(missing), /did not succeed/);
  const duplicate = fixture(); duplicate.job.steps.push({ ...duplicate.job.steps[1] });
  assert.throws(() => verify(duplicate), /did not succeed/);
});
test('mismatched ID, name or digest and absent finalization fail closed', () => {
  for (const change of [f => { f.artifact.id++; }, f => { f.artifact.name = 'other'; },
    f => { f.text = f.text.replace('Artifact ' + name + ' successfully finalized', 'Artifact other successfully finalized'); },
    f => { f.text = f.text.replace('name: ' + name, 'name: other'); },
    f => { f.artifact.digest = 'sha256:' + '0'.repeat(64); },
    f => { f.text = f.text.replace(/^.*successfully finalized.*$/m, ''); }]) {
    const f = fixture(); change(f); assert.throws(() => verify(f));
  }
});
test('a finalization outside the upload block or execution interval is not upload proof', () => {
  const outside = fixture();
  outside.text = outside.text.replace(/^.*successfully finalized.*$/m, '');
  outside.text += '\n2026-10-01T10:41:17.200Z Artifact ' + name + ' successfully finalized. Artifact ID 11155711538';
  assert.throws(() => verify(outside), /not finalized/);
  const late = fixture(); late.text = late.text.replace('10:41:17.1690509Z', '10:41:19.1690509Z');
  assert.throws(() => verify(late), /not finalized/);
});
