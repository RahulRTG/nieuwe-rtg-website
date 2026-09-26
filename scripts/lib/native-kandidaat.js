'use strict';
const fs = require('node:fs'), path = require('node:path');
const native = require('./native-artifact');
const { canoniek } = require('../imageherkomst');
const PREFIX = '.release/native/';
const REL = Object.freeze({
  nativeArchive:PREFIX + 'candidate.rtgp', nativeAttestation:PREFIX + 'candidate.rtgp.attestation.json',
  nativeRuntime:PREFIX + 'RUNTIME-PROOF.json', nativeRollback:PREFIX + 'ROLLBACK-PROOF.json',
  nativePrevious:PREFIX + 'previous.rtgp', nativePreviousAttestation:PREFIX + 'previous.rtgp.attestation.json',
  nativeHost:PREFIX + 'HOST-CONFIG.json',
  releaseBewijs:PREFIX + 'app-release-bewijs.json'
});
const read = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name)));
function controleer(root, commit) {
  const attestation = read(root, REL.nativeAttestation);
  const candidate = native.verify(path.join(root, REL.nativeArchive), attestation, root, commit);
  const runtime = read(root, REL.nativeRuntime), runtimeHash = native.hashFile(path.join(root, REL.nativeRuntime));
  if (attestation.statement.runtimeProofSha256 !== runtimeHash || runtime.status !== 'PASS' ||
      runtime.commit !== commit || runtime.archiveSha256 !== candidate.archiveSha256 ||
      runtime.manifestSha256 !== candidate.manifestSha256)
    throw Error('Native runtimebewijs is niet door BUILD aan exact het artifact gebonden.');
  const release = candidate.manifest.files.find(f => f.path === 'app/release-bewijs.json');
  if (!release || release.sha256 !== native.hashFile(path.join(root, REL.releaseBewijs)))
    throw Error('Native app-inhoudsbewijs wijkt af van het bevroren pakket.');
  const previousAttestation = read(root, REL.nativePreviousAttestation);
  const previous = native.verify(path.join(root, REL.nativePrevious), previousAttestation, root, previousAttestation.statement.commit);
  if (previous.archiveSha256 === candidate.archiveSha256) throw Error('Dezelfde artifact herstarten is geen rollback.');
  const rollback = read(root, REL.nativeRollback), rollbackHash = native.hashFile(path.join(root, REL.nativeRollback));
  const external = require('../../server/config/external-release').controleerReleaseRoot(root, commit);
  if (!external.ok || !external.bewijsBestanden.some(b => b.controle === 'deploymentRollback' && b.sha256 === rollbackHash))
    throw Error('Native rollbackbytes zijn niet in het bevoegde externe dossier beoordeeld.');
  const phases = ['previous-baseline', 'candidate-mutation', 'rollback-previous', 'schema-integrity', 'candidate-again'];
  if (rollback.schema !== 'rtg-native-rollback-v1' || rollback.status !== 'PASS' || rollback.commit !== commit ||
      rollback.archiveSha256 !== candidate.archiveSha256 || rollback.previousSha256 !== previous.archiveSha256 ||
      !phases.every(name => rollback.steps?.some(s => s.name === name && s.status === 'PASS')) ||
      rollback.dataPreserved !== true || rollback.previousKnownGood !== true)
    throw Error('Native rollback mist artifact-, schema- of databehoudbewijs.');
  const hashes = Object.fromEntries(Object.entries(REL).map(([name, rel]) => [name, native.hashFile(path.join(root, rel))]));
  return { ok:true, soort:'native', commit, bewijsSha256:native.digest(canoniek(hashes)),
    artifact:{ digest:'sha256:' + candidate.archiveSha256, manifestSha256:candidate.manifestSha256,
      buildId:candidate.manifest.buildId, platform:candidate.manifest.platform, arch:candidate.manifest.arch,
      runtimeProofSha256:runtimeHash, attestationSha256:hashes.nativeAttestation },
    rollback:{ previousCommit:previous.manifest.commit, previousDigest:'sha256:' + previous.archiveSha256,
      proofSha256:rollbackHash, externalEvidenceBound:true } };
}
function geldig(k) {
  const hash = v => /^[a-f0-9]{64}$/.test(String(v || ''));
  const id = v => /^sha256:[a-f0-9]{64}$/.test(String(v || ''));
  return !!k && k.soort === 'native' && k.artifact?.platform === 'darwin' && k.artifact?.arch === 'arm64' &&
    id(k.artifact.digest) && hash(k.artifact.manifestSha256) && hash(k.artifact.runtimeProofSha256) &&
    hash(k.artifact.attestationSha256) && id(k.rollback?.previousDigest) && hash(k.rollback?.proofSha256) &&
    k.rollback.externalEvidenceBound === true && k.rollback.previousDigest !== k.artifact.digest;
}
module.exports = { REL, controleer, geldig };
