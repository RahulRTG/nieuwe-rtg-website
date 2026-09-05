'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const release = require('../release-bewijs');
const bronRelease = require('../bron-release-bewijs');
const herkomst = require('../imageherkomst');

const REL = Object.freeze({ kandidaat: '.release/live-kandidaat.json',
  image: '.release/live-kandidaat-image-bewijs.json',
  imageArtifact: '.release/image-release-bewijs.json',
  bron: '.release/bron-release-bewijs.json', pg: '.release/pg-bewijs.json',
  ciSuite: '.release/ci-suite.json',
  ciSchermen: '.release/ci-schermsuite-bewijs.json',
  ciPg: '.release/ci-pg-bewijs.json',
  golive: '.release/golive-bewijs.json', runtime: '.release/live-kandidaat-runtime-bewijs.json',
  sbom:'.release/sbom.json', herkomst:'.release/herkomst.json',
  backupSbom:'.release/sbom-backup.json', backupHerkomst:'.release/herkomst-backup.json' });
const geldigId = id => /^sha256:[a-f0-9]{64}$/.test(String(id || ''));
const geldigDigest = geldigId;
const geldigeVerwijzing = (waarde, backup) => {
  const soort = backup ? 'candidate-backup-' : 'candidate-';
  return new RegExp('^ghcr\\.io/[a-z0-9][a-z0-9._/-]*:' + soort + '[a-f0-9]{12}-[1-9][0-9]*$')
    .test(String(waarde || ''));
};
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

function lees(root, rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch (e) { throw new Error('Kandidaatbewijs ontbreekt of is onleesbaar: ' + rel + '.'); }
}
function bestandHash(root, rel) { return hash(fs.readFileSync(path.join(root, rel))); }

function controleerKeten(root, { commit, verwijzing, digest, backup, inhoudSha256, bronBoom }) {
  const documentRel = backup ? REL.backupHerkomst : REL.herkomst;
  const sbomRel = backup ? REL.backupSbom : REL.sbom;
  if (!geldigeVerwijzing(verwijzing, backup) || !geldigDigest(digest))
    throw new Error('Kandidaat heeft geen veilige unieke registryverwijzing en digest.');
  let document, sbomBytes, publiek;
  try {
    document = lees(root, documentRel);
    sbomBytes = fs.readFileSync(path.join(root, sbomRel));
    publiek = fs.readFileSync(path.join(root, 'deploy', 'release-sleutel.pub'), 'utf8');
  } catch (e) { throw new Error('Getekende imageherkomst/SBOM ontbreekt voor de kandidaat.'); }
  const controle = herkomst.controleerKandidaatHerkomst({ document, sbomBytes,
    publiekPem:publiek, draait:digest, commit, image:verwijzing,
    bewijsInhoudSha256:inhoudSha256, uitvoering:herkomst.uitvoeringHashes(root) });
  if (!controle.ok) throw new Error('Getekende kandidaat-herkomst is ongeldig: ' + controle.klachten.join(' '));
  if (!document.bron || document.bron.boom !== bronBoom)
    throw new Error('Getekende kandidaat-herkomst hoort niet bij het gecontroleerde CI-bronbewijs.');
  return { verwijzing, digest, immutable:verwijzing + '@' + digest,
    herkomstSha256:bestandHash(root, documentRel), sbomSha256:bestandHash(root, sbomRel) };
}

function controleerBron(root, commit) {
  const bron = lees(root, REL.bron);
  const controle = bronRelease.controleer(root, bron, commit);
  if (!controle.ok)
    throw new Error('Het CI-bronbewijs is niet geldig voor exact deze huidige Git-boom: ' +
      controle.fouten.join(' '));
  return bron;
}

