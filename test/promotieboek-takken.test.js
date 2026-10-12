'use strict';
/* ============================================================================
   PROMOTIEBOEK -- DE WEIGERINGEN DIE promotieboek.test.js NIET LANGSKOMT

   Het promotieboek zegt alleen ja met een lege klachtenlijst. Dit bestand
   toetst de overige manieren waarop het nee zegt, elk met de klacht die erbij
   hoort: geen vertrouwensankers, onleesbare bewijzen, een promotie zonder
   OCI-vorm of van een ander image, een ontbrekende of verkeerde bewijspin,
   een niet-gepromoveerd record, een ongetekende herkomst; en bij rollback een
   boek dat er niet is, onvolledig is of een kapotte index heeft. Ook een
   onbekende omgeving en een leeg of symbolisch bronbestand worden geweigerd.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const trust = require('../server/config/release-trust');
const H = require('../scripts/imageherkomst');
const boek = require('../scripts/lib/promotieboek');
const keten = require('../scripts/lib/artefactketen');
const { wortel, COMMIT } = require('./lib/artefact-fixture');

const APP = 'sha256:' + 'a'.repeat(64), BCK = 'sha256:' + 'b'.repeat(64);
const DIG = 'sha256:' + 'c'.repeat(64), BDIG = 'sha256:' + 'd'.repeat(64);
const PIN = 'e'.repeat(64);
const OMG = 'productie';
const doel = { imageId: APP, backupId: BCK, pin: PIN, omgeving: OMG };

function promoveer(w) {
  const g = keten.voegToe(w.root, 'gebouwd', { commit: COMMIT, run: 'r', digest: DIG, backupDigest: BDIG, imageId: APP, backupImageId: BCK }, { env: w.env });
  const t = keten.voegToe(w.root, 'getest', { commit: COMMIT, digest: DIG, backupDigest: BDIG, waargenomenDigest: DIG,
    waargenomenBackupDigest: BDIG, testBewijsSha256: '9'.repeat(64), geslaagd: true, gebouwdRecord: g.hash }, { env: w.env });
  return keten.voegToe(w.root, 'gepromoveerd', { commit: COMMIT, digest: DIG, backupDigest: BDIG, imageId: APP, backupImageId: BCK,
    omgeving: OMG, besluit: 'CAB-1', goedgekeurdDoor: 'authority', testRecord: t.hash }, { env: w.env });
}
function herkomstDoc(rol, digest, sleutel) {
  const doc = H.maakHerkomst({ image: 'ghcr.io/rtg/x:candidate', digest, sbomBytes: Buffer.from('{}'),
    sbomComponenten: 1, bewijs: { inhoudSha256: 'f'.repeat(64), bestandAantal: 3 },
    kwalificatie: { formaat: 'rtg-kwalificatie-v1', rol, imageId: APP, backupImageId: BCK,
      inhoudSha256: 'f'.repeat(64), bestandAantal: 3, imageBewijsSha256: '1'.repeat(64),
      voorSha256: '2'.repeat(64), naSha256: '3'.repeat(64) },
    gemaakt: '2026-10-06T00:00:00.000Z' });
  doc.handtekening = { algoritme: 'ed25519', waarde: H.teken(doc, sleutel) };
  return Buffer.from(JSON.stringify(doc) + '\n');
}
function promotieDoc(over = {}, kandidaat = {}) {
  return Buffer.from(JSON.stringify({ formaat: 'rtg-productie-promotie-v2',
    ondertekenDomein: trust.ROLES.PROMOTION.domain, commit: '0'.repeat(40),
    kandidaat: { image: { id: APP, digest: DIG, immutable: 'x@' + DIG, bewijsBestandSha256: PIN },
      backup: { id: BCK, digest: BDIG, immutable: 'y@' + BDIG, herkomstSha256: '4'.repeat(64) }, ...kandidaat },
    ...over }) + '\n');
}
/* De vier bronbestanden als bytes, met de promotie correct getekend. */
function bytes(w, over = {}) {
  const b = { promotie: promotieDoc(), herkomst: herkomstDoc('app', DIG, w.sleutels.BUILD),
    backupHerkomst: herkomstDoc('backup', BDIG, w.sleutels.BUILD), ...over };
  b.promotieSig = b.promotieSig || Buffer.from(trust.sign('PROMOTION', b.promotie, w.sleutels.PROMOTION) + '\n');
  return b;
}
function zet(w, b) {
  fs.mkdirSync(path.join(w.root, '.release'), { recursive: true });
  for (const [naam, rel] of Object.entries(boek.BRONNEN)) fs.writeFileSync(path.join(w.root, rel), b[naam]);
}

