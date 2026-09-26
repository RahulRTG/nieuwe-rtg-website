'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const native = require('../scripts/lib/native-artifact');
const trust = require('../server/config/release-trust');
const { canoniek } = require('../scripts/imageherkomst');
const commit = 'a'.repeat(40);

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-native-fixture-')));
  t.after(() => fs.rmSync(dir, { recursive:true, force:true }));
  const root = path.join(dir, 'trust'), payload = path.join(dir, 'payload'), store = path.join(dir, 'store');
  fs.mkdirSync(path.join(root, 'deploy'), { recursive:true }); fs.mkdirSync(store);
  const keys = {}, env = {};
  for (const [role, info] of Object.entries(trust.ROLES)) {
    keys[role] = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(path.join(root, info.publicFile), keys[role].publicKey.export({ type:'spki', format:'pem' }));
    env[info.secret] = keys[role].privateKey.export({ type:'pkcs8', format:'pem' });
  }
  for (const [name, value] of Object.entries({ 'runtime/node':'synthetic executable, never run',
    'app/package.json':'{}', 'app/release-bewijs.json':'{}', 'app/server/server.js':'synthetic source' })) {
    fs.mkdirSync(path.dirname(path.join(payload, name)), { recursive:true });
    fs.writeFileSync(path.join(payload, name), value, { mode:name === 'runtime/node' ? 0o500 : 0o400 });
  }
  const archive = path.join(dir, 'candidate.rtgp');
  const metadata = { commit, tree:'b'.repeat(40), platform:'darwin', arch:'arm64', node:'v26.10.0',
    buildId:'synthetic-test', builtAt:new Date().toISOString(), sourceInventorySha256:'c'.repeat(64), buildConfigSha256:'d'.repeat(64) };
  const packed = native.pack(payload, archive, metadata);
  const attestation = native.attest(archive, root, env);
  return { dir, root, payload, store, archive, metadata, packed, attestation, keys, env };
}

test('native artifact: getekende exacte bytes worden staged, nooit geactiveerd of herbouwd', t => {
  const f = fixture(t);
  const p = native.verify(f.archive, f.attestation, f.root, commit);
  const target = native.stage(f.archive, f.attestation, f.root, commit, f.store);
  assert.equal(path.basename(target), p.archiveSha256);
  assert.equal(native.verifyInstalled(target, p.manifest), true);
  assert.equal(fs.existsSync(path.join(f.store, 'current')), false);
  assert.equal(native.stage(f.archive, f.attestation, f.root, commit, f.store), target);
});
test('native artifact: een losse PASS, eigen sleutel of verkeerde commit geeft geen buildgezag', t => {
  const f = fixture(t);
  assert.throws(() => native.verify(f.archive, { PASS:true }, f.root, commit), /handtekening/);
  assert.throws(() => native.verify(f.archive, f.attestation, f.root, 'e'.repeat(40)), /commitbinding/);
  const fake = crypto.generateKeyPairSync('ed25519');
  const spoof = { ...f.attestation, signature:trust.sign('BUILD', Buffer.from(canoniek(f.attestation.statement)), fake.privateKey) };
  assert.throws(() => native.verify(f.archive, spoof, f.root, commit), /handtekening/);
});
test('native artifact: evidence- en promotiesleutel kunnen geen BUILD-authority vervangen', t => {
  const f = fixture(t), bytes = Buffer.from(canoniek(f.attestation.statement));
  for (const role of ['EVIDENCE', 'PROMOTION']) {
    for (const domain of [role, 'BUILD']) {
      const signature = trust.sign(domain, bytes, f.keys[role].privateKey);
      assert.throws(() => native.verify(f.archive, { ...f.attestation, signature }, f.root, commit), /handtekening/);
    }
  }
  assert.equal(trust.verify('PROMOTION', bytes, f.attestation.signature, f.keys.BUILD.publicKey), false);
});
test('native artifact: gewijzigde inhoud en afgebroken overdracht worden geweigerd', t => {
  const f = fixture(t), bytes = fs.readFileSync(f.archive);
  const altered = Buffer.from(bytes); altered[altered.length - 1] ^= 1;
  fs.writeFileSync(f.archive, altered);
  assert.throws(() => native.verify(f.archive, f.attestation, f.root, commit), /gewijzigd/);
  assert.throws(() => native.inspect(f.archive), /bestandsdigest/);
  fs.writeFileSync(f.archive, bytes.subarray(0, bytes.length - 1));
  assert.throws(() => native.inspect(f.archive), /pakketlengte/);
});
test('native artifact: manifestwijziging krijgt niet stilzwijgend dezelfde identiteit', t => {
  const f = fixture(t), altered = structuredClone(f.attestation);
  altered.statement.manifestSha256 = '0'.repeat(64);
  assert.throws(() => native.verify(f.archive, altered, f.root, commit), /handtekening/);
  altered.signature = trust.sign('BUILD', Buffer.from(canoniek(altered.statement)), f.keys.BUILD.privateKey);
  assert.throws(() => native.verify(f.archive, altered, f.root, commit), /herkomstbinding/);
});
test('native artifact: traversal, dubbele paden, symlinks, hardlinks en ontbrekende runtime worden geweigerd', t => {
  const f = fixture(t);
  for (const bad of ['app/../../escape', '/tmp/escape', 'app/a\\b', 'runtime/../escape']) {
    const m = structuredClone(f.packed.manifest); m.files[0].path = bad;
    assert.throws(() => native.validateManifest(m), /pakketpad/);
  }
  const duplicate = structuredClone(f.packed.manifest); duplicate.files.push(duplicate.files[0]);
  assert.throws(() => native.validateManifest(duplicate), /dubbele/);
  const absent = structuredClone(f.packed.manifest); absent.files = absent.files.filter(x => x.path !== 'runtime/node');
  assert.throws(() => native.validateManifest(absent), /manifest|onvolledig/);
  fs.symlinkSync('/etc/passwd', path.join(f.payload, 'app/link'));
  assert.throws(() => native.inventory(f.payload), /Symlink/);
  fs.unlinkSync(path.join(f.payload, 'app/link'));
  fs.linkSync(path.join(f.payload, 'app/package.json'), path.join(f.payload, 'app/hardlink'));
  assert.throws(() => native.inventory(f.payload), /regulier/);
});
test('native artifact: wijzigingen, toevoegingen en executable-bit na staging blokkeren hergebruik', t => {
  const f = fixture(t), target = native.stage(f.archive, f.attestation, f.root, commit, f.store);
  const node = path.join(target, 'runtime/node');
  fs.chmodSync(node, 0o400);
  assert.throws(() => native.stage(f.archive, f.attestation, f.root, commit, f.store), /bytes wijken af/);
  fs.chmodSync(node, 0o500);
  fs.writeFileSync(path.join(target, 'app/unlisted.js'), 'outside manifest');
  assert.throws(() => native.verifyInstalled(target, f.packed.manifest), /bytes wijken af/);
});
test('native artifact: symbolic releasestore mag geen stage naar een andere omgeving omleiden', t => {
  const f = fixture(t), link = path.join(f.dir, 'linked-store'); fs.symlinkSync(f.store, link);
  assert.throws(() => native.stage(f.archive, f.attestation, f.root, commit, link), /releasestore/);
  assert.deepEqual(fs.readdirSync(f.store), []);
});