function controleerInvoer(root, commit, keten) {
  const image = lees(root, REL.image);
  const imageArtifact = lees(root, REL.imageArtifact);
  const bron = controleerBron(root, commit);
  const pg = lees(root, REL.pg);
  const golive = lees(root, REL.golive);
  const runtime = lees(root, REL.runtime);
  if (image.formaat !== 'rtg-release-bewijs-v1' || !image.bron || image.bron.commit !== commit ||
      image.bron.gewijzigd !== false || !Array.isArray(image.bestanden) ||
      image.bestandAantal !== image.bestanden.length ||
      image.inhoudSha256 !== release.totaalHash(image.bestanden))
    throw new Error('Het interne imagebewijs is niet geldig voor exact deze commit.');
  if (imageArtifact.formaat !== 'rtg-release-bewijs-v1' ||
      !Buffer.from(fs.readFileSync(path.join(root, REL.imageArtifact)))
        .equals(Buffer.from(fs.readFileSync(path.join(root, REL.image)))))
    throw new Error('Het runtime-imagebewijs wijkt byte-voor-byte af van het CI-imageartefact.');
  if (pg.formaat !== 'rtg-pg-bewijs-v1' || pg.geslaagd !== true || pg.tapVolledig !== true ||
      pg.mislukt !== 0 || pg.geannuleerd !== 0 || pg.overgeslagen !== 0 || pg.todo !== 0 ||
      !pg.tests || !pg.bron || pg.bron.commit !== commit || pg.bron.boomVuil !== false ||
      pg.bron.herkomst !== 'geverifieerd-imagebewijs' || pg.bron.inhoudSha256 !== image.inhoudSha256)
    throw new Error('PostgreSQL/Redis is niet vers op exact dit kandidaatimage bewezen.');
  if (golive.formaat !== 'rtg-golive-bewijs-v1' || golive.geslaagd !== true || golive.blokkers !== 0 ||
      !golive.bron || golive.bron.commit !== commit || golive.bron.boomVuil !== false ||
      golive.bron.herkomst !== 'geverifieerd-imagebewijs' ||
      golive.bron.inhoudSha256 !== image.inhoudSha256)
    throw new Error('De container-golive is niet groen op exact dit kandidaatimage.');
  const uitgangen = require('./golive-uitgangen');
  if (!uitgangen.redisBewijsGeldig(golive.redis) ||
      !uitgangen.mediaBewijsGeldig(golive.gedeeldeMedia) ||
      !uitgangen.alarmBewijsGeldig(golive.alarmering))
    throw new Error('De container-golive mist actieve Redis-, gedeelde-media- of alarmbezorgingproeven.');
  if (runtime.formaat !== 'rtg-live-runtime-bewijs-v1' || runtime.commit !== commit ||
      runtime.imageId !== runtime.verifieerdeImageId || runtime.imageId !== runtime.verwachteImageId ||
      runtime.imageDigest !== keten.imageDigest || runtime.imageVerwijzing !== keten.imageVerwijzing ||
      runtime.imageInhoudSha256 !== image.inhoudSha256 || runtime.ready !== true || runtime.probe !== true)
    throw new Error('Het kandidaatproces heeft geen geldige readiness- en probereis doorlopen.');
  const appKeten = controleerKeten(root, { commit, verwijzing:keten.imageVerwijzing,
    digest:keten.imageDigest, inhoudSha256:image.inhoudSha256, bronBoom:bron.boom, backup:false });
  const backupKeten = controleerKeten(root, { commit, verwijzing:keten.backupVerwijzing,
    digest:keten.backupDigest, inhoudSha256:image.inhoudSha256, bronBoom:bron.boom, backup:true });
  return { image, imageArtifact, bron, pg, golive, runtime, appKeten, backupKeten };
}

function schrijfRuntime(root, gegevens) {
  const commit = String(gegevens.commit || '').toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit) || !geldigId(gegevens.imageId) ||
      !geldigId(gegevens.verwachteImageId) || gegevens.imageId !== gegevens.verwachteImageId ||
      !geldigeVerwijzing(gegevens.imageVerwijzing, false) || !geldigDigest(gegevens.imageDigest) ||
      !/^[a-f0-9]{64}$/.test(String(gegevens.inhoudSha256 || '')))
    throw new Error('Runtimebewijs heeft geen geldige commit, image-ID of inhoudshash.');
  const rapport = { formaat: 'rtg-live-runtime-bewijs-v1', afgerond: new Date().toISOString(),
    commit, verwachteImageId: gegevens.verwachteImageId, verifieerdeImageId: gegevens.imageId,
    imageId: gegevens.imageId, imageVerwijzing:gegevens.imageVerwijzing,
    imageDigest:gegevens.imageDigest, imageInhoudSha256: gegevens.inhoudSha256,
    ready: true, probe: true,
    grens: 'Dit bewijst kandidaat-readiness en de interne SLO-reis; de aparte externe deploymentRollback-controle blijft verplicht.' };
  const doel = path.join(root, REL.runtime);
  const tmp = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(rapport, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, doel);
  return rapport;
}

