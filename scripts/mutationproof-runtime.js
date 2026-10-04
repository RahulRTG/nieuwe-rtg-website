'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const M = require('./mutationproof-model');
const SOURCES = ['motor/rust-toolchain.toml', 'motor/Cargo.lock'];
const BINARIES = ['motor/target/release/rtg-motor', 'motor/target/release/rtg-sentinel'];
function cloneSetup(source, target, configPath, env = process.env) {
  const root = fs.realpathSync(source), gitDir = path.join(root, '.git');
  if (!fs.lstatSync(gitDir).isDirectory()) throw Error('Prepared candidate must have its own Git directory.');
  // Linux upload-pack may discard command-scope -c options. An explicit file
  // inherited through GIT_CONFIG_GLOBAL survives that subprocess boundary.
  // Production callers place this exclusive file in the disposable /work tmpfs;
  // no host/global settings are edited and only these two exact paths are safe.
  const file = path.join(fs.realpathSync(path.dirname(configPath)), path.basename(configPath));
  fs.writeFileSync(file, '[safe]\n\tdirectory = ' + JSON.stringify(root) + '\n\tdirectory = ' + JSON.stringify(gitDir) + '\n', { flag: 'wx', mode: 0o600 });
  return { args: ['clone', '--quiet', '--no-hardlinks', root, target],
    env: { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: file } };
}
function hashes(root, paths) {
  return Object.fromEntries(paths.map(p => [p, M.hash(fs.readFileSync(M.file(root, p)))]));
}
function prepared(root) {
  const cwd = path.join(root, 'motor'), run = (cmd, args) => cp.execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: 30000 }).trim();
  const compiler = run('rustup', ['which', 'rustc']), version = run(compiler, ['--version', '--verbose']);
  const channel = fs.readFileSync(path.join(root, SOURCES[0]), 'utf8').match(/^channel\s*=\s*"([^"]+)"/m)?.[1];
  if (!channel || !version.startsWith('rustc ' + channel + ' ')) throw Error('Rust compiler does not match the candidate toolchain pin.');
  const r = M.seal({ sourceFiles: hashes(root, SOURCES), binaries: hashes(root, BINARIES),
    compiler: { version, sha256: M.hash(fs.readFileSync(compiler)) } });
  verifyPrepared(root, r); return r;
}
function verifySources(root, r) {
  M.verify(r);
  if (JSON.stringify(r.sourceFiles) !== JSON.stringify(hashes(root, SOURCES)) ||
      JSON.stringify(Object.keys(r.binaries || {})) !== JSON.stringify(BINARIES) ||
      Object.values(r.binaries).some(h => !/^[a-f0-9]{64}$/.test(h)) || !/^[a-f0-9]{64}$/.test(r.compiler?.sha256 || '')) throw Error('Prepared runtime provenance mismatch.');
  const channel = fs.readFileSync(path.join(root, SOURCES[0]), 'utf8').match(/^channel\s*=\s*"([^"]+)"/m)?.[1];
  if (!channel || !r.compiler?.version.startsWith('rustc ' + channel + ' ')) throw Error('Prepared compiler pin mismatch.');
}
function verifyPrepared(root, r) {
  verifySources(root, r);
  if (JSON.stringify(r.binaries) !== JSON.stringify(hashes(root, BINARIES))) throw Error('Prepared executable bytes changed.');
  for (const p of BINARIES) if (!(fs.statSync(M.file(root, p)).mode & 0o111)) throw Error('Prepared binary is not executable.');
}
module.exports = { SOURCES, BINARIES, cloneSetup, prepared, verifySources, verifyPrepared };
