'use strict';
/* Build, externe attestatie en promotie hebben afzonderlijke ankers en
   signaturedomeinen. Verkeerde rollen, legacy signatures, manipulatie,
   ontbrekende/gedeelde ankers en ingetrokken identiteiten worden geweigerd.
   Synthetische sleutels bewijzen geen echte releasebevoegdheid. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const trust = require('../server/config/release-trust');
const external = require('../server/config/external-release');
const image = require('../scripts/imageherkomst');
const { trustFixture } = require('./release-trust-fixture');
const { maakGetekendeVrijgave, COMMIT } = require('./foundation-vrijgave-fixture');
const names = Object.keys(trust.ROLES);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-trust-roles-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  return { root, keys:trustFixture(root) };
}

test('all 27 role/key/domain combinations accept only the expected key and domain', t => {
  const { keys } = fixture(t), bytes = Buffer.from('one exact statement');
  for (const owner of names) for (const domain of names) for (const verifier of names) {
    const signature = trust.sign(domain, bytes, keys[owner].privateKey);
    assert.equal(trust.verify(verifier, bytes, signature, keys[verifier].publicKey),
      owner === verifier && domain === verifier, `${owner}/${domain}/${verifier}`);
    assert.equal(trust.verify(verifier, Buffer.concat([bytes, Buffer.from('changed')]), signature, keys[verifier].publicKey), false);
  }
  assert.throws(() => trust.sign('toString', bytes, keys.BUILD.privateKey), /Onbekende/);
});

test('signer entry points require their own private key; legacy release secret never supplies evidence authority', t => {
  const { root, keys } = fixture(t);
  for (const target of names) for (const supplied of names) {
    const env = { [trust.ROLES[target].secret]:keys[supplied].privateKey.export({ type:'pkcs8', format:'pem' }) };
    if (target === supplied) assert.equal(trust.authorizedPrivate(root, target, env).type, 'private');
    else assert.throws(() => trust.authorizedPrivate(root, target, env), /vaste vertrouwensanker/);
  }
  const old = { RTG_RELEASE_SIGN_KEY:keys.BUILD.privateKey.export({ type:'pkcs8', format:'pem' }) };
  assert.throws(() => require('../scripts/external-release-teken').priveSleutel(old), /RTG_EVIDENCE_SIGN_KEY ontbreekt/);
  assert.throws(() => trust.authorizedPrivate(root, 'PROMOTION', old), /RTG_PROMOTION_SIGN_KEY ontbreekt/);
});

test('each shared-key pair and each missing anchor is rejected before authority is granted', t => {
  const { root, keys } = fixture(t);
  const restore = () => names.forEach(name => fs.writeFileSync(path.join(root, trust.ROLES[name].publicFile), keys[name].publicKey.export({ type:'spki', format:'pem' })));
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    restore(); fs.copyFileSync(path.join(root, trust.ROLES[names[i]].publicFile), path.join(root, trust.ROLES[names[j]].publicFile));
    assert.throws(() => trust.anchors(root), /drie verschillende/);
  }
  for (const name of names) {
    restore(); fs.unlinkSync(path.join(root, trust.ROLES[name].publicFile));
    assert.throws(() => trust.anchors(root), /ontbreekt of is ongeldig/);
  }
  restore();
  fs.writeFileSync(path.join(root, trust.ROLES.EVIDENCE.publicFile), '-----BEGIN PRIVATE KEY-----\nnot-a-private-key\n-----END PRIVATE KEY-----\n');
  assert.throws(() => trust.anchors(root), /ongeldig/);
});

test('evidence verifier rejects build/promotion signers even when they use the correct evidence domain', t => {
  const { root, keys } = fixture(t);
  const { dossierBytes } = maakGetekendeVrijgave(root, { sleutels:keys.EVIDENCE, runtimeBewijs:false });
  assert.equal(external.controleerReleaseRoot(root, COMMIT).ok, true);
  for (const wrong of ['BUILD', 'PROMOTION']) {
    fs.writeFileSync(path.join(root, '.release/external-release.sig'), trust.sign('EVIDENCE', dossierBytes, keys[wrong].privateKey));
    assert.equal(external.controleerReleaseRoot(root, COMMIT).reden, 'handtekening-klopt-niet');
  }
  fs.writeFileSync(path.join(root, '.release/external-release.sig'), trust.sign('BUILD', dossierBytes, keys.EVIDENCE.privateKey));
  assert.equal(external.controleerReleaseRoot(root, COMMIT).reden, 'handtekening-klopt-niet');
});

test('old external format, unframed legacy signature and relabelled domain are rejected, with no fallback', t => {
  const { root, keys } = fixture(t);
  const { dossier, dossierBytes } = maakGetekendeVrijgave(root, { sleutels:keys.EVIDENCE, runtimeBewijs:false });
  const sig = path.join(root, '.release/external-release.sig');
  fs.writeFileSync(sig, crypto.sign(null, dossierBytes, keys.EVIDENCE.privateKey).toString('base64'));
  assert.equal(external.controleerReleaseRoot(root, COMMIT).reden, 'handtekening-klopt-niet');
  for (const patch of [{ formaat:'rtg-external-release-v2' }, { ondertekenDomein:trust.ROLES.BUILD.domain }]) {
    const bytes = Buffer.from(JSON.stringify({ ...dossier, ...patch }));
    fs.writeFileSync(path.join(root, '.release/external-release.json'), bytes);
    fs.writeFileSync(sig, trust.sign('EVIDENCE', bytes, keys.EVIDENCE.privateKey));
    assert.equal(external.controleerReleaseRoot(root, COMMIT).ok, false);
  }
});

test('rotated/revoked evidence identity does not revive old attestations', t => {
  const { root, keys } = fixture(t);
  maakGetekendeVrijgave(root, { sleutels:keys.EVIDENCE, runtimeBewijs:false });
  const fresh = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(root, trust.ROLES.EVIDENCE.publicFile), fresh.publicKey.export({ type:'spki', format:'pem' }));
  assert.equal(external.controleerReleaseRoot(root, COMMIT).reden, 'handtekening-klopt-niet');
  assert.throws(() => trust.authorizedPrivate(root, 'EVIDENCE', {
    RTG_EVIDENCE_SIGN_KEY:keys.EVIDENCE.privateKey.export({ type:'pkcs8', format:'pem' }) }), /vaste vertrouwensanker/);
});

test('build verifier rejects other authority keys, old format and raw unframed signatures', t => {
  const { keys } = fixture(t), sbom = Buffer.from('{"components":[]}');
  const doc = image.maakHerkomst({ image:'test', digest:'sha256:'+'a'.repeat(64), sbomBytes:sbom });
  const check = value => image.controleerHerkomst({ document:value, sbomBytes:sbom, publiekPem:keys.BUILD.publicKey.export({ type:'spki', format:'pem' }) }).ok;
  for (const role of names) {
    const signed = { ...doc, handtekening:{ algoritme:'ed25519', waarde:image.teken(doc, keys[role].privateKey) } };
    assert.equal(check(signed), role === 'BUILD');
  }
  const old = { ...doc, formaat:'rtg-herkomst-v1' };
  old.handtekening = { algoritme:'ed25519', waarde:image.teken(old, keys.BUILD.privateKey) };
  assert.equal(check(old), false);
  const raw = { ...doc, handtekening:{ algoritme:'ed25519', waarde:crypto.sign(null, Buffer.from(image.canoniek(doc)), keys.BUILD.privateKey).toString('base64') } };
  assert.equal(check(raw), false);
});

test('image CI receives only the build role and legacy key-print command emits no key material', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/release-image.yml'), 'utf8');
  assert.match(workflow, /secrets\.RTG_RELEASE_SIGN_KEY/);
  assert.doesNotMatch(workflow, /RTG_EVIDENCE_SIGN_KEY|RTG_PROMOTION_SIGN_KEY/);
  const result = cp.spawnSync(process.execPath, ['scripts/imageherkomst.js', '--nieuwe-sleutel'], { cwd:path.join(__dirname, '..'), encoding:'utf8' });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /BEGIN (?:PRIVATE|PUBLIC) KEY|RTG_RELEASE_SIGN_KEY=/);
  assert.match(result.stderr, /secret store/);
});