function maak(root, gegevens) {
  const commit = String(gegevens.commit || '').toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit) || !geldigId(gegevens.imageId) || !geldigId(gegevens.backupId))
    throw new Error('Kandidaatcommit of image-id is ongeldig.');
  const keten = { imageVerwijzing:gegevens.imageVerwijzing, imageDigest:gegevens.imageDigest,
    backupVerwijzing:gegevens.backupVerwijzing, backupDigest:gegevens.backupDigest };
  const invoer = controleerInvoer(root, commit, keten);
  if (invoer.runtime.imageId !== gegevens.imageId)
    throw new Error('Het gestarte kandidaatproces draaide niet uit de vast te leggen image-ID.');
  const rapport = { formaat: 'rtg-live-kandidaat-v1', gemaakt: new Date().toISOString(),
    commit, image: { ...invoer.appKeten, id: gegevens.imageId,
      bewijsInhoudSha256: invoer.image.inhoudSha256,
      bewijsBestandSha256: bestandHash(root, REL.image) },
    bronBewijsBoom: invoer.bron.boom,
    backup: { ...invoer.backupKeten, id: gegevens.backupId },
    bronnen: { bron: bestandHash(root, REL.bron), imageArtifact:bestandHash(root, REL.imageArtifact),
      ciSuite:bestandHash(root, REL.ciSuite), ciSchermen:bestandHash(root, REL.ciSchermen),
      ciPg:bestandHash(root, REL.ciPg), pg: bestandHash(root, REL.pg),
      golive: bestandHash(root, REL.golive), runtime: bestandHash(root, REL.runtime),
      herkomst:invoer.appKeten.herkomstSha256, sbom:invoer.appKeten.sbomSha256,
      backupHerkomst:invoer.backupKeten.herkomstSha256,
      backupSbom:invoer.backupKeten.sbomSha256 } };
  rapport.bewijsSha256 = hash(JSON.stringify(rapport));
  const doel = path.join(root, REL.kandidaat);
  const tmp = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(rapport, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, doel);
  return rapport;
}

function controleer(root, commit) {
  const rapport = lees(root, REL.kandidaat);
  const pin = rapport.bewijsSha256;
  const zonder = { ...rapport }; delete zonder.bewijsSha256;
  if (rapport.formaat !== 'rtg-live-kandidaat-v1' || rapport.commit !== commit ||
      !/^[a-f0-9]{64}$/.test(String(pin || '')) || pin !== hash(JSON.stringify(zonder)) ||
      !geldigId(rapport.image && rapport.image.id) || !geldigId(rapport.backup && rapport.backup.id))
    throw new Error('Live-kandidaatbewijs is ongeldig of hoort niet bij HEAD.');
  const invoer = controleerInvoer(root, commit, {
    imageVerwijzing:rapport.image && rapport.image.verwijzing,
    imageDigest:rapport.image && rapport.image.digest,
    backupVerwijzing:rapport.backup && rapport.backup.verwijzing,
    backupDigest:rapport.backup && rapport.backup.digest
  });
  if (rapport.image.bewijsInhoudSha256 !== invoer.image.inhoudSha256 ||
      rapport.bronBewijsBoom !== invoer.bron.boom ||
      rapport.image.bewijsBestandSha256 !== bestandHash(root, REL.image) ||
      rapport.bronnen.bron !== bestandHash(root, REL.bron) ||
      rapport.bronnen.imageArtifact !== bestandHash(root, REL.imageArtifact) ||
      rapport.bronnen.ciSuite !== bestandHash(root, REL.ciSuite) ||
      rapport.bronnen.ciSchermen !== bestandHash(root, REL.ciSchermen) ||
      rapport.bronnen.ciPg !== bestandHash(root, REL.ciPg) ||
      rapport.bronnen.pg !== bestandHash(root, REL.pg) ||
      rapport.bronnen.golive !== bestandHash(root, REL.golive) ||
      rapport.bronnen.runtime !== bestandHash(root, REL.runtime) ||
      rapport.bronnen.herkomst !== invoer.appKeten.herkomstSha256 ||
      rapport.bronnen.sbom !== invoer.appKeten.sbomSha256 ||
      rapport.bronnen.backupHerkomst !== invoer.backupKeten.herkomstSha256 ||
      rapport.bronnen.backupSbom !== invoer.backupKeten.sbomSha256)
    throw new Error('Een kandidaat-onderbewijs wijzigde na de containerkeuring.');
  return rapport;
}

module.exports = { REL, geldigId, geldigDigest, geldigeVerwijzing, controleerBron,
  schrijfRuntime, maak, controleer };
