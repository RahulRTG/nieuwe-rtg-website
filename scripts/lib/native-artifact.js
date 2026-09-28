'use strict';

// Native pakketten zijn geen OCI-images. Dit kleine, ongecomprimeerde formaat
// bevat één begrensd manifest en uitsluitend reguliere bestanden. Geen tar-
// links, extractiecommando's of door een artifact aangeleverde trust anchors.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const trust = require('../../server/config/release-trust');
const { canoniek } = require('../imageherkomst');
const MAGIC = Buffer.from('RTGNATIVE1\n');
const MAX_HEADER = 16 * 1024 * 1024;
const MAX_FILE = 256 * 1024 * 1024;
const MAX_PACKAGE = 8 * 1024 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function regular(file) {
  const s = fs.lstatSync(file);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1) throw Error('Geen zelfstandig regulier bestand: ' + file);
  return s;
}
function hashFile(file) {
  regular(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  const h = crypto.createHash('sha256'), b = Buffer.alloc(65536);
  try { for (;;) { const n = fs.readSync(fd, b, 0, b.length, null); if (!n) break; h.update(b.subarray(0, n)); } }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
}
function safePath(name) {
  if (typeof name !== 'string' || name.length > 1024 || /[\x00-\x1f\\:]/.test(name) ||
      !/^(app|runtime)\//.test(name) || name.split('/').some(s => !s || s === '.' || s === '..'))
    throw Error('Ongeldig pakketpad.');
  return name;
}
function inventory(root) {
  const files = [];
  function walk(rel) {
    const abs = path.join(root, rel), s = fs.lstatSync(abs);
    if (s.isSymbolicLink()) throw Error('Symlink in native pakket.');
    if (s.isDirectory()) { for (const name of fs.readdirSync(abs).sort()) walk(rel ? rel + '/' + name : name); return; }
    regular(abs); safePath(rel);
    if (s.size > MAX_FILE || files.length >= 20000) throw Error('Native pakket overschrijdt de bestandsgrens.');
    files.push({ path:rel, bytes:s.size, sha256:hashFile(abs), executable:!!(s.mode & 0o111) });
  }
  walk('');
  return files;
}
function validateManifest(m) {
  if (!m || m.schema !== 'rtg-native-artifact-v1' || !SHA.test(m.commit || '') || !SHA.test(m.tree || '') ||
      m.platform !== 'darwin' || m.arch !== 'arm64' || !/^v26\.\d+\.\d+$/.test(m.node || '') ||
      !/^[A-Za-z0-9._-]{1,120}$/.test(m.buildId || '') || !Number.isFinite(Date.parse(m.builtAt)) ||
      !HASH.test(m.sourceInventorySha256 || '') || !HASH.test(m.buildConfigSha256 || '') ||
      !Array.isArray(m.files) || m.files.length < 4 || m.files.length > 20000)
    throw Error('Ongeldig native manifest.');
  let total = 0, previous = '';
  const names = new Set();
  for (const f of m.files) {
    safePath(f.path);
    if (f.path <= previous || !HASH.test(f.sha256 || '') || typeof f.executable !== 'boolean' ||
        !Number.isSafeInteger(f.bytes) || f.bytes < 0 || f.bytes > MAX_FILE)
      throw Error('Ongeldige of dubbele native bestandsinvoer.');
    previous = f.path; total += f.bytes; names.add(f.path);
  }
  if (total > MAX_PACKAGE || !['runtime/node', 'app/server/server.js', 'app/release-bewijs.json', 'app/package.json']
    .every(p => names.has(p))) throw Error('Native pakket is onvolledig of te groot.');
  if (!m.files.find(f => f.path === 'runtime/node').executable) throw Error('Node is niet uitvoerbaar.');
  return total;
}
function pack(root, target, metadata) {
  const files = inventory(root).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = { ...metadata, schema:'rtg-native-artifact-v1', files };
  validateManifest(manifest);
  const header = Buffer.from(canoniek(manifest));
  if (header.length > MAX_HEADER) throw Error('Native manifest te groot.');
  const length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  const out = fs.openSync(target, 'wx', 0o600), buffer = Buffer.alloc(65536);
  try {
    fs.writeSync(out, MAGIC); fs.writeSync(out, length); fs.writeSync(out, header);
    for (const f of files) {
      const input = fs.openSync(path.join(root, f.path), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try { for (;;) { const n = fs.readSync(input, buffer, 0, buffer.length, null); if (!n) break; fs.writeSync(out, buffer, 0, n); } }
      finally { fs.closeSync(input); }
    }
    fs.fsyncSync(out);
  } finally { fs.closeSync(out); }
  // Controleer de verpakte bytes, niet slechts de bron vóór het kopiëren.
  inspect(target);
  return { manifest, archiveSha256:hashFile(target), manifestSha256:digest(header), bytes:regular(target).size };
}
function exactRead(fd, n) {
  const b = Buffer.alloc(n); let done = 0;
  while (done < n) { const got = fs.readSync(fd, b, done, n - done, null); if (!got) throw Error('Afgebroken native pakket.'); done += got; }
  return b;
}
// inspect bewijst alleen integriteit. stage vereist daarnaast BUILD-authority.
function inspect(file, destination) {
  const stat = regular(file);
  if (stat.size > MAX_PACKAGE + MAX_HEADER + 15) throw Error('Native pakket te groot.');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!exactRead(fd, MAGIC.length).equals(MAGIC)) throw Error('Onbekend native pakketformaat.');
    const len = exactRead(fd, 4).readUInt32BE();
    if (len < 2 || len > MAX_HEADER) throw Error('Ongeldige native headerlengte.');
    const header = exactRead(fd, len), manifest = JSON.parse(header);
    const total = validateManifest(manifest);
    if (stat.size !== MAGIC.length + 4 + len + total) throw Error('Native pakketlengte wijkt af.');
    for (const f of manifest.files) {
      let out;
      if (destination) {
        const target = path.join(destination, f.path);
        fs.mkdirSync(path.dirname(target), { recursive:true, mode:0o700 });
        out = fs.openSync(target, 'wx', f.executable ? 0o500 : 0o400);
      }
      const h = crypto.createHash('sha256');
      try {
        for (let remaining = f.bytes; remaining > 0;) {
          const b = exactRead(fd, Math.min(remaining, 65536)); remaining -= b.length; h.update(b);
          if (out !== undefined) fs.writeSync(out, b);
        }
      } finally { if (out !== undefined) fs.closeSync(out); }
      if (h.digest('hex') !== f.sha256) throw Error('Native bestandsdigest wijkt af: ' + f.path);
    }
    return { manifest, manifestSha256:digest(header), archiveSha256:hashFile(file), bytes:stat.size };
  } finally { fs.closeSync(fd); }
}
function attest(file, root, env = process.env, runtimeProof) {
  const value = inspect(file);
  const statement = { schema:'rtg-native-build-v1', domain:trust.ROLES.BUILD.domain,
    commit:value.manifest.commit, buildId:value.manifest.buildId, archiveSha256:value.archiveSha256,
    manifestSha256:value.manifestSha256, bytes:value.bytes };
  if (runtimeProof) {
    const proof = JSON.parse(fs.readFileSync(runtimeProof));
    if (proof.schema !== 'rtg-native-rehearsal-v1' || proof.status !== 'PASS' || proof.commit !== statement.commit ||
        proof.archiveSha256 !== statement.archiveSha256 || proof.manifestSha256 !== statement.manifestSha256)
      throw Error('Native runtimebewijs hoort niet bij dit pakket of is niet geslaagd.');
    statement.runtimeProofSha256 = hashFile(runtimeProof);
  }
  const bytes = Buffer.from(canoniek(statement));
  const signature = trust.sign('BUILD', bytes, trust.authorizedPrivate(root, 'BUILD', env));
  return { statement, signature };
}
function verify(file, attestation, root, commit) {
  const { statement:s, signature } = attestation || {};
  if (!s || s.schema !== 'rtg-native-build-v1' || s.domain !== trust.ROLES.BUILD.domain ||
      !SHA.test(commit || '') || s.commit !== commit ||
      !trust.verify('BUILD', Buffer.from(canoniek(s)), signature, trust.anchors(root).BUILD.key))
    throw Error('Native BUILD-handtekening of commitbinding ongeldig.');
  if (hashFile(file) !== s.archiveSha256 || regular(file).size !== s.bytes) throw Error('Native artifact gewijzigd.');
  const value = inspect(file);
  if (value.manifestSha256 !== s.manifestSha256 || value.manifest.commit !== commit || value.manifest.buildId !== s.buildId)
    throw Error('Native herkomstbinding wijkt af.');
  return value;
}
function verifyInstalled(directory, manifest) {
  validateManifest(manifest);
  const actual = inventory(directory).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (canoniek(actual) !== canoniek(manifest.files)) throw Error('Geïnstalleerde native bytes wijken af.');
  return true;
}
function stage(file, attestation, trustRoot, commit, store) {
  const proof = verify(file, attestation, trustRoot, commit);
  const s = fs.lstatSync(store);
  if (!s.isDirectory() || s.isSymbolicLink() || fs.realpathSync(store) !== path.resolve(store))
    throw Error('Native releasestore moet een echte absolute map zijn.');
  const target = path.join(store, proof.archiveSha256);
  if (fs.existsSync(target)) { verifyInstalled(target, proof.manifest); return target; }
  const temporary = fs.mkdtempSync(path.join(store, '.native-stage-'));
  try {
    inspect(file, temporary); verifyInstalled(temporary, proof.manifest);
    // Controleer opnieuw vóór de atomische publicatie tegen dezelfde handtekening.
    verify(file, attestation, trustRoot, commit);
    fs.renameSync(temporary, target);
    return target;
  } catch (e) { fs.rmSync(temporary, { recursive:true, force:true }); throw e; }
}
module.exports = { MAGIC, digest, hashFile, inventory, validateManifest, pack, inspect, attest, verify, verifyInstalled, stage };
