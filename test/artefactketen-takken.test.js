'use strict';
/* ============================================================================
   ARTEFACTKETEN -- DE KLACHTEN VAN controleer() EEN VOOR EEN, EN DE RANDEN
   VAN DE POORTEN

   artefactketen.test.js bewijst de keten met aanvallen via voegToe(). Dit
   bestand tekent zelf records met de echte rolsleutels uit de wegwerpwortel,
   zodat de handtekening klopt en precies EEN inhoudelijke klacht overblijft:
   velden die geen object zijn, een ontbrekend veld, een tijd die geen datum
   is, image en backup met hetzelfde digest, een terugdraai zonder actief
   digest of naar het actieve digest. Daarnaast de randen van de poorten
   (eisTerugdraai zonder digest, eisBewezenActief na een terugdraai) en van
   lees() en voegToe().
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const trust = require('../server/config/release-trust');
const k = require('../scripts/lib/artefactketen');
const { wortel, COMMIT, dig, bouw, test_ } = require('./lib/artefact-fixture');

const TIJD = '2026-10-01T12:00:00.000Z';

/* Een keten van met de hand getekende records: nr en vorige worden gezet, de
   handtekening komt van de rol van de soort, en de hash is de recordhash. */
function ketenVan(w, specs) {
  const records = [];
  for (const s of specs) {
    const r = { nr: records.length + 1, soort: s.soort, tijd: s.tijd || TIJD,
      vorige: records.length ? records[records.length - 1].hash : null, velden: s.velden };
    const rol = k.SOORTEN[s.soort].rol;
    r.handtekening = trust.sign(rol, Buffer.from(k.kanoniek({ nr: r.nr, soort: r.soort, tijd: r.tijd, vorige: r.vorige, velden: r.velden })), w.sleutels[rol]);
    r.hash = k.sha256('RTG:ARTEFACTKETEN:v1\0' + k.kanoniek({ nr: r.nr, soort: r.soort, tijd: r.tijd, vorige: r.vorige, velden: r.velden, handtekening: r.handtekening }));
    records.push(r);
  }
  return { formaat: k.FORMAAT, records };
}
const geweigerd = (f, code) => assert.throws(f, e => e.code === code);

test('kanoniek sorteert sleutels, ook in arrays en geneste objecten', () => {
  assert.equal(k.kanoniek({ b: [2, { d: 1, c: 'x' }], a: null }), '{"a":null,"b":[2,{"c":"x","d":1}]}');
  assert.equal(k.kanoniek([]), '[]');
  assert.equal(k.kanoniek('s'), '"s"');
});

test('een correct getekende keten met de hand verifieert; dat is de nulmeting van de toetsen hieronder', t => {
  const w = wortel(t);
  const u = k.controleer(ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }]), trust.anchors(w.root));
  assert.deepEqual(u.fouten, []);
  assert.equal(u.ok, true);
});

test('velden die geen object zijn, of een ontbrekend veld, geven precies die klacht', t => {
  const w = wortel(t);
  const ankers = trust.anchors(w.root);
  for (const velden of [null, 'tekst', ['a']]) {
    const u = k.controleer(ketenVan(w, [{ soort: 'gebouwd', velden }]), ankers);
    assert.deepEqual(u.fouten, ['record 1: velden ontbreken'], JSON.stringify(velden));
  }
  const zonderRun = bouw('a'); delete zonderRun.run;
  assert.deepEqual(k.controleer(ketenVan(w, [{ soort: 'gebouwd', velden: zonderRun }]), ankers).fouten, ['record 1: veld ontbreekt: run']);
  const getestZonderBool = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }]);
  const g = getestZonderBool.records[0];
  const metTekst = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }, { soort: 'getest', velden: test_(g, { geslaagd: 'ja' }) }]);
  assert.deepEqual(k.controleer(metTekst, ankers).fouten, ['record 2: veld heeft niet de vorm: geslaagd']);
});

