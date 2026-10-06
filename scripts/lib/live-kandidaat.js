'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const release = require('../release-bewijs');
const bronRelease = require('../bron-release-bewijs');
const herkomst = require('../imageherkomst');
const trust = require('../../server/config/release-trust');

const REL = Object.freeze({ kandidaat: '.release/live-kandidaat.json',
  bootstrapKandidaat: '.release/live-bootstrap-kandidaat.json',
  ownerReadback: '.release/owner-readback-bewijs.json',
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
const OWNER_READBACK_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const OWNER_CLOCK_SKEW_MS = 2 * 60 * 1000;
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
    publiek = trust.anchors(root).BUILD.bytes;
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

/* De minimale kandidaatbinding voor een read-only meting op productie. Deze
   controle vraagt bewust nog niet om runtime/PG/golive: die bewijzen ontstaan
   later in dezelfde ronde. Wel staat hiermee vóór de productiedatabase wordt
   aangeraakt exact vast welke getekende bron en welk immutable image meet. */
function controleerOwnerImageBasis(root, commit, keten) {
  const image = lees(root, REL.image);
  const imageArtifact = lees(root, REL.imageArtifact);
  const bron = controleerBron(root, commit);
  if (image.formaat !== 'rtg-release-bewijs-v1' || !image.bron || image.bron.commit !== commit ||
      image.bron.gewijzigd !== false || !Array.isArray(image.bestanden) ||
      image.bestandAantal !== image.bestanden.length ||
      image.inhoudSha256 !== release.totaalHash(image.bestanden))
    throw new Error('Het interne imagebewijs is niet geldig voor exact deze commit.');
  if (imageArtifact.formaat !== 'rtg-release-bewijs-v1' ||
      !Buffer.from(fs.readFileSync(path.join(root, REL.imageArtifact)))
        .equals(Buffer.from(fs.readFileSync(path.join(root, REL.image)))))
    throw new Error('Het runtime-imagebewijs wijkt byte-voor-byte af van het CI-imageartefact.');
  const appKeten = controleerKeten(root, { commit, verwijzing:keten.imageVerwijzing,
    digest:keten.imageDigest, inhoudSha256:image.inhoudSha256, bronBoom:bron.boom, backup:false });
  return { image, imageArtifact, bron, appKeten };
}

const BOOTSTRAP_BLOKKADE = 'RTG_OWNER_BOOTSTRAP staat nog in de productieomgeving.';

function controleerGolive(golive, commit, image, bootstrapOnly) {
  const bronGoed = golive && golive.formaat === 'rtg-golive-bewijs-v1' &&
    golive.bron && golive.bron.commit === commit && golive.bron.boomVuil === false &&
    golive.bron.herkomst === 'geverifieerd-imagebewijs' &&
    golive.bron.inhoudSha256 === image.inhoudSha256;
  if (!bronGoed) throw new Error('De container-golive hoort niet aantoonbaar bij exact dit kandidaatimage.');
  if (!bootstrapOnly) {
    if (golive.geslaagd !== true || golive.blokkers !== 0)
      throw new Error('De container-golive is niet groen op exact dit kandidaatimage.');
    /* Het relais zelf, onafhankelijk van de blokkerteller: een golive zonder
       een ECHTE geslaagde TURN-relayproef over elk geconfigureerd adres
       promoveert niet, ook als iemand de teller ooit anders zou gaan tellen. */
    const t = golive.turnRelay;
    if (!t || t.ok !== true || !/^[a-f0-9]{64}$/.test(String(t.configVingerafdruk || '')) ||
        !Array.isArray(t.urls) || !t.urls.length ||
        !t.urls.every(u => u && u.ok === true && /^turns:/.test(String(u.url || '')) &&
          Number.isSafeInteger(u.bytesAB) && u.bytesAB >= 65536 &&
          Number.isSafeInteger(u.bytesBA) && u.bytesBA >= 65536))
      throw new Error('De container-golive mist een geslaagde echte TURN-relayproef over elk turns:-adres.');
    const owner = golive.ownerReadback;
    if (!owner || owner.formaat !== 'rtg-owner-readback-bewijs-v2' ||
        !/^[a-f0-9]{40,64}$/.test(String(owner.commit || '')) || !geldigId(owner.imageId) ||
        !/^[a-f0-9]{64}$/.test(String(owner.bewijsSha256 || '')) ||
        owner.postgresReadback !== true || owner.directReadOnly !== true ||
        owner.ownerAuthorized !== true ||
        !/^[a-f0-9]{64}$/.test(String(owner.ownerEmailSha256 || '')) ||
        !/^[a-f0-9]{64}$/.test(String(owner.databaseIdentitySha256 || '')) ||
        !/^[a-f0-9]{64}$/.test(String(owner.databaseSnapshotSha256 || '')) ||
        !Number.isFinite(Date.parse(owner.observedAt || '')) ||
        !Number.isFinite(Date.parse(owner.validUntil || '')) ||
        Date.parse(owner.validUntil) < Date.now())
      throw new Error('De container-golive mist het duurzame eigenaars-/PostgreSQL-readbackbewijs.');
    return;
  }
  const hard = Array.isArray(golive.controles) ? golive.controles.filter(x => x && x.hard) : [];
  if (golive.geslaagd !== false || golive.blokkers !== 1 || hard.length !== 1 ||
      !String(hard[0].tekst || '').startsWith(BOOTSTRAP_BLOKKADE)) {
    throw new Error('De eerste-eigenaarvoorbereiding staat alleen open wanneer RTG_OWNER_BOOTSTRAP de enige go-liveblokkade is.');
  }
}

function controleerInvoer(root, commit, keten, opties = {}) {
  const basis = controleerOwnerImageBasis(root, commit, keten);
  const { image, imageArtifact, bron, appKeten } = basis;
  const pg = lees(root, REL.pg);
  const golive = lees(root, REL.golive);
  const runtime = lees(root, REL.runtime);
  if (pg.formaat !== 'rtg-pg-bewijs-v1' || pg.geslaagd !== true || pg.tapVolledig !== true ||
      pg.mislukt !== 0 || pg.geannuleerd !== 0 || pg.overgeslagen !== 0 || pg.todo !== 0 ||
      !pg.tests || !pg.bron || pg.bron.commit !== commit || pg.bron.boomVuil !== false ||
      pg.bron.herkomst !== 'geverifieerd-imagebewijs' || pg.bron.inhoudSha256 !== image.inhoudSha256)
    throw new Error('PostgreSQL/Redis is niet vers op exact dit kandidaatimage bewezen.');
  controleerGolive(golive, commit, image, opties.bootstrapOnly === true);
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
  let ownerReadback = null;
  if (opties.bootstrapOnly !== true) {
    ownerReadback = controleerOwnerReadback(root, { commit, imageId:runtime.imageId,
      imageImmutable:appKeten.immutable, eisVers:true });
    if (!golive.ownerReadback || golive.ownerReadback.bewijsSha256 !== ownerReadback.bewijsSha256)
      throw new Error('De container-golive hoort niet bij de verse volledige eigenaars-readbackbytes.');
  }
  const backupKeten = controleerKeten(root, { commit, verwijzing:keten.backupVerwijzing,
    digest:keten.backupDigest, inhoudSha256:image.inhoudSha256, bronBoom:bron.boom, backup:true });
  return { image, imageArtifact, bron, pg, golive, runtime, ownerReadback, appKeten, backupKeten };
}

function bootstrapBronnen(root) {
  return { bron:bestandHash(root, REL.bron), imageArtifact:bestandHash(root, REL.imageArtifact),
    ciSuite:bestandHash(root, REL.ciSuite), ciSchermen:bestandHash(root, REL.ciSchermen),
    ciPg:bestandHash(root, REL.ciPg), pg:bestandHash(root, REL.pg),
    golive:bestandHash(root, REL.golive), runtime:bestandHash(root, REL.runtime),
    herkomst:bestandHash(root, REL.herkomst), sbom:bestandHash(root, REL.sbom),
    backupHerkomst:bestandHash(root, REL.backupHerkomst),
    backupSbom:bestandHash(root, REL.backupSbom) };
}

/* Een verse host heeft nog geen eigenaar, maar de normale go-livekeuring eist
   terecht dat het eenmalige bootstrapgeheim vóór een release weg is. Dit
   tussenbewijs doorbreekt die cirkel zonder een zwakkere release-uitspraak te
   maken: exact één blokkade is toegestaan, het is nooit een live-kandidaat en
   het wordt na de offline eigenaarsinitialisatie opnieuw volledig gekeurd. */
function maakBootstrap(root, gegevens) {
  const commit = String(gegevens.commit || '').toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit) || !geldigId(gegevens.imageId) || !geldigId(gegevens.backupId))
    throw new Error('Bootstrapkandidaatcommit of image-id is ongeldig.');
  const keten = { imageVerwijzing:gegevens.imageVerwijzing, imageDigest:gegevens.imageDigest,
    backupVerwijzing:gegevens.backupVerwijzing, backupDigest:gegevens.backupDigest };
  const invoer = controleerInvoer(root, commit, keten, { bootstrapOnly:true });
  if (invoer.runtime.imageId !== gegevens.imageId)
    throw new Error('Het gestarte kandidaatproces draaide niet uit de bootstrap-image-ID.');
  const rapport = { formaat:'rtg-live-bootstrap-kandidaat-v1', gemaakt:new Date().toISOString(),
    commit, uitsluitendEersteEigenaar:true,
    image:{ ...invoer.appKeten, id:gegevens.imageId,
      bewijsInhoudSha256:invoer.image.inhoudSha256,
      bewijsBestandSha256:bestandHash(root, REL.image) },
    backup:{ ...invoer.backupKeten, id:gegevens.backupId },
    bronnen:bootstrapBronnen(root) };
  rapport.bewijsSha256 = hash(JSON.stringify(rapport));
  const doel = path.join(root, REL.bootstrapKandidaat);
  const tmp = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(rapport, null, 2) + '\n', { mode:0o600 });
  fs.renameSync(tmp, doel);
  return rapport;
}

