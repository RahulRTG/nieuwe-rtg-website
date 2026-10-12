/* DE LIVE-KANDIDAAT, TAK VOOR TAK (scripts/lib/live-kandidaat.js).

   test/live-kandidaat.test.js laat zien dat een complete kandidaat door de
   keuring komt en dat een handvol vervalsingen tegengehouden wordt. Deze
   kandidaatkeuring is een lange ketting van voorwaarden: elke schakel die
   nooit afzonderlijk breekt, is een schakel waarvan niemand weet of hij iets
   tegenhoudt. Daarom hier per schakel een vervalsing, steeds op EEN veld en
   met de rest intact, zodat de keuring precies op die schakel moet stranden.

   De opstelling is die van test/live-kandidaat.test.js, in een tijdelijke map
   (PROEFMAP) met een eigen git-repository en een eigen signeersleutel. Na elke
   vervalsing worden de oorspronkelijke bytes teruggezet.

   Los: node --test test/live-kandidaat-takken.test.js */
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
const K = require('../scripts/lib/live-kandidaat');
const herkomst = require('../scripts/imageherkomst');

const APP_ID = 'sha256:' + 'b'.repeat(64);
const BACKUP_ID = 'sha256:' + 'c'.repeat(64);
const APP_DIGEST = 'sha256:' + 'd'.repeat(64);
const BACKUP_DIGEST = 'sha256:' + 'e'.repeat(64);
const H64 = c => c.repeat(64);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

function schrijf(map, rel, inhoud) {
  const doel = path.join(map, rel);
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, inhoud);
}
const leesJ = (map, rel) => JSON.parse(fs.readFileSync(path.join(map, rel), 'utf8'));
const schrijfJ = (map, rel, j) => fs.writeFileSync(path.join(map, rel), JSON.stringify(j) + '\n');

