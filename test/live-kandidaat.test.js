'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const release = require('../scripts/release-bewijs');
const bronRelease = require('../scripts/bron-release-bewijs');
const kandidaat = require('../scripts/lib/live-kandidaat');
const herkomst = require('../scripts/imageherkomst');

const APP_ID = 'sha256:' + 'b'.repeat(64);
const BACKUP_ID = 'sha256:' + 'c'.repeat(64);
const APP_DIGEST = 'sha256:' + 'd'.repeat(64);
const BACKUP_DIGEST = 'sha256:' + 'e'.repeat(64);

function schrijf(root, rel, inhoud) {
  const doel = path.join(root, rel);
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, inhoud);
}

function opstelling() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kandidaat-'));
  for (const [rel, inhoud] of Object.entries({
    'package.json': '{"name":"rtg-kandidaat","version":"1"}', 'package-lock.json': '{}',
    'server/app.js': 'module.exports=1', 'public/dist/app.js': 'bouw',
    'scripts/start.js': 'start', 'motor/src/lib.rs': 'pub fn x(){}',
    'motor/Cargo.toml': '[package]', 'motor/Cargo.lock': '',
    'rtg-motor': 'motor', 'rtg-sentinel': 'sentinel', 'BEGROTING.json': '{"grens":1}'
  })) schrijf(root, rel, inhoud);
  schrijf(root, '.gitignore', '.release/\n');
  fs.mkdirSync(path.join(root, '.release'), { recursive: true });
  const sleutels = herkomst.nieuweSleutel();
  schrijf(root, 'deploy/release-sleutel.pub', sleutels.publiek);
  const git = (...args) => spawnSync('git', args, { cwd:root, encoding:'utf8' });
  assert.equal(git('init', '--quiet').status, 0);
  assert.equal(git('config', 'user.email', 'candidate@test.invalid').status, 0);
  assert.equal(git('config', 'user.name', 'Candidate Test').status, 0);
  assert.equal(git('add', '.').status, 0);
  assert.equal(git('commit', '--quiet', '-m', 'candidate').status, 0);
  const commit = git('rev-parse', 'HEAD').stdout.trim();
  const APP_REF = 'ghcr.io/rtg/test:candidate-' + commit.slice(0, 12) + '-123';
  const BACKUP_REF = 'ghcr.io/rtg/test:candidate-backup-' + commit.slice(0, 12) + '-123';
  const bronManifest = bronRelease.maak(root);
  schrijf(root, kandidaat.REL.bron, JSON.stringify(bronManifest) + '\n');
  schrijf(root, kandidaat.REL.ciSuite, '{"suite":"green"}\n');
  schrijf(root, kandidaat.REL.ciSchermen, '{"screens":"green"}\n');
  schrijf(root, kandidaat.REL.ciPg, '{"pg":"green"}\n');
  const vorig = process.env.RTG_RELEASE_COMMIT;
  process.env.RTG_RELEASE_COMMIT = commit;
  const manifest = release.maakManifest(root);
  if (vorig === undefined) delete process.env.RTG_RELEASE_COMMIT;
  else process.env.RTG_RELEASE_COMMIT = vorig;
  manifest.bron.gewijzigd = false;
  const manifestBytes = JSON.stringify(manifest) + '\n';
  schrijf(root, kandidaat.REL.imageArtifact, manifestBytes);
  schrijf(root, kandidaat.REL.image, manifestBytes);
  const prive = crypto.createPrivateKey(sleutels.prive);
  const keten = (verwijzing, digest, sbomRel, herkomstRel) => {
    const sbom = herkomst.maakSbom({ app:{ naam:'rtg', versie:'1' }, image:verwijzing,
      os:[{ naam:'base', versie:'1', arch:'amd64' }], crates:[], npm:{ runtime:[], ontwikkeling:0 },
      node:'v26.0.0', bewijs:manifest, gemaakt:'2026-09-04T12:00:00.000Z',
      serie:'00000000-0000-4000-8000-000000000001' });
    const sbomBytes = Buffer.from(JSON.stringify(sbom) + '\n');
    schrijf(root, sbomRel, sbomBytes);
    const document = herkomst.maakHerkomst({ image:verwijzing, digest, sbomBytes,
      sbomComponenten:sbom.components.length, bewijs:manifest,
      bron:{ commit, boom:bronManifest.boom, werkboomSchoon:true },
      uitvoering:herkomst.uitvoeringHashes(root),
      bouw:{ draaier:'github-actions', workflow:'release-image', run:'123' },
      gemaakt:'2026-09-04T12:00:00.000Z' });
    document.handtekening = { algoritme:'ed25519', waarde:herkomst.teken(document, prive) };
    schrijf(root, herkomstRel, JSON.stringify(document) + '\n');
  };
  keten(APP_REF, APP_DIGEST, kandidaat.REL.sbom, kandidaat.REL.herkomst);
  keten(BACKUP_REF, BACKUP_DIGEST, kandidaat.REL.backupSbom, kandidaat.REL.backupHerkomst);
  const bron = { commit, boomVuil: false, herkomst: 'geverifieerd-imagebewijs',
    inhoudSha256: manifest.inhoudSha256 };
  schrijf(root, kandidaat.REL.pg, JSON.stringify({ formaat: 'rtg-pg-bewijs-v1',
    geslaagd:true, tapVolledig:true, tests:4, mislukt:0, geannuleerd:0,
    overgeslagen:0, todo:0, bron }) + '\n');
  schrijf(root, kandidaat.REL.golive, JSON.stringify({ formaat: 'rtg-golive-bewijs-v1',
    geslaagd: true, blokkers: 0, bron,
    redis:{ ok:true, tweeInstanties:true, pubsub:true, atomischeRateLimit:true,
      toegestaan:1, geweigerd:1, teller:2, opgeruimd:true, doelSha256:'c'.repeat(64) },
    gedeeldeMedia:{ ok:true, tweeInstanties:true, verwijderd:true, bytes:96,
      sha256:'d'.repeat(64), doelSha256:'e'.repeat(64) },
    alarmering:{ ok:true, status:204, doelSha256:'f'.repeat(64) } }) + '\n');
  kandidaat.schrijfRuntime(root, { commit, verwachteImageId: APP_ID,
    imageId: APP_ID, imageVerwijzing:APP_REF, imageDigest:APP_DIGEST,
    inhoudSha256: manifest.inhoudSha256 });
  return { root, commit, APP_REF, BACKUP_REF };
}

