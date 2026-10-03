'use strict';
// Observe the unchanged mutation motor's own synchronous test calls. This
// preload is not inherited by test children; it changes no test or assertion.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const M = require('./mutationproof-model');
const native = cp.spawnSync;
function command(cmd, args, options = {}) {
  const r = native(cmd, args, { encoding: 'utf8', timeout: 30000, ...options });
  if (r.status !== 0 || r.error) throw Error(cmd + ' fixture command failed: ' + String(r.stderr || r.error));
  return String(r.stdout || '').trim();
}
function changes(root) {
  const tracked = command('git', ['diff', '--name-only', 'HEAD', '--'], { cwd: root }).split('\n');
  const extra = command('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root }).split('\n');
  return [...new Set([...tracked, ...extra])].filter(p => p && p !== 'MUTATIES.json').sort().map(p => ({
    path: p, sha256: fs.existsSync(path.join(root, p)) ? M.hash(fs.readFileSync(M.file(root, p))) : null }));
}
function restoreRegister(root, source, output, expectedHash) {
  const original = fs.readFileSync(M.file(source, 'MUTATIES.json'));
  if (M.hash(original) !== expectedHash) throw Error('Candidate mutation register changed.');
  fs.copyFileSync(M.file(root, 'MUTATIES.json'), path.join(output, 'motor-register.json'));
  fs.writeFileSync(M.file(root, 'MUTATIES.json'), original);
}
function registerMatches(root, expectedHash) {
  return M.hash(fs.readFileSync(M.file(root, 'MUTATIES.json'))) === expectedHash;
}
function install(config) {
  const expected = path.join(config.root, 'test', config.name), journal = path.join(config.output, 'calls.jsonl');
  let number = fs.existsSync(journal) ? fs.readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).length : 0;
  cp.spawnSync = function(cmd, args, options) {
    if (!Array.isArray(args) || !args.includes('--test')) return native(cmd, args, options);
    if (path.resolve(options?.cwd || process.cwd(), args.at(-1)) !== expected) throw Error('Mutation motor changed test selection.');
    if (command('git', ['rev-parse', 'HEAD'], { cwd: config.root }) !== config.commit ||
        M.hash(fs.readFileSync(expected)) !== config.testSha256) throw Error('Candidate or test assertions changed.');
    const env = { ...(options?.env || process.env) }, before = changes(config.root);
    const row = { number: ++number, test: config.name, startedAt: new Date().toISOString(),
      lieg: env.RTG_LIEG || null, liegNiet: env.RTG_LIEG_NIET || null,
      forceExit: args.includes('--test-force-exit'), phase: config.phase || (before.length || env.RTG_LIEG ? 'mutant' : 'baseline'), sources: [] };
    for (const source of before) {
      if (!source.sha256) throw Error('Mutant deleted a source file.');
      const bytes = fs.readFileSync(M.file(config.root, source.path));
      const original = native('git', ['show', config.commit + ':' + source.path], { cwd: config.root, maxBuffer: 32 * 1024 * 1024 });
      if (original.status !== 0) throw Error('Mutation is not bound to a candidate source file.');
      const artifact = String(number).padStart(5, '0') + '-' + M.hash(source.path).slice(0, 16) + '.source';
      fs.writeFileSync(path.join(config.output, artifact), bytes);
      row.sources.push({ ...source, artifact, originalSha256: M.hash(original.stdout) });
    }
    let database = null;
    if (config.pg) {
      database = 'mutation_' + number;
      command('/usr/lib/postgresql/16/bin/createdb', ['-h', '127.0.0.1', '-U', 'node', database]);
      env.DATABASE_URL = 'postgresql://node@127.0.0.1:5432/' + database;
      env.PG_URL = env.DATABASE_URL;
      row.database = database;
    } else { delete env.DATABASE_URL; delete env.PG_URL; }
    // Only this file's isolated container can reach this Redis instance.
    command('redis-cli', ['-h', '127.0.0.1', 'FLUSHALL']);
    let result, cleanupError = null;
    try { result = native(cmd, args, { ...options, env }); }
    finally {
      if (database) try { command('/usr/lib/postgresql/16/bin/dropdb', ['-h', '127.0.0.1', '-U', 'node', '--force', database]); }
      catch (e) { cleanupError = e.message; }
    }
    const stdout = String(result.stdout || ''), stderr = String(result.stderr || '');
    const after = changes(config.root);
    Object.assign(row, { finishedAt: new Date().toISOString(), status: result.status, signal: result.signal,
      error: result.error?.code || cleanupError, stdout: number + '.tap', stderr: number + '.stderr',
      stdoutSha256: M.hash(stdout), stderrSha256: M.hash(stderr),
      sideEffects: JSON.stringify(before) === JSON.stringify(after) ? [] : [...new Set([...before, ...after].map(s => s.path))] });
    fs.writeFileSync(path.join(config.output, row.stdout), stdout);
    fs.writeFileSync(path.join(config.output, row.stderr), stderr);
    fs.appendFileSync(journal, JSON.stringify(row) + '\n');
    return result;
  };
  return () => { cp.spawnSync = native; };
}
if (process.env.RTG_MUTATION_CAPTURE && path.basename(process.argv[1] || '') === 'mutatie.js')
  install(M.read(process.env.RTG_MUTATION_CAPTURE));
module.exports = { install, changes, restoreRegister, registerMatches };