function opstelling() {
  const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kandidaat-tak-'));
  for (const [rel, inhoud] of Object.entries({
    'package.json': '{"name":"rtg-kandidaat","version":"1"}', 'package-lock.json': '{}',
    'server/app.js': 'module.exports=1', 'public/dist/app.js': 'bouw',
    'scripts/start.js': 'start', 'motor/src/lib.rs': 'pub fn x(){}',
    'motor/Cargo.toml': '[package]', 'motor/Cargo.lock': '',
    'rtg-motor': 'motor', 'rtg-sentinel': 'sentinel', 'BEGROTING.json': '{"grens":1}'
  })) schrijf(PROEFMAP, rel, inhoud);
  schrijf(PROEFMAP, '.gitignore', '.release/\n');
  fs.mkdirSync(path.join(PROEFMAP, '.release'), { recursive: true });
  const sleutels = herkomst.nieuweSleutel();
  require('./release-trust-fixture').trustFixture(PROEFMAP, { BUILD: {
    publicKey: crypto.createPublicKey(sleutels.publiek), privateKey: crypto.createPrivateKey(sleutels.prive) } });
  const git = (...args) => spawnSync('git', args, { cwd: PROEFMAP, encoding: 'utf8' });
  assert.equal(git('init', '--quiet').status, 0);
  assert.equal(git('config', 'user.email', 'candidate@test.invalid').status, 0);
  assert.equal(git('config', 'user.name', 'Candidate Test').status, 0);
  assert.equal(git('add', '.').status, 0);
  assert.equal(git('commit', '--quiet', '-m', 'candidate').status, 0);
  const commit = git('rev-parse', 'HEAD').stdout.trim();
  const APP_REF = 'ghcr.io/rtg/test:candidate-' + commit.slice(0, 12) + '-123';
  const BACKUP_REF = 'ghcr.io/rtg/test:candidate-backup-' + commit.slice(0, 12) + '-123';
  const bronManifest = bronRelease.maak(PROEFMAP);
  schrijf(PROEFMAP, K.REL.bron, JSON.stringify(bronManifest) + '\n');
  schrijf(PROEFMAP, K.REL.ciSuite, '{"suite":"green"}\n');
  schrijf(PROEFMAP, K.REL.ciSchermen, '{"screens":"green"}\n');
  schrijf(PROEFMAP, K.REL.ciPg, '{"pg":"green"}\n');
  schrijf(PROEFMAP, '.release/prerelease-workflows.json', '{"workflows":"green"}\n');
  const vorig = process.env.RTG_RELEASE_COMMIT;
  process.env.RTG_RELEASE_COMMIT = commit;
  let manifest;
  try { manifest = release.maakManifest(PROEFMAP); } finally {
    if (vorig === undefined) delete process.env.RTG_RELEASE_COMMIT;
    else process.env.RTG_RELEASE_COMMIT = vorig;
  }
  manifest.bron.gewijzigd = false;
  const manifestBytes = JSON.stringify(manifest) + '\n';
  schrijf(PROEFMAP, K.REL.imageArtifact, manifestBytes);
  schrijf(PROEFMAP, K.REL.image, manifestBytes);
  const prive = crypto.createPrivateKey(sleutels.prive);
  const kwal = rol => ({ formaat: 'rtg-kwalificatie-v1', rol, imageId: APP_ID, backupImageId: BACKUP_ID,
    inhoudSha256: manifest.inhoudSha256, bestandAantal: manifest.bestandAantal,
    imageBewijsSha256: H64('7'), voorSha256: H64('8'), naSha256: H64('9'), nietGeleverd: [] });
  const keten = (verwijzing, digest, sbomRel, herkomstRel, rol) => {
    const sbom = herkomst.maakSbom({ app: { naam: 'rtg', versie: '1' }, image: verwijzing,
      os: [{ naam: 'base', versie: '1', arch: 'amd64' }], crates: [], npm: { runtime: [], ontwikkeling: 0 },
      node: 'v26.0.0', bewijs: manifest, gemaakt: '2026-09-04T12:00:00.000Z',
      serie: '00000000-0000-4000-8000-000000000001' });
    const sbomBytes = Buffer.from(JSON.stringify(sbom) + '\n');
    schrijf(PROEFMAP, sbomRel, sbomBytes);
    const document = herkomst.maakHerkomst({ image: verwijzing, digest, sbomBytes,
      sbomComponenten: sbom.components.length, bewijs: manifest,
      bron: { commit, boom: bronManifest.boom, werkboomSchoon: true },
      uitvoering: herkomst.uitvoeringHashes(PROEFMAP), kwalificatie: kwal(rol),
      bouw: { draaier: 'github-actions', workflow: 'release-image', run: '123' },
      gemaakt: '2026-09-04T12:00:00.000Z' });
    document.handtekening = { algoritme: 'ed25519', waarde: herkomst.teken(document, prive) };
    schrijf(PROEFMAP, herkomstRel, JSON.stringify(document) + '\n');
  };
  keten(APP_REF, APP_DIGEST, K.REL.sbom, K.REL.herkomst, 'app');
  keten(BACKUP_REF, BACKUP_DIGEST, K.REL.backupSbom, K.REL.backupHerkomst, 'backup');
  const bron = { commit, boomVuil: false, herkomst: 'geverifieerd-imagebewijs',
    inhoudSha256: manifest.inhoudSha256 };
  schrijf(PROEFMAP, K.REL.pg, JSON.stringify({ formaat: 'rtg-pg-bewijs-v1',
    geslaagd: true, tapVolledig: true, tests: 4, mislukt: 0, geannuleerd: 0,
    overgeslagen: 0, todo: 0, bron }) + '\n');
  const ownerBinding = K.ownerKandidaatBinding(PROEFMAP, { commit,
    imageVerwijzing: APP_REF, imageDigest: APP_DIGEST, imageId: APP_ID });
  const ownerObserved = new Date().toISOString(), ownerNonce = 'o'.repeat(32);
  const ownerBewijs = K.maakOwnerReadback(PROEFMAP, { commit, nonce: ownerNonce,
    imageVerwijzing: APP_REF, imageDigest: APP_DIGEST, imageId: APP_ID,
    readback: { formaat: 'rtg-owner-postgres-readback-v2', commit, imageId: APP_ID,
      imageImmutable: ownerBinding.imageImmutable,
      candidateEvidenceSha256: ownerBinding.kandidaatBewijsSha256, nonce: ownerNonce,
      postgresReadback: true, directReadOnly: true, ownerAuthorized: true,
      ownerRefSha256: H64('4'), ownerEmailSha256: H64('1'),
      databaseTargetSha256: H64('5'), databaseIdentitySha256: H64('2'),
      databaseSnapshotSha256: H64('3'), observedAt: ownerObserved } });
  schrijf(PROEFMAP, K.REL.golive, JSON.stringify({ formaat: 'rtg-golive-bewijs-v1',
    geslaagd: true, blokkers: 0, bron,
    ownerReadback: { formaat: 'rtg-owner-readback-bewijs-v2', commit,
      imageId: APP_ID, bewijsSha256: ownerBewijs.bewijsSha256, postgresReadback: true,
      directReadOnly: true, ownerAuthorized: true, ownerEmailSha256: H64('1'),
      databaseIdentitySha256: H64('2'), databaseSnapshotSha256: H64('3'),
      observedAt: ownerObserved, validUntil: ownerBewijs.geldigTot },
    redis: { ok: true, tweeInstanties: true, pubsub: true, atomischeRateLimit: true,
      toegestaan: 1, geweigerd: 1, teller: 2, opgeruimd: true, doelSha256: H64('c') },
    gedeeldeMedia: { ok: true, tweeInstanties: true, verwijderd: true, bytes: 96,
      sha256: H64('d'), doelSha256: H64('e') },
    alarmering: { ok: true, status: 204, doelSha256: H64('f') },
    turnRelay: { ok: true, reden: null, configVingerafdruk: H64('7'),
      urls: [{ url: 'turns:turn.rahultravelgroup.com:5349?transport=tcp', transport: 'tls', ok: true,
        reden: null, bytesAB: 65536, bytesBA: 65536 }] } }) + '\n');
  K.schrijfRuntime(PROEFMAP, { commit, verwachteImageId: APP_ID,
    imageId: APP_ID, imageVerwijzing: APP_REF, imageDigest: APP_DIGEST,
    inhoudSha256: manifest.inhoudSha256 });
  const gegevens = { commit, imageVerwijzing: APP_REF, imageDigest: APP_DIGEST, imageId: APP_ID,
    backupVerwijzing: BACKUP_REF, backupDigest: BACKUP_DIGEST, backupId: BACKUP_ID };
  return { PROEFMAP, commit, APP_REF, BACKUP_REF, prive, gegevens, manifest };
}