function controleerBootstrap(root, commit) {
  const rapport = lees(root, REL.bootstrapKandidaat);
  const pin = rapport.bewijsSha256;
  const zonder = { ...rapport }; delete zonder.bewijsSha256;
  if (rapport.formaat !== 'rtg-live-bootstrap-kandidaat-v1' ||
      rapport.uitsluitendEersteEigenaar !== true || rapport.commit !== commit ||
      !/^[a-f0-9]{64}$/.test(String(pin || '')) || pin !== hash(JSON.stringify(zonder)) ||
      !geldigId(rapport.image && rapport.image.id) || !geldigId(rapport.backup && rapport.backup.id))
    throw new Error('Bootstrapkandidaatbewijs is ongeldig of hoort niet bij HEAD.');
  const invoer = controleerInvoer(root, commit, {
    imageVerwijzing:rapport.image && rapport.image.verwijzing,
    imageDigest:rapport.image && rapport.image.digest,
    backupVerwijzing:rapport.backup && rapport.backup.verwijzing,
    backupDigest:rapport.backup && rapport.backup.digest
  }, { bootstrapOnly:true });
  const bronnen = bootstrapBronnen(root);
  if (rapport.image.bewijsInhoudSha256 !== invoer.image.inhoudSha256 ||
      rapport.image.bewijsBestandSha256 !== bestandHash(root, REL.image) ||
      JSON.stringify(rapport.bronnen) !== JSON.stringify(bronnen))
    throw new Error('Een bootstrap-onderbewijs wijzigde na de kandidaatkeuring.');
  return rapport;
}