test('een tijd die de vorm heeft maar geen datum is, en een tijd zonder vorm, zijn ongeldig', t => {
  const w = wortel(t);
  const ankers = trust.anchors(w.root);
  for (const tijd of ['2026-13-45T99:99:99.000Z', 'gisteren']) {
    const u = k.controleer(ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a'), tijd }]), ankers);
    assert.deepEqual(u.fouten, ['record 1: ongeldige tijd'], tijd);
  }
});

test('image en backup met hetzelfde digest is geen geldig bouwrecord', t => {
  const w = wortel(t);
  const u = k.controleer(ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a', { backupDigest: dig('a') }) }]), trust.anchors(w.root));
  assert.deepEqual(u.fouten, ['record 1: image en backup hebben hetzelfde digest']);
});

test('een getest-record dat naar een niet-bouwrecord wijst, en een promotie van een ander image-id', t => {
  const w = wortel(t);
  const ankers = trust.anchors(w.root);
  const basis = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }]);
  const g = basis.records[0];
  const metTest = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }, { soort: 'getest', velden: test_(g) }]);
  const tr = metTest.records[1];
  /* een tweede getest die naar het EERSTE getest-record wijst in plaats van een bouwrecord */
  const fout = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }, { soort: 'getest', velden: test_(g) },
    { soort: 'getest', velden: test_(g, { gebouwdRecord: tr.hash }) }]);
  assert.deepEqual(k.controleer(fout, ankers).fouten, ['record 3: verwijst naar een gebouwd-record dat er niet eerder staat']);
  const prom = {
    commit: COMMIT, digest: dig('a'), backupDigest: dig('b'), imageId: dig('7'), backupImageId: dig('2'),
    omgeving: 'productie', besluit: 'CAB', goedgekeurdDoor: 'authority', testRecord: tr.hash };
  const anderId = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }, { soort: 'getest', velden: test_(g) }, { soort: 'gepromoveerd', velden: prom }]);
  assert.deepEqual(k.controleer(anderId, ankers).fouten, ['record 3: promotie van een ander image-id dan het gebouwde']);
});

test('terugdraaien zonder actief digest, en naar het actieve digest zelf, worden beide gemeld', t => {
  const w = wortel(t);
  const ankers = trust.anchors(w.root);
  const g = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }]).records[0];
  const tr = ketenVan(w, [{ soort: 'gebouwd', velden: bouw('a') }, { soort: 'getest', velden: test_(g) }]).records[1];
  const prom = { commit: COMMIT, digest: dig('a'), backupDigest: dig('b'), imageId: dig('1'), backupImageId: dig('2'),
    omgeving: 'staging', besluit: 'CAB', goedgekeurdDoor: 'authority', testRecord: tr.hash };
  const drie = [{ soort: 'gebouwd', velden: bouw('a') }, { soort: 'getest', velden: test_(g) }, { soort: 'gepromoveerd', velden: prom }];
  const p = ketenVan(w, drie).records[2];
  const terug = { vanDigest: dig('a'), naarDigest: dig('a'), naarBackupDigest: dig('b'), naarImageId: dig('1'), naarBackupImageId: dig('2'),
    omgeving: 'productie', besluit: 'CAB-T', goedgekeurdDoor: 'authority', doelRecord: p.hash };
  const u = k.controleer(ketenVan(w, [...drie, { soort: 'terugdraai', velden: terug }]), ankers);
  assert.deepEqual(u.fouten, [
    'record 4: terugdraaien naar een digest dat nooit in deze omgeving gepromoveerd was',
    'record 4: terugdraaien zonder actief digest',
    'record 4: terugdraaien naar het actieve digest is geen terugdraaien']);
  /* in de juiste omgeving blijft alleen de laatste klacht over */
  const zelf = k.controleer(ketenVan(w, [...drie, { soort: 'terugdraai', velden: { ...terug, omgeving: 'staging' } }]), ankers);
  assert.deepEqual(zelf.fouten, ['record 4: terugdraaien naar het actieve digest is geen terugdraaien']);
});

test('een keten zonder records-array is geen keten, en een record dat geen object is krijgt een volgnummerklacht', t => {
  const w = wortel(t);
  const ankers = trust.anchors(w.root);
  assert.deepEqual(k.controleer({ formaat: k.FORMAAT }, ankers), { ok: false, fouten: ['geen geldige artefactketen'], records: [] });
  assert.deepEqual(k.controleer(null, ankers).fouten, ['geen geldige artefactketen']);
  const u = k.controleer({ formaat: k.FORMAAT, records: [null] }, { BUILD: {} });
  assert.deepEqual(u.fouten, ['vaste vertrouwensankers ontbreken']);
  assert.deepEqual(k.controleer({ formaat: k.FORMAAT, records: [null, 7] }, ankers).fouten,
    ['record 1: onbekende soort of volgnummer', 'record 2: onbekende soort of volgnummer']);
});

