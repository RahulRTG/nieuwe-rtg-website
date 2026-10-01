'use strict';
// Read-only GitHub evidence collection. Never runs tests, commits, pushes or deploys.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { verifyUpload } = require('./lib/outputartifact');
const source = path.resolve(process.argv[2] || '');
const repo = process.env.GITHUB_REPOSITORY;
const sha = process.argv[3], runId = process.argv[4];
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^[a-f0-9]{40}$/.test(sha || '') || !/^\d+$/.test(runId || '') || !process.argv[5])
  throw Error('Usage: outputcollect.js CANDIDATE_DIR FULL_SHA CI_RUN_ID EVIDENCE_DIR (GITHUB_REPOSITORY required)');
const collectionRoot = path.resolve(process.argv[5]);
let out = collectionRoot;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = (file, value) => {
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
};
const git = args => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
const api = endpoint => execFileSync('gh', ['api', 'repos/' + repo + endpoint], { maxBuffer: 256 * 1024 * 1024 });
const read = endpoint => JSON.parse(api(endpoint).toString('utf8'));
function pages(endpoint, key) {
  const result = [];
  for (let p = 1; ; p++) {
    const page = read(endpoint + (endpoint.includes('?') ? '&' : '?') + 'per_page=100&page=' + p);
    result.push(...page[key]);
    if (page[key].length < 100) return result;
  }
}
const required = [
  ...[1, 2, 3, 4].map(n => ({ artifact: 'routejournaal-scherf-' + n,
    job: 'Toetsscherf ' + n + ' van 4', step: 'Deze scherf, met dekking als lcov',
    upload: 'Het routejournaal van deze scherf bewaren', member: 'routejournaal.log', nonempty: true })),
  ...['boot-smoke', 'grens-sweep', 'keuring', 'klok', 'meterijk', 'zaakdoos'].map(n => ({ artifact: 'routejournaal-ijking-' + n,
    job: 'De ijking - ' + n, step: 'De ijking draaien (een bestand, alleen op deze machine)',
    upload: 'Het routejournaal van deze ijking bewaren', member: 'routejournaal.log' })),
  ...[1, 2, 3, 4].map(n => ({ artifact: 'schermjournaal-deel-' + n,
    job: 'Schermtoetsen deel ' + n + ' van 4', step: 'Scherm-tests (PDA in de browser)',
    upload: 'Schermjournaal van dit deel bewaren', member: '.schermjournaal', nonempty: true }))
];
try {
  if (git(['rev-parse', 'HEAD']) !== sha || git(['status', '--porcelain', '--untracked-files=no']))
    throw Error('Candidate checkout must be exact and clean.');
  const candidateTree = git(['rev-parse', sha + '^{tree}']);
  const run = read('/actions/runs/' + runId);
  out = collectionRoot;
  if (fs.existsSync(path.join(out, 'COLLECTION-STATUS.json'))) throw Error('Collection directory already contains evidence; use a new run directory.');
  if (run.head_sha !== sha && !(run.pull_requests || []).some(p => p.head?.sha === sha))
    throw Error('This workflow run is not associated with the requested candidate.');
  if (run.path !== '.github/workflows/ci.yml') throw Error('Unexpected workflow.');
  const jobs = pages('/actions/runs/' + runId + '/jobs?filter=latest', 'jobs');
  const artifacts = pages('/actions/runs/' + runId + '/artifacts', 'artifacts');
  json('RUN.json', run); json('JOBS.json', jobs); json('ARTIFACTS.json', artifacts);
  const selected = required.map(r => {
    const matchingJobs = jobs.filter(j => j.name === r.job);
    const matchingArtifacts = artifacts.filter(a => a.name === r.artifact && !a.expired);
    if (matchingJobs.length !== 1 || matchingArtifacts.length !== 1)
      throw Error('Exactly one completed job and immutable artifact required: ' + r.artifact);
    const job = matchingJobs[0], artifact = matchingArtifacts[0];
    const step = job.steps.find(s => s.name === r.step);
    if (job.status !== 'completed' || step?.conclusion !== 'success')
      throw Error('Required test execution did not finish successfully: ' + r.job);
    if (!/^sha256:[a-f0-9]{64}$/.test(artifact.digest || ''))
      throw Error('GitHub artifact digest unavailable: ' + r.artifact);
    return { ...r, job, artifact };
  });
  const records = [], combined = [], treeCache = new Map();
  for (const r of selected) {
    const logFile = path.join(out, r.artifact + '.job-' + r.job.id + '.log');
    const log = fs.existsSync(logFile) ? fs.readFileSync(logFile) : api('/actions/jobs/' + r.job.id + '/logs');
    if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, log);
    const text = log.toString('utf8').replace(/\x1b\[[0-9;]*m/g, '');
    const upload = verifyUpload(r.artifact.name, r.upload, r.job, r.artifact, text);
    const lines = text.split('\n'), checkouts = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (!/git log -1 --format=['"]?%H/.test(lines[i])) continue;
      const found = /^\S+\s+([a-f0-9]{40})\s*$/.exec(lines[i + 1]);
      if (found) checkouts.push(found[1]);
    }
    if (checkouts.length !== 1) throw Error('Cannot unambiguously establish actual checkout SHA: ' + r.job.name);
    const checkout = checkouts[0];
    if (!treeCache.has(checkout)) {
      const commit = read('/git/commits/' + checkout);
      json('SOURCE-' + checkout + '.json', commit);
      treeCache.set(checkout, commit.tree.sha);
    }
    const checkedOutTree = treeCache.get(checkout);
    if (checkedOutTree !== candidateTree) throw Error('CI tested a different source tree: ' + r.job.name);
    const zipFile = path.join(out, r.artifact + '.artifact-' + r.artifact.id + '.zip');
    const zip = fs.existsSync(zipFile) ? fs.readFileSync(zipFile) : api('/actions/artifacts/' + r.artifact.id + '/zip');
    if ('sha256:' + hash(zip) !== r.artifact.digest) throw Error('GitHub archive digest mismatch: ' + r.artifact.name);
    if (!fs.existsSync(zipFile)) fs.writeFileSync(zipFile, zip);
    const members = execFileSync('/usr/bin/unzip', ['-Z1', zipFile], { encoding: 'utf8' }).trim().split('\n');
    if (members.length !== 1 || members[0] !== r.member) throw Error('Unexpected journal archive members: ' + r.artifact.name);
    const bytes = execFileSync('/usr/bin/unzip', ['-p', zipFile, r.member], { maxBuffer: 128 * 1024 * 1024 });
    const content = bytes.toString('utf8');
    const attributedLines = content.split('\n').filter(line => line.startsWith('TOETS ')).length;
    if (r.nonempty && !attributedLines) throw Error('No TOETS records: ' + r.artifact.name);
    const journalFile = r.artifact + '.journal.log';
    fs.writeFileSync(path.join(out, journalFile), bytes);
    combined.push(bytes, Buffer.from('\n'));
    records.push({ artifact: r.artifact.name, artifactId: r.artifact.id, artifactDigest: r.artifact.digest,
      journalFile, journalSha256: hash(bytes), attributedLines,
      jobId: r.job.id, jobName: r.job.name, jobConclusion: r.job.conclusion,
      testStep: r.step, testConclusion: 'success', upload, startedAt: r.job.started_at, completedAt: r.job.completed_at,
      jobLogFile: path.basename(logFile), jobLogSha256: hash(log), checkoutCommit: checkout,
      checkoutTree: checkedOutTree, candidateTree, binding: checkout === sha ? 'EXACT_COMMIT' : 'IDENTICAL_FULL_GIT_TREE' });
    console.log('Verified ' + r.artifact.name + ': ' + attributedLines + ' attributed lines');
  }
  const bytes = Buffer.concat(combined), journal = path.join(out, 'routejournaal.log');
  fs.writeFileSync(journal, bytes);
  const provenance = { commit: sha, sourceTree: candidateTree, sha256: hash(bytes), complete: true,
    createdAt: new Date().toISOString(), repository: repo, runId: Number(runId), runAttempt: run.run_attempt,
    workflowHeadSha: run.head_sha, workflowStatus: run.status, workflowConclusion: run.conclusion,
    scope: 'All four unit shards, six calibration journals, and four browser shards; their test execution completed successfully.',
    sourceEquivalence: 'Actual checkout commits remain recorded. A PR merge checkout is accepted only when its complete Git tree equals the candidate tree.',
    limitations: ['This collection does not claim the entire workflow is green.', 'Journals identify test-to-route attribution, not successful output invariants.'],
    sources: records };
  fs.writeFileSync(journal + '.provenance.json', JSON.stringify(provenance, null, 2) + '\n');
  json('COLLECTION-STATUS.json', { status: 'COMPLETE', candidate: sha, journal, journalSha256: hash(bytes),
    provenanceSha256: hash(fs.readFileSync(journal + '.provenance.json')), sourceCount: records.length });
  console.log('Complete current-source journal: ' + journal);
} catch (error) {
  const at = new Date().toISOString();
  const failure = { status: 'BLOCKED', candidate: sha, runId, at, reason: error.message };
  json('COLLECTION-STATUS-' + at.replace(/[:.]/g, '-') + '.json', failure);
  if (!fs.existsSync(path.join(out, 'COLLECTION-STATUS.json'))) json('COLLECTION-STATUS.json', failure);
  console.error(error.message); process.exitCode = 2;
}
