'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), crypto = require('node:crypto');
const native = require('../scripts/lib/native-artifact');
const source = require('../scripts/bron-release-bewijs');
const candidate = require('../scripts/lib/native-kandidaat');
const trust = require('../server/config/release-trust');

test('native release weigert een ondertekend artifact met verkeerde Git-boom of broninventaris', t => {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-native-source-')));
  t.after(() => fs.rmSync(temp, { recursive:true, force:true }));
  const root = path.join(temp, 'repo'), payload = path.join(temp, 'payload'), env = {};
  fs.mkdirSync(path.join(root, 'deploy'), { recursive:true });
  for (const [role, info] of Object.entries(trust.ROLES)) {
    const keys = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(path.join(root, info.publicFile), keys.publicKey.export({ type:'spki', format:'pem' }));
    env[info.secret] = keys.privateKey.export({ type:'pkcs8', format:'pem' });
  }
  fs.writeFileSync(path.join(root, '.gitignore'), '.release/\n');
  const git = args => cp.execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
    '-c', 'user.name=Native fixture', '-c', 'user.email=native@example.test', ...args], { cwd:root, encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  git(['init', '-q']); git(['add', '.']); git(['commit', '-qm', 'Synthetic source']);
  const proof = source.maak(root);
  fs.mkdirSync(path.join(root, '.release/native'), { recursive:true });
  fs.writeFileSync(path.join(root, '.release/bron-release-bewijs.json'), JSON.stringify(proof));
  for (const name of ['runtime/node', 'app/package.json', 'app/release-bewijs.json', 'app/server/server.js']) {
    const file = path.join(payload, name); fs.mkdirSync(path.dirname(file), { recursive:true });
    fs.writeFileSync(file, 'synthetic', { mode:name === 'runtime/node' ? 0o500 : 0o400 });
  }
  for (const mutation of ['tree', 'sourceInventorySha256']) {
    const archive = path.join(temp, mutation + '.rtgp');
    const metadata = { commit:proof.commit, tree:proof.boom, platform:'darwin', arch:'arm64', node:'v26.10.0',
      buildId:'synthetic', builtAt:new Date().toISOString(), sourceInventorySha256:proof.inventarisSha256,
      buildConfigSha256:'b'.repeat(64) };
    metadata[mutation] = '0'.repeat(mutation === 'tree' ? 40 : 64);
    native.pack(payload, archive, metadata);
    const attestation = native.attest(archive, root, env);
    fs.copyFileSync(archive, path.join(root, candidate.REL.nativeArchive));
    fs.writeFileSync(path.join(root, candidate.REL.nativeAttestation), JSON.stringify(attestation));
    assert.throws(() => candidate.controleer(root, proof.commit), /exacte gecontroleerde Git-boom/);
  }
});
