'use strict';
// Evidence bookkeeping only. The candidate's mutatie.js remains the instrument.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, r) => fs.writeFileSync(p, JSON.stringify(r, null, 2) + '\n');
const sha = s => { if (!/^[a-f0-9]{40}$/.test(s || '')) throw Error('Full commit SHA required.'); return s; };
function git(root, args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30000 }).trim(); }
function identity(root) {
  if (git(root, ['status', '--porcelain', '--untracked-files=all'])) throw Error('A clean checkout is required.');
  if (['.env', 'server/.env', 'server/data/db.json'].some(f => fs.existsSync(path.join(root, f)))) throw Error('Runtime data/secrets in source checkout.');
  return { commit: sha(git(root, ['rev-parse', 'HEAD'])), tree: git(root, ['rev-parse', 'HEAD^{tree}']) };
}
function seal(r) { return { ...r, digest: hash(JSON.stringify(r)) }; }
function verify(r) { const { digest, ...body } = r; if (hash(JSON.stringify(body)) !== digest) throw Error('Evidence digest mismatch.'); return r; }
function file(root, rel) {
  if (typeof rel !== 'string' || path.isAbsolute(rel) || rel.split('/').some(x => !x || x === '..' || x === '.')) throw Error('Unsafe evidence path.');
  let p = root;
  for (const part of rel.split('/')) { p = path.join(p, part); if (fs.lstatSync(p).isSymbolicLink()) throw Error('Symlink in evidence.'); }
  if (!fs.statSync(p).isFile()) throw Error('Evidence is not a file.');
  return p;
}
function discovery(root) {
  const register = read(path.join(root, 'MUTATIES.json'));
  if (!register.toetsen || typeof register.toetsen !== 'object' || Array.isArray(register.toetsen)) throw Error('Unreadable mutation register.');
  // Exact existing norm.js categories; no new exemption or easy-test filter.
  const covered = new Set(['gezakt', 'overleefd', 'geen bronmutatie mogelijk']);
  const all = fs.readdirSync(path.join(root, 'test')).filter(n => /\.(test|e2e)\.js$/.test(n)).sort();
  const rows = all.map(name => ({ name, testSha256: hash(fs.readFileSync(file(root, 'test/' + name))),
    previousState: register.toetsen[name]?.staat || null }));
  return { rows: rows.filter(r => !covered.has(r.previousState)), historicalOnly: rows.filter(r => covered.has(r.previousState)),
    historicalRegisterSha256: hash(fs.readFileSync(path.join(root, 'MUTATIES.json'))) };
}
function partition(rows, count, splitter) {
  const groups = splitter(rows.map(r => r.name), count);
  const all = groups.flat().sort(), expected = rows.map(r => r.name).sort();
  if (JSON.stringify(all) !== JSON.stringify(expected) || groups.length !== count) throw Error('Shard partition loses or duplicates tests.');
  return groups;
}
function tap(s) {
  const r = {};
  for (const k of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const m = [...s.matchAll(new RegExp('^# ' + k + ' (\\d+)$', 'gm'))];
    if (m.length !== 1) return null;
    r[k] = Number(m[0][1]);
  }
  return r;
}
function grade(call, dir) {
  const stdout = fs.readFileSync(file(dir, call.stdout), 'utf8'), stderr = fs.readFileSync(file(dir, call.stderr));
  if (hash(stdout) !== call.stdoutSha256 || hash(stderr) !== call.stderrSha256) throw Error('Raw test log changed.');
  const t = tap(stdout), finished = !call.error && !call.signal && Number.isInteger(call.status);
  const complete = finished && !call.forceExit && t && t.tests > 0 && t.cancelled === 0 && t.skipped === 0 && t.todo === 0;
  return { tap: t, green: !!(complete && call.status === 0 && t.fail === 0 && t.pass === t.tests),
    assertionFailure: !!(complete && call.status !== 0 && t.fail > 0 && /^\s+code: ['"]?ERR_ASSERTION['"]?\s*$/m.test(stdout)),
    incomplete: !complete };
}
function verdict(evidence, dir) {
  const calls = evidence.calls || [], graded = calls.map(c => ({ c, g: grade(c, dir) }));
  const baseline = graded.find(x => x.c.phase === 'baseline'), restore = graded.findLast(x => x.c.phase === 'restored');
  const mutants = graded.filter(x => x.c.phase === 'mutant');
  const base = { measured: false, state: 'INCOMPLETE', reason: 'baseline, actual mutation and restoration must all be proven' };
  if (evidence.error || evidence.interrupted || evidence.motorSignal) return { ...base, reason: 'Worker error or interruption invalidates the completed-call claim.' };
  if (!baseline?.g.green) return { ...base, state: 'BASELINE_UNPROVEN', reason: 'No complete passing baseline.' };
  if (!restore?.g.green || evidence.sourceRestored !== true) return { ...base, state: 'RESTORE_UNPROVEN', reason: 'No complete passing restored run with exact source.' };
  if (evidence.motorExit !== 0 || evidence.timeout || evidence.sideEffects?.length) return { ...base, reason: 'Interrupted motor or source side effect.' };
  if (!mutants.length) return { ...base, state: 'UNMEASURABLE', reason: evidence.motorRecord?.staat || 'No actual mutation executed.' };
  if (mutants.some(x => x.g.incomplete)) return { ...base, reason: 'An attempted mutant did not produce a complete unforced result.' };
  for (const { c } of mutants) {
    if (!(c.sources?.length || c.lieg === '/api/')) throw Error('Mutant without changed source or actual liegpoort.');
    for (const s of c.sources || []) {
      if (hash(fs.readFileSync(file(dir, s.artifact))) !== s.sha256 || s.originalSha256 === s.sha256) throw Error('Mutant source binding invalid.');
    }
  }
  const killed = mutants.find(x => x.g.assertionFailure);
  if (evidence.motorRecord?.staat === 'gezakt' && killed) return { measured: true, state: 'gezakt',
    reason: 'Complete original test detected an actual mutation; restored test passes.', call: killed.c.number };
  if (evidence.motorRecord?.staat === 'overleefd' && mutants.every(x => x.g.green)) return { measured: true, state: 'overleefd',
    reason: 'All mutations actually attempted by the completed canonical motor survived.', attempted: mutants.length };
  return { ...base, reason: 'Canonical verdict has no complete matching assertion evidence; timeout/import failure/skip is not a kill.' };
}
module.exports = { hash, read, write, sha, git, identity, seal, verify, file, discovery, partition, tap, grade, verdict };