/* Een gedeelde opstelling voor het hele bestand: elke vervalsing zet haar
   bestand na afloop byte voor byte terug. */
let O;
test.before(() => { O = opstelling(); });
test.after(() => { if (O) fs.rmSync(O.PROEFMAP, { recursive: true, force: true }); });

function vervals(rel, wijzig, doe) {
  const pad = path.join(O.PROEFMAP, rel);
  const oud = fs.existsSync(pad) ? fs.readFileSync(pad) : null;
  try {
    if (wijzig === null) fs.rmSync(pad);
    else { const j = JSON.parse(oud.toString('utf8')); const nieuw = wijzig(j); schrijfJ(O.PROEFMAP, rel, nieuw || j); }
    return doe();
  } finally {
    if (oud === null) fs.rmSync(pad, { force: true }); else fs.writeFileSync(pad, oud);
  }
}

test('de opstelling zelf is een geldige kandidaat (de tegenproef voor alles hieronder)', () => {
  const r = K.maak(O.PROEFMAP, O.gegevens);
  assert.equal(r.image.id, APP_ID);
  assert.equal(K.controleer(O.PROEFMAP, O.commit).bewijsSha256, r.bewijsSha256);
});

test('de vormcontroles op id, digest en verwijzing', () => {
  assert.equal(K.geldigId(APP_ID), true);
  assert.equal(K.geldigId(null), false);
  assert.equal(K.geldigDigest('sha256:abc'), false);
  assert.equal(K.geldigeVerwijzing(O.APP_REF, false), true);
  assert.equal(K.geldigeVerwijzing(O.APP_REF, true), false, 'een app-tag is geen backup-tag');
  assert.equal(K.geldigeVerwijzing(O.BACKUP_REF, true), true);
  assert.equal(K.geldigeVerwijzing(undefined), false);
  assert.equal(K.geldigeVerwijzing(O.APP_REF.replace(/-123$/, '-0123')), false);
});

