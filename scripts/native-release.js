#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const native = require('./lib/native-artifact');
const { canoniek } = require('./imageherkomst');

function run(command, args, cwd, env) {
  const r = cp.spawnSync(command, args, { cwd, env, stdio:'inherit', timeout:30 * 60 * 1000 });
  if (r.error || r.status !== 0) throw Error('Native bouwstap mislukt: ' + command + '.');
}
function build(root, output) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64' || Number(process.versions.node.split('.')[0]) !== 26)
    throw Error('De native kandidaat vereist macOS arm64 en Node 26.');
  const commit = require('./lib/productie-vrijgave').eisSchoneReleasebron(root);
  const source = require('./bron-release-bewijs').maak(root);
  // Geen runtimecredentials of signingkeys naar buildprocessen doorgeven.
  const env = {};
  for (const name of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'RUSTUP_HOME', 'CARGO_HOME'])
    if (process.env[name]) env[name] = process.env[name];
  Object.assign(env, { RTG_RELEASE_COMMIT:commit, CARGO_BUILD_JOBS:'2' });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-native-build-'));
  try {
    const sourceDir = path.join(temporary, 'source'), payload = path.join(temporary, 'payload');
    fs.mkdirSync(sourceDir); fs.mkdirSync(payload);
    const archive = path.join(temporary, 'source.tar');
    run('git', ['archive', '--format=tar', '--output=' + archive, commit], root, env);
    run('tar', ['-xf', archive, '-C', sourceDir], temporary, env);
    const sourceArchiveSha256 = native.hashFile(archive);
    run(process.execPath, ['scripts/build.js'], sourceDir, env);
    run('cargo', ['build', '--release', '--locked'], path.join(sourceDir, 'motor'), env);
    run(process.execPath, ['scripts/release-bewijs.js', '--uit', 'release-bewijs.json'], sourceDir, env);
    const proof = JSON.parse(fs.readFileSync(path.join(sourceDir, 'release-bewijs.json')));
    if (proof.bron.commit !== commit || proof.bron.gewijzigd !== false) throw Error('Native bronbinding is niet exact.');
    for (const name of [...proof.bestanden.map(f => f.pad), 'release-bewijs.json']) {
      const dest = path.join(payload, 'app', name);
      fs.mkdirSync(path.dirname(dest), { recursive:true });
      fs.copyFileSync(path.join(sourceDir, name), dest, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(dest, fs.statSync(path.join(sourceDir, name)).mode & 0o111 ? 0o500 : 0o400);
    }
    fs.mkdirSync(path.join(payload, 'runtime'));
    fs.copyFileSync(process.execPath, path.join(payload, 'runtime/node'));
    fs.chmodSync(path.join(payload, 'runtime/node'), 0o500);
    const config = {};
    for (const name of ['.nvmrc', 'package-lock.json', 'motor/Cargo.lock', 'motor/rust-toolchain.toml',
      '.github/workflows/release-native.yml', 'scripts/native-release.js', 'scripts/lib/native-artifact.js', 'scripts/build.js'])
      config[name] = native.hashFile(path.join(root, name));
    if (require('./lib/productie-vrijgave').eisSchoneReleasebron(root) !== commit)
      throw Error('De bron veranderde tijdens de native bouw.');
    const metadata = { commit, tree:source.boom, platform:process.platform, arch:process.arch, node:process.version,
      builtAt:new Date().toISOString(), buildId:process.env.GITHUB_RUN_ID
        ? 'github-' + process.env.GITHUB_RUN_ID + '-' + process.env.GITHUB_RUN_ATTEMPT : 'local-' + crypto.randomUUID(),
      sourceInventorySha256:source.inventarisSha256, sourceArchiveSha256,
      buildConfigSha256:native.digest(canoniek(config)), buildConfig:config,
      builder:{ os:os.release(), cargo:cp.execFileSync('cargo', ['--version'], { cwd:path.join(sourceDir, 'motor'), env, encoding:'utf8' }).trim(),
        repository:process.env.GITHUB_REPOSITORY || null, workflow:process.env.GITHUB_WORKFLOW_REF || null },
      boundary:'Native macOS app + Node + Rust. Host OS, launchd configuration, runtime data and secrets are external; no release approval.' };
    fs.mkdirSync(output, { recursive:true, mode:0o700 });
    const target = path.join(output, 'candidate.rtgp');
    const result = native.pack(payload, target, metadata);
    fs.writeFileSync(path.join(output, 'ARTIFACT-IDENTITY.json'), JSON.stringify({
      ...result, artifact:'candidate.rtgp', signature:'NOT_SIGNED', releaseStatus:'BLOCKED'
    }, null, 2) + '\n', { flag:'wx' });
    return result;
  } finally { fs.rmSync(temporary, { recursive:true, force:true }); }
}
function main(args) {
  const [mode, ...rest] = args;
  const root = path.resolve(__dirname, '..');
  if (mode === 'build' && rest.length === 1) {
    const result = build(root, path.resolve(rest[0]));
    console.log(JSON.stringify({ commit:result.manifest.commit, archiveSha256:result.archiveSha256, buildId:result.manifest.buildId }));
  } else if (mode === 'attest' && rest.length === 2) {
    const file = path.resolve(rest[0]), attestation = native.attest(file, root, process.env, rest[1]);
    fs.writeFileSync(file + '.attestation.json', JSON.stringify(attestation, null, 2) + '\n', { flag:'wx', mode:0o600 });
    console.log('BUILD-herkomst ondertekend; geen externe attestatie of promotie.');
  } else if (mode === 'verify' && rest.length === 2) {
    const [file, commit] = rest;
    const result = native.verify(file, JSON.parse(fs.readFileSync(file + '.attestation.json')), root, commit);
    console.log(JSON.stringify({ commit, archiveSha256:result.archiveSha256, buildId:result.manifest.buildId, verified:true }));
  } else if (mode === 'stage' && rest.length === 3) {
    const [file, commit, store] = rest;
    console.log(native.stage(file, JSON.parse(fs.readFileSync(file + '.attestation.json')), root, commit, path.resolve(store)));
  } else throw Error('Gebruik: native-release.js build UITMAP | attest PAKKET PROEF | verify PAKKET COMMIT | stage PAKKET COMMIT STORE. Stage activeert niets.');
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error('[native-release] ' + e.message); process.exitCode = 1; } }
module.exports = { build, main };