test('één kandidaat bindt bron, draaiend image, container-PG en container-golive', () => {
  const { root, commit, APP_REF, BACKUP_REF } = opstelling();
  try {
    kandidaat.maak(root, { commit, imageVerwijzing:APP_REF, imageDigest:APP_DIGEST,
      imageId: APP_ID, backupVerwijzing:BACKUP_REF, backupDigest:BACKUP_DIGEST,
      backupId: BACKUP_ID });
    assert.equal(kandidaat.controleer(root, commit).image.id, APP_ID);
    fs.appendFileSync(path.join(root, kandidaat.REL.pg), 'gewijzigd');
    assert.throws(() => kandidaat.controleer(root, commit), /onderbewijs|onleesbaar/,
      'een vervangen PG-bewijs mag niet stil bij dezelfde commit worden hergebruikt');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('een readinessbewijs van een ander image kan geen kandidaat worden', () => {
  const { root, commit, APP_REF } = opstelling();
  try {
    assert.throws(() => kandidaat.schrijfRuntime(root, { commit,
      verwachteImageId: APP_ID, imageId: BACKUP_ID, imageVerwijzing:APP_REF,
      imageDigest:APP_DIGEST, inhoudSha256: 'd'.repeat(64) }),
    /geen geldige commit/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('een kandidaat zonder actieve Redis-, media- en alarmproef blijft geblokkeerd', () => {
  const { root, commit, APP_REF, BACKUP_REF } = opstelling();
  try {
    const pad = path.join(root, kandidaat.REL.golive);
    const golive = JSON.parse(fs.readFileSync(pad, 'utf8'));
    delete golive.redis;
    fs.writeFileSync(pad, JSON.stringify(golive) + '\n');
    assert.throws(() => kandidaat.maak(root, { commit,
      imageVerwijzing:APP_REF, imageDigest:APP_DIGEST, imageId:APP_ID,
      backupVerwijzing:BACKUP_REF, backupDigest:BACKUP_DIGEST, backupId:BACKUP_ID }),
    /Redis-, gedeelde-media- of alarmbezorgingproeven/);
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
});

test('dezelfde committekst kan een gewijzigd CI-imageartefact niet verhullen', () => {
  const { root, commit, APP_REF, BACKUP_REF } = opstelling();
  try {
    const pad = path.join(root, kandidaat.REL.image);
    const image = JSON.parse(fs.readFileSync(pad, 'utf8'));
    const bestand = image.bestanden.find(b => b.pad === 'server/app.js');
    bestand.bytes = 9;
    bestand.sha256 = 'd'.repeat(64);
    image.inhoudSha256 = release.totaalHash(image.bestanden);
    fs.writeFileSync(pad, JSON.stringify(image) + '\n');
    assert.throws(() => kandidaat.maak(root, { commit,
      imageVerwijzing:APP_REF, imageDigest:APP_DIGEST, imageId:APP_ID,
      backupVerwijzing:BACKUP_REF, backupDigest:BACKUP_DIGEST, backupId:BACKUP_ID }),
    /byte-voor-byte/);
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
});

test('SBOM, signer en registrydigest zijn geen verwisselbare kandidaatnotities', () => {
  for (const verander of [
    root => fs.appendFileSync(path.join(root, kandidaat.REL.sbom), 'x'),
    root => { const d = JSON.parse(fs.readFileSync(path.join(root, kandidaat.REL.herkomst)));
      d.image.digest = 'sha256:' + 'f'.repeat(64);
      fs.writeFileSync(path.join(root, kandidaat.REL.herkomst), JSON.stringify(d)); },
    root => fs.writeFileSync(path.join(root, 'deploy', 'release-sleutel.pub'),
      herkomst.nieuweSleutel().publiek)
  ]) {
    const { root, commit, APP_REF, BACKUP_REF } = opstelling();
    try {
      verander(root);
      assert.throws(() => kandidaat.maak(root, { commit,
        imageVerwijzing:APP_REF, imageDigest:APP_DIGEST, imageId:APP_ID,
        backupVerwijzing:BACKUP_REF, backupDigest:BACKUP_DIGEST, backupId:BACKUP_ID }),
      /herkomst|SBOM|handtekening|bronbewijs/i);
    } finally { fs.rmSync(root, { recursive:true, force:true }); }
  }
});

test('bevroren CI-unit-, scherm-, PG- en bronbewijs zijn signed provenance, geen losse notities', () => {
  for (const rel of [kandidaat.REL.ciSuite, kandidaat.REL.ciSchermen,
    kandidaat.REL.ciPg, kandidaat.REL.bron]) {
    const { root, commit, APP_REF, BACKUP_REF } = opstelling();
    try {
      fs.appendFileSync(path.join(root, rel), 'gewijzigd');
      assert.throws(() => kandidaat.maak(root, { commit,
        imageVerwijzing:APP_REF, imageDigest:APP_DIGEST, imageId:APP_ID,
        backupVerwijzing:BACKUP_REF, backupDigest:BACKUP_DIGEST, backupId:BACKUP_ID }),
      /bronbewijs|herkomst|onleesbaar/i, rel);
    } finally { fs.rmSync(root, { recursive:true, force:true }); }
  }
});