test('een ongeldige commit of image-id wordt bij elke ingang vooraf geweigerd', () => {
  const g = O.gegevens;
  assert.throws(() => K.maak(O.PROEFMAP, { ...g, commit: 'xyz' }), /Kandidaatcommit of image-id is ongeldig/);
  assert.throws(() => K.maak(O.PROEFMAP, { ...g, backupId: 'sha256:1' }), /Kandidaatcommit of image-id/);
  assert.throws(() => K.maak(O.PROEFMAP, { ...g, commit: undefined }), /Kandidaatcommit/);
  assert.throws(() => K.maakBootstrap(O.PROEFMAP, { ...g, imageId: 'x' }), /Bootstrapkandidaatcommit/);
  assert.throws(() => K.ownerKandidaatBinding(O.PROEFMAP, { commit: 'nee' }), /Eigenaarsbewijscommit is ongeldig/);
  assert.throws(() => K.ownerKandidaatBinding(O.PROEFMAP, { commit: O.commit, imageId: 'x' }), /Eigenaarsbewijsimage-ID/);
  assert.throws(() => K.schrijfRuntime(O.PROEFMAP, {}), /Runtimebewijs heeft geen geldige/);
  assert.throws(() => K.schrijfRuntime(O.PROEFMAP, { commit: O.commit, imageId: APP_ID, verwachteImageId: APP_ID,
    imageVerwijzing: O.APP_REF, imageDigest: APP_DIGEST, inhoudSha256: 'kort' }), /Runtimebewijs/);
  assert.throws(() => K.schrijfRuntime(O.PROEFMAP, { commit: O.commit, imageId: APP_ID, verwachteImageId: APP_ID,
    imageVerwijzing: O.BACKUP_REF, imageDigest: APP_DIGEST, inhoudSha256: H64('a') }), /Runtimebewijs/);
});

test('een registryverwijzing of digest buiten de vorm stopt de keten', () => {
  assert.throws(() => K.maak(O.PROEFMAP, { ...O.gegevens, backupVerwijzing: O.APP_REF }),
    /geen veilige unieke registryverwijzing/);
  assert.throws(() => K.maak(O.PROEFMAP, { ...O.gegevens, imageDigest: 'sha256:kort' }),
    /geen veilige unieke registryverwijzing/);
});

test('een ontbrekend of onleesbaar onderbewijs heet bij naam', () => {
  vervals(K.REL.pg, null, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /ontbreekt of is onleesbaar: \.release\/pg-bewijs\.json/));
  vervals(K.REL.backupSbom, null, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /imageherkomst\/SBOM ontbreekt voor de kandidaat/));
});

test('het interne imagebewijs breekt op elk van zijn velden afzonderlijk', () => {
  const gevallen = [
    j => { j.formaat = 'anders'; },
    j => { j.bron = null; },
    j => { j.bron.commit = 'f'.repeat(40); },
    j => { j.bron.gewijzigd = true; },
    j => { j.bestanden = {}; },
    j => { j.bestandAantal += 1; },
    j => { j.inhoudSha256 = H64('0'); }
  ];
  for (const g of gevallen) {
    vervals(K.REL.image, g, () =>
      assert.throws(() => K.ownerKandidaatBinding(O.PROEFMAP, O.gegevens), /interne imagebewijs is niet geldig/, String(g)));
  }
  vervals(K.REL.imageArtifact, j => { j.formaat = 'x'; }, () =>
    assert.throws(() => K.ownerKandidaatBinding(O.PROEFMAP, O.gegevens), /byte-voor-byte/));
});

test('het CI-bronbewijs moet bij precies deze boom horen', () => {
  vervals(K.REL.bron, j => { j.boom = 'f'.repeat(40); }, () =>
    assert.throws(() => K.ownerKandidaatBinding(O.PROEFMAP, O.gegevens), /CI-bronbewijs is niet geldig/));
});

test('een correct getekende herkomst over een andere bronboom hoort niet bij deze kandidaat', () => {
  vervals(K.REL.herkomst, d => {
    d.bron.boom = 'f'.repeat(40);
    delete d.handtekening;
    d.handtekening = { algoritme: 'ed25519', waarde: herkomst.teken(d, O.prive) };
  }, () => assert.throws(() => K.ownerKandidaatBinding(O.PROEFMAP, O.gegevens),
    /hoort niet bij het gecontroleerde CI-bronbewijs/));
});

