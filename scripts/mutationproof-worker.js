'use strict';
// Runs inside one disposable network-disabled container, never on the host.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const M = require('./mutationproof-model'), C = require('./mutationproof-capture');
const R = require('./mutationproof-runtime');
const children = new Set();
let interrupted = false;
function stop(child) { if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } } }
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { interrupted = true; for (const c of children) stop(c); });
function sync(cmd, args, options = {}) {
  const r = cp.spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, ...options });
  if (r.status !== 0 || r.error) throw Error(cmd + ' failed: ' + String(r.stderr || r.error));
  return String(r.stdout || '').trim();
}
function service(cmd, args, log) {
  const fd = fs.openSync(log, 'a');
  const c = cp.spawn(cmd, args, { detached: true, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd); children.add(c); return c;
}
async function ready(cmd, args) {
  const until = Date.now() + 20000;
  while (Date.now() < until && !interrupted) {
    if (cp.spawnSync(cmd, args, { timeout: 2000, stdio: 'ignore' }).status === 0) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Disposable local service did not become ready.');
}
function motor(args, env, output) {
  return new Promise(resolve => {
    const out = fs.openSync(path.join(output, 'motor.stdout'), 'wx'), err = fs.openSync(path.join(output, 'motor.stderr'), 'wx');
    const c = cp.spawn(process.execPath, args, { cwd: '/work/candidate', env, detached: true, stdio: ['ignore', out, err] });
    fs.closeSync(out); fs.closeSync(err); children.add(c);
    let timeout = false;
    const timer = setTimeout(() => { timeout = true; stop(c); }, 12 * 60 * 1000);
    c.once('error', error => { clearTimeout(timer); children.delete(c); resolve({ motorExit: null, error: error.message, timeout }); });
    c.once('exit', (code, signal) => { clearTimeout(timer); stop(c); children.delete(c); resolve({ motorExit: code, motorSignal: signal, timeout }); });
  });
}
async function main() {
  const [planPath, name] = process.argv.slice(2), plan = M.verify(M.read(planPath));
  const row = plan.rows.find(r => r.name === name);
  if (!row || !/^[a-zA-Z0-9_.-]+\.(test|e2e)\.js$/.test(name)) throw Error('Test is not in the frozen discovery.');
  if (process.env.RTG_MUTATION_CONTAINER !== 'isolated-v1') throw Error('Requires the dedicated disposable container.');
  const output = '/out', root = '/work/candidate';
  // A preparation failure is an explicit empty invocation journal, never a
  // missing journal that could be mistaken for omitted executed calls.
  fs.writeFileSync(path.join(output, 'calls.jsonl'), '', { flag: 'wx' });
  const result = { schema: 'RTG_MUTATION_CASE_V1', plan: plan.digest, candidate: plan.candidate,
    runner: plan.runner, test: name, testSha256: row.testSha256, startedAt: new Date().toISOString(),
    runtime: process.version, runtimeSha256: M.hash(fs.readFileSync(process.execPath)), calls: [], sourceRestored: false };
  try {
    result.preparedRuntime = M.read('/input/RUNTIME.json');
    R.verifyPrepared('/input/source', result.preparedRuntime);
    sync('git', ['-c', 'safe.directory=/input/source', 'clone', '--quiet', '--no-hardlinks', '/input/source', root]);
    sync('git', ['checkout', '--quiet', '--detach', plan.candidate.commit], { cwd: root });
    if (M.identity(root).tree !== plan.candidate.tree) throw Error('Candidate tree changed.');
    if (M.hash(fs.readFileSync(path.join(root, 'test', name))) !== row.testSha256) throw Error('Test bytes changed.');
    fs.symlinkSync('/opt/deps/node_modules', path.join(root, 'node_modules'), 'dir');
    if (fs.existsSync('/input/source/motor/target')) fs.symlinkSync('/input/source/motor/target', path.join(root, 'motor/target'), 'dir');
    result.playwright = M.read('/opt/deps/node_modules/playwright/package.json').version;
    const lock = M.read(path.join(root, 'package-lock.json'));
    if (result.playwright !== lock.packages['node_modules/playwright'].version) throw Error('Browser package is not the candidate lockfile version.');
    const pg = require(path.join(root, 'scripts/lib/pg-toetslijst')).TOETSEN.includes('test/' + name);
    result.postgres = pg ? sync('/usr/lib/postgresql/16/bin/postgres', ['--version']) : null;
    if (pg) {
      sync('/usr/lib/postgresql/16/bin/initdb', ['-D', '/work/pg', '-U', 'node', '--auth=trust', '--no-locale']);
      service('/usr/lib/postgresql/16/bin/postgres', ['-D', '/work/pg', '-h', '127.0.0.1', '-k', '/work'], path.join(output, 'postgres.log'));
      await ready('/usr/lib/postgresql/16/bin/pg_isready', ['-h', '127.0.0.1', '-U', 'node']);
    }
    service('redis-server', ['--bind', '127.0.0.1', '--port', '6379', '--save', '', '--appendonly', 'no'], path.join(output, 'redis.log'));
    await ready('redis-cli', ['-h', '127.0.0.1', 'ping']);
    const config = { root, name, output, pg, commit: plan.candidate.commit, testSha256: row.testSha256 };
    M.write('/work/capture.json', config);
    const env = { PATH: process.env.PATH, HOME: '/home/node', LANG: 'C.UTF-8', TZ: 'Europe/Amsterdam',
      CI: 'true', NODE_ENV: 'test', RTG_AI_UIT: '1', RTG_E2E_STRICT: '1', RTG_SNELLE_TOETS: '1',
      REDIS_URL: 'redis://127.0.0.1:6379', PLAYWRIGHT_BROWSERS_PATH: '/opt/browsers',
      RTG_MUTATION_CAPTURE: '/work/capture.json' };
    Object.assign(result, await motor(['--require', path.join(__dirname, 'mutationproof-capture.js'),
      path.join(root, 'scripts/mutatie.js'), '--opnieuw', 'test/' + name], env, output));
    result.motorRecord = M.read(path.join(root, 'MUTATIES.json')).toetsen[name] || null;
    C.restoreRegister(root, '/input/source', output, plan.historicalRegisterSha256);
    result.sideEffects = C.changes(root);
    result.sourceRestored = !result.sideEffects.length && !interrupted && !result.timeout && C.registerMatches(root, plan.historicalRegisterSha256) && M.git(root, ['rev-parse', 'HEAD']) === plan.candidate.commit;
    if (result.sourceRestored && fs.existsSync(path.join(output, 'calls.jsonl'))) {
      const undo = C.install({ ...config, phase: 'restored' });
      try { require(path.join(root, 'scripts/mutatie')).draaiToets(path.join(root, 'test', name), env, 240000, false); }
      finally { undo(); }
      result.sourceRestored = C.changes(root).length === 0 && C.registerMatches(root, plan.historicalRegisterSha256) && M.git(root, ['rev-parse', 'HEAD']) === plan.candidate.commit;
    }
    R.verifyPrepared('/input/source', result.preparedRuntime);
  } catch (e) { result.error = e.stack; }
  finally {
    const closing = [...children].map(c => c.exitCode !== null || c.signalCode !== null ? Promise.resolve() : new Promise(resolve => c.once('close', resolve)));
    for (const c of children) stop(c);
    await Promise.all(closing);
    result.interrupted = interrupted;
    result.finishedAt = new Date().toISOString();
    const log = path.join(output, 'calls.jsonl');
    if (fs.existsSync(log)) result.calls = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    result.sideEffects = [...(result.sideEffects || []), ...result.calls.flatMap(c => c.sideEffects || [])];
    result.verdict = M.verdict(result, output);
    // The host closes and hashes its container streams after this process exits.
    result.files = Object.fromEntries(fs.readdirSync(output).filter(f => !f.startsWith('container.') && fs.statSync(path.join(output, f)).isFile()).sort()
      .map(f => [f, M.hash(fs.readFileSync(path.join(output, f)))]));
    M.write(path.join(output, 'CASE.json'), M.seal(result));
  }
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 2; });