test('mapVoor eist een image-ID en legt het archief onder de hex', () => {
  assert.throws(() => boek.mapVoor('/r', undefined), /ongeldig image-ID/);
  assert.throws(() => boek.mapVoor('/r', 'latest'), /ongeldig image-ID/);
  assert.equal(boek.mapVoor('/r', APP), path.join('/r', boek.MAP, 'a'.repeat(64)));
});

test('controleerBytes zonder vertrouwensankers geeft alleen die klacht', () => {
  const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-boek-'));
  try {
    const k = boek.controleerBytes(leeg, {}, { imageId: APP, backupId: BCK, pin: PIN, record: null });
    assert.equal(k.length, 1);
    assert.match(k[0], /\.pub|anker|sleutel|ENOENT/i);
  } finally { fs.rmSync(leeg, { recursive: true, force: true }); }
});

test('controleerBytes: onleesbare JSON is een klacht, geen uitzondering', t => {
  const w = wortel(t);
  const b = bytes(w, { herkomst: Buffer.from('{kapot') });
  assert.deepEqual(boek.controleerBytes(w.root, b, { ...doel }), ['Promotieboek: een bewaard bewijs is onleesbaar.']);
});

test('controleerBytes: een promotie zonder OCI-vorm, of met een vreemd domein, stopt na de vormklacht', t => {
  const w = wortel(t);
  const zonderBackup = bytes(w, { promotie: promotieDoc({}, { backup: undefined }) });
  assert.deepEqual(boek.controleerBytes(w.root, zonderBackup, doel), ['De bewaarde promotie heeft niet de vorm van een OCI-promotie.']);
  const anderDomein = bytes(w, { promotie: promotieDoc({ ondertekenDomein: 'iets-anders' }) });
  assert.deepEqual(boek.controleerBytes(w.root, anderDomein, doel), ['De bewaarde promotie heeft niet de vorm van een OCI-promotie.']);
  const nulPromotie = bytes(w, { promotie: Buffer.from('null') });
  assert.deepEqual(boek.controleerBytes(w.root, nulPromotie, doel), ['De bewaarde promotie heeft niet de vorm van een OCI-promotie.']);
});

test('controleerBytes: een ander image, een ander backupimage, geen pin en geen record geven elk hun klacht', t => {
  const w = wortel(t);
  const b = bytes(w);
  const anders = 'sha256:' + '9'.repeat(64);
  const k = boek.controleerBytes(w.root, b, { imageId: anders, backupId: anders, pin: undefined, record: undefined });
  assert.deepEqual(k, [
    'De promotie hoort bij image ' + APP + ', niet bij ' + anders + '.',
    'De promotie hoort bij backupimage ' + BCK + ', niet bij ' + anders + '.',
    'De bewijspin van het image is niet de pin uit de promotie.',
    'Zonder gepromoveerd-record uit de artefactketen is er niets om tegen te controleren.']);
  const terug = boek.controleerBytes(w.root, b, { ...doel, record: { soort: 'terugdraai', velden: {} } });
  assert.deepEqual(terug, ['Zonder gepromoveerd-record uit de artefactketen is er niets om tegen te controleren.']);
});