test('het PG-bewijs breekt op elk van zijn velden afzonderlijk', () => {
  const gevallen = [
    j => { j.formaat = 'x'; }, j => { j.geslaagd = false; }, j => { j.tapVolledig = false; },
    j => { j.mislukt = 1; }, j => { j.geannuleerd = 1; }, j => { j.overgeslagen = 1; },
    j => { j.todo = 1; }, j => { j.tests = 0; }, j => { j.bron = null; },
    j => { j.bron.commit = 'x'; }, j => { j.bron.boomVuil = true; },
    j => { j.bron.herkomst = 'ongeverifieerd'; }, j => { j.bron.inhoudSha256 = H64('0'); }
  ];
  for (const g of gevallen) vervals(K.REL.pg, g, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /PostgreSQL\/Redis is niet vers/, String(g)));
});

test('de golive moet aantoonbaar bij dit image horen, groen zijn en het eigenaarsbewijs dragen', () => {
  const bron = [
    j => { j.formaat = 'x'; }, j => { j.bron = null; }, j => { j.bron.commit = 'x'; },
    j => { j.bron.boomVuil = null; }, j => { j.bron.herkomst = 'x'; }, j => { j.bron.inhoudSha256 = undefined; }
  ];
  for (const g of bron) vervals(K.REL.golive, g, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /hoort niet aantoonbaar bij exact dit kandidaatimage/, String(g)));
  vervals(K.REL.golive, j => { j.blokkers = 2; }, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /niet groen/));
  vervals(K.REL.golive, j => { delete j.turnRelay.configVingerafdruk; }, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /TURN-relayproef/));
  vervals(K.REL.golive, j => { j.turnRelay.urls = 'turns:x'; }, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /TURN-relayproef/));
  vervals(K.REL.golive, j => { j.turnRelay.urls[0].bytesAB = 1.5; }, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /TURN-relayproef/));
  for (const w of [j => { j.turnRelay.urls.push(null); }, j => { j.turnRelay.urls = [{ ok: true }]; },
    j => { j.turnRelay.urls.push({ ok: true }); }]) vervals(K.REL.golive, w, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /TURN-relayproef/, String(w)));
  const eigenaar = [
    o => null, o => { o.formaat = 'v1'; }, o => { o.commit = 'kort'; }, o => { delete o.commit; }, o => { o.imageId = 'x'; },
    o => { o.bewijsSha256 = undefined; }, o => { o.postgresReadback = false; }, o => { o.directReadOnly = false; },
    o => { o.ownerAuthorized = false; }, o => { o.ownerEmailSha256 = undefined; },
    o => { o.databaseIdentitySha256 = undefined; }, o => { o.databaseSnapshotSha256 = undefined; },
    o => { o.observedAt = 'gisteren'; }, o => { o.validUntil = 'morgen'; },
    o => { o.validUntil = '2001-01-01T00:00:00.000Z'; }
  ];
  for (const w of eigenaar) vervals(K.REL.golive, j => {
    const r = w(j.ownerReadback); if (r === null) j.ownerReadback = null;
  }, () => assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /duurzame eigenaars-\/PostgreSQL-readbackbewijs/, String(w)));
  /* Een geldig ogend eigenaarsveld dat naar ANDERE bytes wijst. */
  vervals(K.REL.golive, j => { j.ownerReadback.bewijsSha256 = H64('a'); }, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /verse volledige eigenaars-readbackbytes/));
});

test('zonder media- of alarmproef blijft de kandidaat staan', () => {
  for (const veld of ['gedeeldeMedia', 'alarmering']) vervals(K.REL.golive, j => { delete j[veld]; }, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /Redis-, gedeelde-media- of alarmbezorgingproeven/, veld));
});

test('het runtimebewijs breekt op elk van zijn velden afzonderlijk', () => {
  const gevallen = [
    j => { j.formaat = 'x'; }, j => { j.commit = 'x'; }, j => { j.verifieerdeImageId = BACKUP_ID; },
    j => { j.verwachteImageId = BACKUP_ID; j.verifieerdeImageId = APP_ID; },
    j => { j.imageDigest = BACKUP_DIGEST; }, j => { j.imageVerwijzing = O.BACKUP_REF; },
    j => { j.imageInhoudSha256 = H64('0'); }, j => { j.ready = false; }, j => { j.probe = false; }
  ];
  for (const g of gevallen) vervals(K.REL.runtime, g, () =>
    assert.throws(() => K.maak(O.PROEFMAP, O.gegevens), /readiness- en probereis/, String(g)));
});