test('voegToe weigert een onbekende soort voordat er iets gelezen wordt', t => {
  const w = wortel(t);
  geweigerd(() => k.voegToe(w.root, 'verzonnen', {}, { env: w.env }), 'KETEN_SOORT');
  assert.equal(fs.existsSync(path.join(w.root, k.REL)), false);
  assert.deepEqual(k.leesOfLeeg(w.root), { formaat: k.FORMAAT, records: [] });
});

test('lees weigert een leeg bestand en een map', t => {
  const w = wortel(t);
  const pad = path.join(w.root, k.REL);
  fs.mkdirSync(path.dirname(pad), { recursive: true });
  fs.writeFileSync(pad, '');
  geweigerd(() => k.lees(w.root), 'KETEN_ONLEESBAAR');
  fs.rmSync(pad);
  fs.mkdirSync(pad);
  geweigerd(() => k.lees(w.root), 'KETEN_ONLEESBAAR');
});

test('eisTerugdraai zonder digest, en eisBewezenActief na een terugdraai, en zonder enig besluit', t => {
  const w = wortel(t);
  const g1 = k.voegToe(w.root, 'gebouwd', bouw('a'), { env: w.env });
  const t1 = k.voegToe(w.root, 'getest', test_(g1), { env: w.env });
  const promVelden = (tr, d, b) => ({ commit: COMMIT, digest: d, backupDigest: b, imageId: dig('1'), backupImageId: dig('2'),
    omgeving: 'pilot', besluit: 'CAB', goedgekeurdDoor: 'authority', testRecord: tr.hash });
  const p1 = k.voegToe(w.root, 'gepromoveerd', promVelden(t1, dig('a'), dig('b')), { env: w.env });
  const g2 = k.voegToe(w.root, 'gebouwd', bouw('c', { imageId: dig('3'), backupImageId: dig('4') }), { env: w.env });
  const t2 = k.voegToe(w.root, 'getest', test_(g2), { env: w.env });
  k.voegToe(w.root, 'gepromoveerd', { ...promVelden(t2, dig('c'), dig('d')), imageId: dig('3'), backupImageId: dig('4') }, { env: w.env });
  const keten0 = k.geverifieerd(w.root);
  /* nu is c actief: een terugdraaibesluit naar a ontbreekt nog */
  geweigerd(() => k.eisTerugdraai(keten0, { naarDigest: dig('a'), omgeving: 'pilot' }), 'GEEN_ROLLBACKBESLUIT');
  geweigerd(() => k.eisTerugdraai(keten0, { omgeving: 'pilot' }), 'ROLLBACK_GEEN_DIGEST');
  geweigerd(() => k.eisBewezenActief(keten0, { imageId: dig('1'), omgeving: 'pilot' }), 'ACTIEF_ONBEWEZEN');
  assert.equal(k.eisBewezenActief(keten0, { imageId: dig('3'), omgeving: 'pilot' }).velden.digest, dig('c'));

  const r = k.voegToe(w.root, 'terugdraai', { vanDigest: dig('c'), naarDigest: dig('a'), naarBackupDigest: dig('b'), naarImageId: dig('1'),
    naarBackupImageId: dig('2'), omgeving: 'pilot', besluit: 'CAB-T', goedgekeurdDoor: 'authority', doelRecord: p1.hash }, { env: w.env });
  const keten = k.geverifieerd(w.root);
  assert.equal(k.eisBewezenActief(keten, { imageId: dig('1'), omgeving: 'pilot' }).hash, r.hash, 'na terugdraaien telt het naar-image');
  geweigerd(() => k.eisBewezenActief(keten, { imageId: dig('3'), omgeving: 'pilot' }), 'ACTIEF_ONBEWEZEN');
  geweigerd(() => k.eisGepromoveerd(keten, { commit: COMMIT, digest: dig('a'), backupDigest: dig('b'), imageId: dig('1'),
    backupImageId: dig('2'), omgeving: 'pilot' }), 'GEEN_PROMOTIEBESLUIT');
  assert.equal(k.huidigUit(keten.records, 'staging'), null);
});
