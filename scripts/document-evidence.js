/* Integrity and candidate binding, deliberately not a substitute for a release-authority signature. */
'use strict';
const { createHash } = require('node:crypto');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const evidenceDigest = binding => digest(JSON.stringify({ files: binding.files, runs: binding.runs }));
function verify(binding, expected, files) {
  const errors = [];
  if (!expected.evidenceDigest || evidenceDigest(binding) !== expected.evidenceDigest) errors.push('trusted-evidence-digest');
  for (const key of ['domain','commit','artifactDigest','policyDigest','contractDigests'])
    if (JSON.stringify(binding[key]) !== JSON.stringify(expected[key])) errors.push('binding:' + key);
  if (!/^[a-f0-9]{40}$/.test(binding.commit || '')) errors.push('commit-format');
  if (!binding.files || !binding.files.length) errors.push('missing-files');
  for (const item of binding.files || []) {
    const bytes = files[item.name];
    if (!bytes || digest(bytes) !== item.sha256) errors.push('bytes:' + item.name);
  }
  // The supplied PASS label is ignored. Executed test identities and TAP counters must agree.
  for (const run of binding.runs || []) {
    const bytes = files[run.log];
    if (!bytes || !binding.files.some(f => f.name === run.log)) { errors.push('unbound-log:' + run.log); continue; }
    const text = bytes.toString();
    const count = key => { const m = text.match(new RegExp('^# ' + key + ' (\\d+)$', 'm')); return m ? Number(m[1]) : null; };
    if (run.exitCode !== 0 || count('fail') !== 0 || count('cancelled') !== 0 || count('skipped') !== 0 || !count('tests') || count('pass') !== count('tests')) errors.push('run:' + run.log);
    if (!run.requiredTests || !run.requiredTests.length) errors.push('missing-test-identities:' + run.log);
    for (const name of run.requiredTests || [])
      if (!text.split('\n').some(line => /^ok \d+ - /.test(line) && line.replace(/^ok \d+ - /, '') === name)) errors.push('test:' + name);
  }
  if (!binding.runs || !binding.runs.length) errors.push('missing-runs');
  return { valid: errors.length === 0, errors, authentication: 'UNSIGNED_LOCAL_INTEGRITY; trusted expected digests must be supplied independently' };
}
module.exports = { digest, evidenceDigest, verify };