test('het kandidaatrapport: vorm, commit en elk vastgepind onderbewijs', () => {
  K.maak(O.PROEFMAP, O.gegevens);
  const herpin = j => { delete j.bewijsSha256; j.bewijsSha256 = hash(JSON.stringify(j)); };
  vervals(K.REL.kandidaat, j => { j.formaat = 'x'; }, () =>
    assert.throws(() => K.controleer(O.PROEFMAP, O.commit), /Live-kandidaatbewijs is ongeldig/));
  assert.throws(() => K.controleer(O.PROEFMAP, 'f'.repeat(40)), /hoort niet bij HEAD/);
  vervals(K.REL.kandidaat, j => { j.bewijsSha256 = H64('a'); }, () =>
    assert.throws(() => K.controleer(O.PROEFMAP, O.commit), /Live-kandidaatbewijs is ongeldig/));
  vervals(K.REL.kandidaat, j => { j.backup.id = 'x'; herpin(j); }, () =>
    assert.throws(() => K.controleer(O.PROEFMAP, O.commit), /Live-kandidaatbewijs is ongeldig/));
  const velden = ['bron', 'imageArtifact', 'ciSuite', 'ciSchermen', 'ciPg', 'pg', 'golive', 'runtime',
    'ownerReadback', 'herkomst', 'sbom', 'backupHerkomst', 'backupSbom'];
  for (const v of velden) vervals(K.REL.kandidaat, j => { j.bronnen[v] = H64('0'); herpin(j); }, () =>
    assert.throws(() => K.controleer(O.PROEFMAP, O.commit), /onderbewijs wijzigde na de containerkeuring/, v));
  for (const w of [j => { j.image.bewijsInhoudSha256 = H64('0'); }, j => { j.bronBewijsBoom = 'x'; },
    j => { j.image.bewijsBestandSha256 = H64('0'); }]) {
    vervals(K.REL.kandidaat, j => { w(j); herpin(j); }, () =>
      assert.throws(() => K.controleer(O.PROEFMAP, O.commit), /onderbewijs wijzigde/, String(w)));
  }
  assert.equal(K.controleer(O.PROEFMAP, O.commit).commit, O.commit, 'na het terugzetten weer geldig');
});

test('het bootstrapbewijs: vorm, pin en bronnen na de keuring', () => {
  vervals(K.REL.golive, j => {
    j.geslaagd = false; j.blokkers = 1;
    j.controles = [{ teken: '✗', hard: true, tekst: K.BOOTSTRAP_BLOKKADE + ' Alleen eerste eigenaar.' }, null];
  }, () => {
    const b = K.maakBootstrap(O.PROEFMAP, O.gegevens);
    assert.equal(b.uitsluitendEersteEigenaar, true);
    assert.equal(K.ownerKandidaatBinding(O.PROEFMAP, { commit: O.commit, bootstrap: true }).soort, 'bootstrap');
    const herpin = j => { delete j.bewijsSha256; j.bewijsSha256 = hash(JSON.stringify(j)); };
    for (const w of [j => { j.formaat = 'x'; }, j => { j.uitsluitendEersteEigenaar = false; },
      j => { j.image.id = 'x'; herpin(j); }]) {
      vervals(K.REL.bootstrapKandidaat, w, () =>
        assert.throws(() => K.controleerBootstrap(O.PROEFMAP, O.commit), /Bootstrapkandidaatbewijs is ongeldig/));
    }
    for (const w of [j => { j.bronnen.ciPg = H64('0'); }, j => { j.image.bewijsBestandSha256 = H64('0'); },
      j => { j.image.bewijsInhoudSha256 = H64('0'); }]) {
      vervals(K.REL.bootstrapKandidaat, j => { w(j); herpin(j); }, () =>
        assert.throws(() => K.controleerBootstrap(O.PROEFMAP, O.commit), /bootstrap-onderbewijs wijzigde/));
    }
    /* Een bootstrap mag de golive niet zonder controles hebben. */
    vervals(K.REL.golive, j => { delete j.controles; }, () =>
      assert.throws(() => K.controleerBootstrap(O.PROEFMAP, O.commit), /enige go-liveblokkade/));
    vervals(K.REL.golive, j => { j.controles[0].tekst = undefined; }, () =>
      assert.throws(() => K.controleerBootstrap(O.PROEFMAP, O.commit), /enige go-liveblokkade/));
  });
  fs.rmSync(path.join(O.PROEFMAP, K.REL.bootstrapKandidaat), { force: true });
});