function controleerOwnerReadbackBestand(bestand, opties = {}) {
  let rapport;
  try { rapport = JSON.parse(fs.readFileSync(bestand, 'utf8')); }
  catch (e) { throw new Error('Eigenaars-readbackbewijs ontbreekt of is onleesbaar.'); }
  const pin = rapport && rapport.bewijsSha256;
  const zonder = { ...(rapport || {}) }; delete zonder.bewijsSha256;
  const gezien = Date.parse(rapport && rapport.database && rapport.database.observedAt || '');
  const gemaakt = Date.parse(rapport && rapport.gemaakt || '');
  const geldigTot = Date.parse(rapport && rapport.geldigTot || '');
  const nu = Number.isFinite(opties.nu) ? opties.nu : Date.now();
  if (!rapport || rapport.formaat !== 'rtg-owner-readback-bewijs-v2' ||
      !/^[a-f0-9]{40,64}$/.test(String(rapport.commit || '')) ||
      (opties.commit && rapport.commit !== opties.commit) ||
      !geldigId(rapport.imageId) || (opties.imageId && rapport.imageId !== opties.imageId) ||
      typeof rapport.imageImmutable !== 'string' ||
      !/@sha256:[a-f0-9]{64}$/.test(rapport.imageImmutable) ||
      (opties.imageImmutable && rapport.imageImmutable !== opties.imageImmutable) ||
      !['bootstrap', 'release'].includes(rapport.kandidaatSoort) ||
      !/^[a-f0-9]{64}$/.test(String(rapport.kandidaatBewijsSha256 || '')) ||
      !rapport.database || rapport.database.backend !== 'postgresql' ||
      rapport.database.directAuthoritativeReadback !== true ||
      rapport.database.readOnlyMeasurement !== true ||
      rapport.database.ownerAuthorized !== true ||
      !/^[a-f0-9]{64}$/.test(String(rapport.database.ownerRefSha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(rapport.database.ownerEmailSha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(rapport.database.targetSha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(rapport.database.identitySha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(rapport.database.snapshotSha256 || '')) ||
      !Number.isFinite(gezien) || !Number.isFinite(gemaakt) || !Number.isFinite(geldigTot) ||
      geldigTot !== gezien + OWNER_READBACK_MAX_AGE_MS || gemaakt > nu + OWNER_CLOCK_SKEW_MS ||
      gezien > gemaakt + OWNER_CLOCK_SKEW_MS || gezien < gemaakt - OWNER_CLOCK_SKEW_MS ||
      (opties.eisVers === true && (nu > geldigTot || gezien > nu + OWNER_CLOCK_SKEW_MS)) ||
      !/^[a-f0-9]{64}$/.test(String(pin || '')) || pin !== hash(JSON.stringify(zonder)))
    throw new Error('Eigenaars-readbackbewijs is ongeldig of niet aan commit, image en PostgreSQL-readback gebonden.');
  return rapport;
}

function ownerKandidaatBinding(root, gegevens) {
  const commit = String(gegevens.commit || '').toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error('Eigenaarsbewijscommit is ongeldig.');
  if (gegevens.bootstrap === true) {
    const bootstrap = controleerBootstrap(root, commit);
    return { soort:'bootstrap', commit, imageId:bootstrap.image.id,
      imageImmutable:bootstrap.image.immutable,
      kandidaatBewijsSha256:bootstrap.bewijsSha256 };
  }
  if (!geldigId(gegevens.imageId)) throw new Error('Eigenaarsbewijsimage-ID is ongeldig.');
  const basis = controleerOwnerImageBasis(root, commit, {
    imageVerwijzing:gegevens.imageVerwijzing, imageDigest:gegevens.imageDigest
  });
  const inhoud = { soort:'release', commit, imageId:gegevens.imageId,
    imageImmutable:basis.appKeten.immutable,
    imageInhoudSha256:basis.image.inhoudSha256,
    imageBewijsSha256:bestandHash(root, REL.image),
    bronBoom:basis.bron.boom, herkomstSha256:basis.appKeten.herkomstSha256,
    sbomSha256:basis.appKeten.sbomSha256 };
  return { soort:'release', commit, imageId:gegevens.imageId,
    imageImmutable:basis.appKeten.immutable,
    kandidaatBewijsSha256:hash(JSON.stringify(inhoud)) };
}

function maakOwnerReadback(root, gegevens) {
  const commit = String(gegevens.commit || '').toLowerCase();
  const binding = ownerKandidaatBinding(root, gegevens);
  const gelezen = gegevens.readback || {};
  if (gelezen.formaat !== 'rtg-owner-postgres-readback-v2' || gelezen.commit !== commit ||
      gelezen.imageId !== binding.imageId || gelezen.imageImmutable !== binding.imageImmutable ||
      gelezen.candidateEvidenceSha256 !== binding.kandidaatBewijsSha256 ||
      gelezen.nonce !== gegevens.nonce || !/^[A-Za-z0-9_-]{24,160}$/.test(String(gelezen.nonce || '')) ||
      gelezen.postgresReadback !== true || gelezen.directReadOnly !== true ||
      gelezen.ownerAuthorized !== true ||
      !/^[a-f0-9]{64}$/.test(String(gelezen.ownerRefSha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(gelezen.ownerEmailSha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(gelezen.databaseTargetSha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(gelezen.databaseIdentitySha256 || '')) ||
      !/^[a-f0-9]{64}$/.test(String(gelezen.databaseSnapshotSha256 || '')) ||
      !Number.isFinite(Date.parse(gelezen.observedAt || '')))
    throw new Error('De eigenaarsattestatie hoort niet bij deze kandidaat of bewijst geen PostgreSQL-readback.');
  const gemaaktMs = Date.now(), gezienMs = Date.parse(gelezen.observedAt);
  if (gezienMs > gemaaktMs + OWNER_CLOCK_SKEW_MS || gezienMs < gemaaktMs - OWNER_CLOCK_SKEW_MS)
    throw new Error('De PostgreSQL-readback is niet vers uit deze kandidaatronde.');
  const rapport = { formaat:'rtg-owner-readback-bewijs-v2', gemaakt:new Date(gemaaktMs).toISOString(),
    geldigTot:new Date(gezienMs + OWNER_READBACK_MAX_AGE_MS).toISOString(),
    commit, imageId:binding.imageId, imageImmutable:binding.imageImmutable,
    kandidaatSoort:binding.soort, kandidaatBewijsSha256:binding.kandidaatBewijsSha256,
    database:{ backend:'postgresql', directAuthoritativeReadback:true,
      readOnlyMeasurement:true,
      ownerAuthorized:true, ownerRefSha256:gelezen.ownerRefSha256,
      ownerEmailSha256:gelezen.ownerEmailSha256,
      targetSha256:gelezen.databaseTargetSha256,
      identitySha256:gelezen.databaseIdentitySha256,
      snapshotSha256:gelezen.databaseSnapshotSha256,
      observedAt:gelezen.observedAt } };
  rapport.bewijsSha256 = hash(JSON.stringify(rapport));
  const doel = path.join(root, REL.ownerReadback), tmp = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(rapport, null, 2) + '\n', { mode:0o600 });
  fs.renameSync(tmp, doel);
  return controleerOwnerReadbackBestand(doel, { commit, imageId:binding.imageId,
    imageImmutable:binding.imageImmutable, eisVers:true });
}

function controleerOwnerReadback(root, opties = {}) {
  return controleerOwnerReadbackBestand(opties.bestand || path.join(root, REL.ownerReadback), opties);
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
      ownerReadback:bestandHash(root, REL.ownerReadback),
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
      rapport.bronnen.ownerReadback !== bestandHash(root, REL.ownerReadback) ||
      rapport.bronnen.herkomst !== invoer.appKeten.herkomstSha256 ||
      rapport.bronnen.sbom !== invoer.appKeten.sbomSha256 ||
      rapport.bronnen.backupHerkomst !== invoer.backupKeten.herkomstSha256 ||
      rapport.bronnen.backupSbom !== invoer.backupKeten.sbomSha256)
    throw new Error('Een kandidaat-onderbewijs wijzigde na de containerkeuring.');
  return rapport;
}

module.exports = { REL, BOOTSTRAP_BLOKKADE, OWNER_READBACK_MAX_AGE_MS,
  geldigId, geldigDigest, geldigeVerwijzing,
  controleerBron, controleerOwnerImageBasis, ownerKandidaatBinding,
  schrijfRuntime, maakBootstrap, controleerBootstrap,
  maakOwnerReadback, controleerOwnerReadback, controleerOwnerReadbackBestand, maak, controleer };