test('controleerBytes: een herkomst zonder handtekening of zonder image wordt per rol gemeld', t => {
  const w = wortel(t);
  const record = { soort: 'gepromoveerd', velden: { digest: DIG, backupDigest: BDIG } };
  const ongetekend = JSON.parse(herkomstDoc('backup', BDIG, w.sleutels.BUILD).toString());
  delete ongetekend.handtekening;
  const k = boek.controleerBytes(w.root, bytes(w, { backupHerkomst: Buffer.from(JSON.stringify(ongetekend)) }), { ...doel, record });
  assert.deepEqual(k, ['De backup-herkomst heeft geen geldige BUILD-handtekening.']);
  const nul = boek.controleerBytes(w.root, bytes(w, { herkomst: Buffer.from('null') }), { ...doel, record });
  assert.deepEqual(nul, ['De app-herkomst heeft geen geldige BUILD-handtekening.']);
  /* de juiste bytes met het juiste record: geen enkele klacht */
  assert.deepEqual(boek.controleerBytes(w.root, bytes(w), { ...doel, record }), []);
});

test('archiveer en controleerRollback kennen alleen staging, pilot en productie', t => {
  const w = wortel(t);
  assert.throws(() => boek.archiveer(w.root, { ...doel, omgeving: 'test' }), /onbekende omgeving/);
  assert.throws(() => boek.archiveer(w.root, { ...doel, omgeving: undefined }), /onbekende omgeving/);
  assert.match(boek.controleerRollback(w.root, { ...doel, omgeving: 'test' }).join(' '), /niet te lezen: Promotieboek: onbekende omgeving/);
  assert.match(boek.controleerRollback(w.root, { ...doel, omgeving: undefined }).join(' '), /onbekende omgeving/);
  assert.deepEqual(boek.controleerRollback(w.root, { ...doel, backupId: undefined }), ['Rollbackdoel heeft geen geldige image-ID\'s.']);
  assert.deepEqual(boek.controleerRollback(w.root, { ...doel, imageId: undefined }), ['Rollbackdoel heeft geen geldige image-ID\'s.']);
});

test('archiveer weigert een leeg of symbolisch bronbestand', t => {
  const w = wortel(t);
  promoveer(w);
  zet(w, bytes(w));
  const herkomst = path.join(w.root, boek.BRONNEN.herkomst);
  fs.writeFileSync(herkomst, '');
  assert.throws(() => boek.archiveer(w.root, doel), /geen begrensd regulier bestand: herkomst\.json/);
  fs.rmSync(herkomst);
  fs.symlinkSync(path.join(w.root, boek.BRONNEN.backupHerkomst), herkomst);
  assert.throws(() => boek.archiveer(w.root, doel), /geen begrensd regulier bestand/);
  assert.equal(fs.existsSync(path.join(w.root, boek.MAP)), false, 'er is niets gearchiveerd');
});

test('controleerRollback: zonder boek, met een onvolledig boek, of met een kapotte index is het nee', t => {
  const w = wortel(t);
  const p = promoveer(w);
  zet(w, bytes(w));
  assert.match(boek.controleerRollback(w.root, doel)[0], /staat niet in het promotieboek/);
  const index = boek.archiveer(w.root, doel);
  assert.equal(index.formaat, 'rtg-promotieboek-v2');
  assert.equal(index.ketenRecord, p.hash);
  assert.deepEqual(Object.keys(index.bestanden).sort(), Object.keys(boek.BRONNEN).sort());
  assert.deepEqual(boek.controleerRollback(w.root, doel), []);

  const map = boek.mapVoor(w.root, APP);
  fs.writeFileSync(path.join(map, 'index.json'), '{kapot');
  assert.match(boek.controleerRollback(w.root, doel)[0], /verwijst niet naar een gepromoveerd-record/);

  fs.rmSync(path.join(map, 'promotieSig'));
  assert.match(boek.controleerRollback(w.root, doel)[0], /is onvolledig: .*ENOENT|is onvolledig/);
});