/* --- het eigenaars-readbackbewijs, los van de rest ---------------------- */

const NU = Date.parse('2026-09-04T12:00:00.000Z');
const UUR4 = K.OWNER_READBACK_MAX_AGE_MS;
function readback(wijzig) {
  const r = { formaat: 'rtg-owner-readback-bewijs-v2', gemaakt: new Date(NU).toISOString(),
    geldigTot: new Date(NU + UUR4).toISOString(), commit: 'a'.repeat(40), imageId: APP_ID,
    imageImmutable: 'ghcr.io/rtg/x@' + APP_DIGEST, kandidaatSoort: 'release', kandidaatBewijsSha256: H64('1'),
    database: { backend: 'postgresql', directAuthoritativeReadback: true, readOnlyMeasurement: true,
      ownerAuthorized: true, ownerRefSha256: H64('2'), ownerEmailSha256: H64('3'), targetSha256: H64('4'),
      identitySha256: H64('5'), snapshotSha256: H64('6'), observedAt: new Date(NU).toISOString() } };
  if (wijzig) wijzig(r);
  if (r.bewijsSha256 === undefined) r.bewijsSha256 = hash(JSON.stringify(r));
  return r;
}

test('het readbackbestand: geldig, en elk veld afzonderlijk vervalst', () => {
  const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-readback-tak-'));
  try {
    const pad = path.join(PROEFMAP, 'r.json');
    const zet = (j) => fs.writeFileSync(pad, typeof j === 'string' ? j : JSON.stringify(j));
    zet(readback());
    assert.equal(K.controleerOwnerReadbackBestand(pad, { nu: NU, commit: 'a'.repeat(40), imageId: APP_ID,
      imageImmutable: 'ghcr.io/rtg/x@' + APP_DIGEST, eisVers: true }).kandidaatSoort, 'release');
    assert.equal(K.controleerOwnerReadback(PROEFMAP, { bestand: pad, nu: NU }).imageId, APP_ID);
    const fout = /Eigenaars-readbackbewijs is ongeldig/;
    const plus = (ms) => new Date(NU + ms).toISOString();
    const gevallen = [
      [r => { r.formaat = 'v1'; }], [r => { r.commit = 'kort'; }], [r => { delete r.commit; }], [r => { delete r.database.observedAt; delete r.gemaakt; }], [null, { commit: 'b'.repeat(40) }],
      [r => { r.imageId = 'x'; }], [null, { imageId: BACKUP_ID }], [r => { r.imageImmutable = 5; }],
      [r => { r.imageImmutable = 'zonder-digest'; }], [null, { imageImmutable: 'ander@' + APP_DIGEST }],
      [r => { r.kandidaatSoort = 'proef'; }], [r => { r.kandidaatBewijsSha256 = undefined; }],
      [r => { r.database = null; }], [r => { r.database.backend = 'sqlite'; }],
      [r => { r.database.directAuthoritativeReadback = false; }], [r => { r.database.readOnlyMeasurement = false; }],
      [r => { r.database.ownerAuthorized = false; }], [r => { r.database.ownerRefSha256 = undefined; }],
      [r => { r.database.ownerEmailSha256 = undefined; }], [r => { r.database.targetSha256 = undefined; }],
      [r => { r.database.identitySha256 = undefined; }], [r => { r.database.snapshotSha256 = undefined; }],
      [r => { r.database.observedAt = 'nooit'; }], [r => { r.gemaakt = 'nooit'; }], [r => { r.geldigTot = 'nooit'; }],
      [r => { r.geldigTot = plus(UUR4 + 1); }],
      /* in de toekomst gemaakt, voorbij de toegestane klokscheefheid */
      [r => { r.gemaakt = plus(3 * 60000); r.database.observedAt = plus(3 * 60000); r.geldigTot = plus(3 * 60000 + UUR4); }],
      [r => { r.database.observedAt = plus(3 * 60000); r.geldigTot = plus(3 * 60000 + UUR4); }],
      [r => { r.database.observedAt = plus(-3 * 60000); r.geldigTot = plus(-3 * 60000 + UUR4); }],
      [null, { eisVers: true, nu: NU + UUR4 + 1 }],
      [r => { r.bewijsSha256 = 'x'; }], [r => { r.bewijsSha256 = null; }], [r => { r.bewijsSha256 = H64('9'); }]
    ];
    for (const [wijzig, opties] of gevallen) {
      zet(readback(wijzig));
      assert.throws(() => K.controleerOwnerReadbackBestand(pad, { nu: NU, ...(opties || {}) }), fout,
        String(wijzig) + JSON.stringify(opties));
    }
    /* Vers geëist: een waarneming die net binnen de scheefheid na het maken
       ligt, maar verder in de toekomst dan nu toestaat. */
    zet(readback(r => { r.gemaakt = plus(90000); r.database.observedAt = plus(150000); r.geldigTot = plus(150000 + UUR4); }));
    assert.equal(K.controleerOwnerReadbackBestand(pad, { nu: NU }).commit, 'a'.repeat(40));
    assert.throws(() => K.controleerOwnerReadbackBestand(pad, { nu: NU, eisVers: true }), fout);
    zet('null');
    assert.throws(() => K.controleerOwnerReadbackBestand(pad, { nu: NU }), fout);
    zet('{kapot');
    assert.throws(() => K.controleerOwnerReadbackBestand(pad), /ontbreekt of is onleesbaar/);
    assert.throws(() => K.controleerOwnerReadbackBestand(path.join(PROEFMAP, 'weg.json')), /ontbreekt of is onleesbaar/);
  } finally { fs.rmSync(PROEFMAP, { recursive: true, force: true }); }
});

