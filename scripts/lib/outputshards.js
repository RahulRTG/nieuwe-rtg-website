'use strict';
// Scheduling and verification only. The candidate's meetEen owns the experiment.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
function git(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
function identity(cwd) {
  if (git(cwd, ['status', '--porcelain', '--untracked-files=no'])) throw Error('Source is not clean.');
  return { commit: git(cwd, ['rev-parse', 'HEAD']), tree: git(cwd, ['rev-parse', 'HEAD^{tree}']) };
}
function seal(value) { return { ...value, id: hash(JSON.stringify(value)) }; }
function verifySeal(value) {
  const { id, ...body } = value || {};
  if (id !== hash(JSON.stringify(body))) throw Error('Evidence identity mismatch.');
  return value;
}
function partition(rows, count) {
  if (!Number.isInteger(count) || count < 1 || count > 8) throw Error('Invalid shard count.');
  const groups = new Map(), seen = new Set();
  for (const row of rows) {
    if (seen.has(row.route)) throw Error('Duplicate planned route.');
    seen.add(row.route);
    if (!groups.has(row.toets)) groups.set(row.toets, []);
    groups.get(row.toets).push(row);
  }
  const shards = Array.from({ length: count }, (_, index) => ({ index, groups: [], routes: 0 }));
  // Keep one test file together so its actual current control can be reused.
  for (const [toets, routes] of [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    const shard = [...shards].sort((a, b) => a.routes - b.routes || a.index - b.index)[0];
    shard.groups.push({ toets, routes }); shard.routes += routes.length;
  }
  return shards;
}
function choose(k, sensitive, doors, infra, candidate) {
  const rows = [], excluded = [];
  for (const [route, tests] of [...k.perRoute].sort((a, b) => a[0].localeCompare(b[0]))) {
    const endpoint = route.slice(route.indexOf(' ') + 1);
    let reason = !endpoint.startsWith('/api/') ? 'OUTSIDE_MUTATOR' :
      doors.some(d => endpoint.startsWith(d)) ? 'AUTHENTICATION_DOOR' : infra.has(route) ? 'SHARED_INFRASTRUCTURE' : null;
    const possible = [...tests].filter(t => sensitive.has(t) && /^[\w.-]+\.test\.js$/.test(t))
      .map(toets => ({ toets, width: [...k.perToets.get(toets)].filter(r => !infra.has(r)).length }))
      .sort((a, b) => a.width - b.width || a.toets.localeCompare(b.toets));
    if (!reason && !possible.length) reason = 'NO_ATTRIBUTED_SENSITIVE_SERVER_TEST';
    if (reason) { excluded.push({ route, reason, tests: [...tests].sort() }); continue; }
    const best = possible[0], bytes = fs.readFileSync(path.join(candidate, 'test', best.toets));
    rows.push({ route, toets: best.toets, width: best.width, testSha256: hash(bytes) });
  }
  return { rows, excluded };
}
function fileWithin(root, name) {
  if (!name || path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw Error('Unsafe evidence path.');
  const file = path.resolve(root, name);
  if (!fs.realpathSync(file).startsWith(fs.realpathSync(root) + path.sep)) throw Error('Evidence escapes bundle.');
  return file;
}
function verifyExecution(run, root, prefix) {
  if (!run || typeof run.toetsen !== 'number') throw Error('Missing execution.');
  const stdout = fs.readFileSync(fileWithin(root, prefix + '.tap'), 'utf8');
  const stderr = fs.readFileSync(fileWithin(root, prefix + '.stderr'), 'utf8');
  if (hash(stdout) !== run.stdoutSha256 || hash(stderr) !== run.stderrSha256) throw Error('Test log digest mismatch.');
  const tests = Number(/^# tests (\d+)/m.exec(stdout)?.[1] || 0);
  const skipped = Number(/^# skipped (\d+)/m.exec(stdout)?.[1] || 0);
  const failures = (stdout.match(/^not ok /gm) || []).length;
  if (tests !== run.toetsen || skipped !== run.overgeslagen || failures !== run.gezakt)
    throw Error('Test counters disagree with preserved TAP.');
}
function verifyResult(row, result, plan, root, B) {
  if (result.route !== row.route || result.toets !== row.toets || result.testSha256 !== row.testSha256 ||
      result.plan !== plan.id || result.binding !== plan.binding.id || result.evidenceCommit !== plan.candidate.commit)
    throw Error('Route/candidate/plan binding mismatch.');
  if (!['merkt', 'blind', 'stoornis'].includes(result.staat)) throw Error('Unknown output result.');
  if (!result.evidence) {
    if (result.staat !== 'stoornis') throw Error('Claim without evidence.');
    return;
  }
  const prefix = hash(row.route), ev = result.evidence;
  verifyExecution(ev.mutation, root, prefix + '-mutation');
  const hits = fs.readFileSync(fileWithin(root, prefix + '.hits'), 'utf8').trim().split('\n').filter(Boolean);
  if (hash(hits.join('\n')) !== ev.hitDigest || hits.length !== ev.changedResponses) throw Error('Mutation hit mismatch.');
  if (ev.control) verifyExecution(ev.control, root, prefix + '-control');
  if (result.staat === 'merkt' && (!B.complete(ev.mutation) || ev.mutation.status !== 1 || !hits.length))
    throw Error('MERKT requires a completed failing test after an actual changed response.');
  if (result.staat === 'blind' && (!B.green(ev.mutation) || !hits.length)) throw Error('BLIND requires an actual surviving mutation.');
}
function exactRoutes(expected, actual) {
  const seen = new Set();
  for (const result of actual) {
    if (seen.has(result.route)) throw Error('Duplicate route evidence.');
    seen.add(result.route);
  }
  if (seen.size !== expected.length || expected.some(row => !seen.has(row.route))) throw Error('Missing or extra route evidence.');
}
module.exports = { hash, read, write, git, identity, seal, verifySeal, partition, choose,
  fileWithin, verifyExecution, verifyResult, exactRoutes };
