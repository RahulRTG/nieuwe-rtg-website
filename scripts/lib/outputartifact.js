'use strict';
// Bind a journal archive to the upload that actually ran in the selected job.
// Format observed in the pinned actions/upload-artifact v7 job logs.
function verifyUpload(name, stepName, job, artifact, text) {
  const steps = (job.steps || []).filter(s => s.name === stepName);
  if (steps.length !== 1 || steps[0].status !== 'completed' || steps[0].conclusion !== 'success')
    throw Error('Required journal upload did not succeed: ' + name);
  const step = steps[0], second = value => Math.floor(Date.parse(value) / 1000);
  const from = second(step.started_at), to = second(step.completed_at);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from)
    throw Error('Journal upload step has no valid execution interval: ' + name);
  if (artifact.name !== name || !/^[1-9]\d*$/.test(String(artifact.id)) ||
      !/^sha256:[a-f0-9]{64}$/.test(artifact.digest || '')) throw Error('Invalid journal artifact identity: ' + name);
  const within = timestamp => second(timestamp) >= from && second(timestamp) <= to;
  const lines = text.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const start = /^(\S+) ##\[group\]Run actions\/upload-artifact@[a-f0-9]{40}$/.exec(lines[i]);
    if (!start) continue;
    let end = i + 1;
    while (end < lines.length && !/^\S+ ##\[group\]/.test(lines[end])) end++;
    const block = lines.slice(i, end);
    if (block.some(line => line.replace(/^\S+\s+/, '').trim() === 'name: ' + name))
      blocks.push({ timestamp: start[1], lines: block });
  }
  if (blocks.length !== 1 || !within(blocks[0].timestamp))
    throw Error('Cannot bind journal upload log to selected step: ' + name);
  const finalizations = blocks[0].lines.map(line =>
    /^(\S+) Artifact (\S+) successfully finalized\. Artifact ID ([1-9]\d*)$/.exec(line)).filter(Boolean);
  if (finalizations.length !== 1 || finalizations[0][2] !== name ||
      finalizations[0][3] !== String(artifact.id) || !within(finalizations[0][1]))
    throw Error('Journal artifact was not finalized by selected upload: ' + name);
  const digests = blocks[0].lines.map(line =>
    /^\S+ SHA256 digest of uploaded artifact is ([a-f0-9]{64})$/.exec(line)).filter(Boolean);
  if (digests.length !== 1 || 'sha256:' + digests[0][1] !== artifact.digest)
    throw Error('Journal upload digest differs from selected artifact: ' + name);
  return { step: stepName, conclusion: step.conclusion, startedAt: step.started_at,
    completedAt: step.completed_at, finalizedAt: finalizations[0][1], artifactId: artifact.id,
    artifactName: name, artifactDigest: artifact.digest };
}
module.exports = { verifyUpload };