test('de eigenaarsattestatie moet bij deze kandidaat horen en vers zijn', () => {
  const binding = K.ownerKandidaatBinding(O.PROEFMAP, O.gegevens);
  const nonce = 'q'.repeat(32);
  const basis = { formaat: 'rtg-owner-postgres-readback-v2', commit: O.commit, imageId: APP_ID,
    imageImmutable: binding.imageImmutable, candidateEvidenceSha256: binding.kandidaatBewijsSha256, nonce,
    postgresReadback: true, directReadOnly: true, ownerAuthorized: true,
    ownerRefSha256: H64('4'), ownerEmailSha256: H64('1'), databaseTargetSha256: H64('5'),
    databaseIdentitySha256: H64('2'), databaseSnapshotSha256: H64('3'), observedAt: new Date().toISOString() };
  vervals(K.REL.ownerReadback, j => j, () => {
    const goed = K.maakOwnerReadback(O.PROEFMAP, { ...O.gegevens, nonce, readback: basis });
    assert.equal(goed.kandidaatSoort, 'release');
    const gevallen = [
      { formaat: 'v1' }, { commit: 'f'.repeat(40) }, { imageId: BACKUP_ID }, { imageImmutable: 'x' },
      { candidateEvidenceSha256: H64('0') }, { nonce: 'ander' }, { postgresReadback: false },
      { directReadOnly: false }, { ownerAuthorized: false }, { ownerRefSha256: undefined }, { ownerEmailSha256: undefined },
      { databaseTargetSha256: undefined }, { databaseIdentitySha256: undefined }, { databaseSnapshotSha256: undefined },
      { observedAt: 'nooit' }
    ];
    for (const g of gevallen) assert.throws(() => K.maakOwnerReadback(O.PROEFMAP,
      { ...O.gegevens, nonce, readback: { ...basis, ...g } }), /eigenaarsattestatie hoort niet bij deze kandidaat/, JSON.stringify(g));
    assert.throws(() => K.maakOwnerReadback(O.PROEFMAP, { ...O.gegevens, nonce: 'kort', readback: { ...basis, nonce: 'kort' } }),
      /eigenaarsattestatie/);
    assert.throws(() => K.maakOwnerReadback(O.PROEFMAP, { ...O.gegevens, nonce }), /eigenaarsattestatie/);
    for (const verschuiving of [-3600e3, 3600e3]) {
      assert.throws(() => K.maakOwnerReadback(O.PROEFMAP, { ...O.gegevens, nonce,
        readback: { ...basis, observedAt: new Date(Date.now() + verschuiving).toISOString() } }), /niet vers uit deze kandidaatronde/);
    }
  });
});
