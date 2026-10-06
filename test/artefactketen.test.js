'use strict';
/* GARANTIE 1 en 2 van de releasefase: de keten commit -> build -> digest -> test
   -> promotie -> rollback is aan EXACTE digests gebonden en fail-closed. Elke
   toets die hieronder zakt wanneer iemand de bescherming weghaalt, is met een
   aanval geschreven: een ander digest, een gemanipuleerd record, een herbouw. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const trust = require('../server/config/release-trust');
const k = require('../scripts/lib/artefactketen');
const { wortel, COMMIT, dig, bouw, test_ } = require('./lib/artefact-fixture');

const geweigerd = (f, code) => assert.throws(f, e => (!code || e.code === code) || (assert.fail('verkeerde fout: ' + e.code + ' ' + e.message), false));
function gebouwdEnGetest(w, c, o = {}) {
  const g = k.voegToe(w.root, 'gebouwd', bouw(c), { env: w.env });
  const t = k.voegToe(w.root, 'getest', test_(g, o), { env: w.env });
  return { g, t };
}
const prom = (w, t, extra = {}, omgeving = 'productie') => k.voegToe(w.root, 'gepromoveerd', { commit: t.velden.commit, digest: t.velden.digest,
  backupDigest: t.velden.backupDigest, imageId: dig('1'), backupImageId: dig('2'), omgeving, besluit: 'CAB-1', goedgekeurdDoor: 'authority', testRecord: t.hash, ...extra }, { env: w.env });

test('1. de volledige keten: bouwen, testen, promoveren, nieuwe release, terugdraaien -- en alles verifieert', t => {
  const w = wortel(t);
  const a = gebouwdEnGetest(w, 'a'); const pa = prom(w, a.t);
  const b = gebouwdEnGetest(w, 'c'); const pb = prom(w, b.t, { imageId: dig('1') });
  k.voegToe(w.root, 'terugdraai', { vanDigest: dig('c'), naarDigest: dig('a'), naarBackupDigest: dig('b'), naarImageId: dig('1'), naarBackupImageId: dig('2'),
    omgeving: 'productie', besluit: 'CAB-2', goedgekeurdDoor: 'authority', doelRecord: pa.hash }, { env: w.env });
  const keten = k.geverifieerd(w.root);
  assert.equal(keten.records.length, 7);
  assert.equal(k.huidigUit(keten.records, 'productie').digest, dig('a'));
  assert.equal(pb.velden.digest, dig('c'));
  assert.equal(fs.statSync(path.join(w.root, k.REL)).mode & 0o077, 0, 'bestand niet voor anderen leesbaar');
});

test('2. NEGATIEF promotie: een digest dat nooit gebouwd, nooit getest, of mislukt getest is, kan niet gepromoveerd worden', t => {
  const w = wortel(t);
  const g = k.voegToe(w.root, 'gebouwd', bouw('a'), { env: w.env });
  const nepTest = { ...test_(g), digest: dig('9') };
  geweigerd(() => k.voegToe(w.root, 'getest', nepTest, { env: w.env }), 'KETEN_WEIGERT');
  geweigerd(() => k.voegToe(w.root, 'gepromoveerd', { commit: COMMIT, digest: dig('a'), backupDigest: dig('b'), imageId: dig('1'), backupImageId: dig('2'),
    omgeving: 'productie', besluit: 'x', goedgekeurdDoor: 'y', testRecord: g.hash }, { env: w.env }), 'KETEN_WEIGERT');   // geen testrecord: verwijst naar het bouwrecord
  const mislukt = k.voegToe(w.root, 'getest', test_(g, { geslaagd: false }), { env: w.env });
  geweigerd(() => prom(w, mislukt), 'KETEN_WEIGERT');
  const ander = k.voegToe(w.root, 'getest', test_(g, { waargenomenDigest: dig('9'), geslaagd: false }), { env: w.env });
  geweigerd(() => prom(w, ander), 'KETEN_WEIGERT');
  geweigerd(() => k.voegToe(w.root, 'getest', test_(g, { waargenomenDigest: dig('9'), geslaagd: true }), { env: w.env }), 'KETEN_WEIGERT');
  assert.equal(k.geverifieerd(w.root).records.length, 3, 'geweigerde records zijn niet weggeschreven');
});

test('3. NEGATIEF herbouw: dezelfde commit opnieuw bouwen is een ANDER artefact en erft het testbewijs niet', t => {
  const w = wortel(t);
  const { t: ta } = gebouwdEnGetest(w, 'a');
  const g2 = k.voegToe(w.root, 'gebouwd', bouw('c'), { env: w.env });               // dezelfde commit, nieuw digest
  geweigerd(() => prom(w, ta, { digest: dig('c'), backupDigest: dig('d') }), 'KETEN_WEIGERT');   // oud testbewijs, nieuw digest
  geweigerd(() => k.voegToe(w.root, 'getest', test_(g2, { gebouwdRecord: k.geverifieerd(w.root).records[0].hash }), { env: w.env }), 'KETEN_WEIGERT');
  geweigerd(() => k.voegToe(w.root, 'gebouwd', bouw('c'), { env: w.env }), 'KETEN_WEIGERT');   // hetzelfde digest twee keer "gebouwd"
  const keten = k.geverifieerd(w.root);
  geweigerd(() => k.eisGetest(keten, { commit: COMMIT, digest: dig('c'), backupDigest: dig('d') }), 'GEEN_TESTBEWIJS');
});

test('4. NEGATIEF manipulatie achteraf: elk gewijzigd, verwijderd, verplaatst of nagemaakt record laat de keten zakken', t => {
  const w = wortel(t);
  const a = gebouwdEnGetest(w, 'a'); prom(w, a.t);
  const origineel = JSON.parse(fs.readFileSync(path.join(w.root, k.REL), 'utf8'));
  const ankers = trust.anchors(w.root);
  const kopie = () => JSON.parse(JSON.stringify(origineel));
  assert.equal(k.controleer(kopie(), ankers).ok, true);
  const muteer = (naam, f) => { const x = kopie(); f(x); const u = k.controleer(x, ankers); assert.equal(u.ok, false, naam); return u; };
  muteer('digest van het artefact na de test vervangen', x => { x.records[0].velden.digest = dig('9'); });
  muteer('testbewijs-hash aangepast', x => { x.records[1].velden.testBewijsSha256 = 'd'.repeat(64); });
  muteer('geslaagd omgezet', x => { x.records[1].velden.geslaagd = !x.records[1].velden.geslaagd; });
  muteer('record uit het midden', x => { x.records.splice(1, 1); });
  muteer('volgorde gewisseld', x => { x.records.reverse(); });
  muteer('laatste record weg en vorige hash geknipt is NIET zichtbaar -- maar een extra onbekend veld wel', x => { x.records[2].velden.extra = 'x'; });
  muteer('onbekende soort', x => { x.records[2].soort = 'sneak'; });
  muteer('handtekening van een ander record', x => { x.records[2].handtekening = x.records[1].handtekening; });
  // alles opnieuw hashen en ketenen maar met een EIGEN sleutel: valt op de vaste ankers
  const eigen = require('node:crypto').generateKeyPairSync('ed25519');
  const x = kopie(); const r = x.records[1];
  r.velden.digest = dig('9'); r.velden.waargenomenDigest = dig('9');
  r.handtekening = trust.sign('BUILD', Buffer.from(k.kanoniek({ nr: r.nr, soort: r.soort, tijd: r.tijd, vorige: r.vorige, velden: r.velden })), eigen.privateKey);
  assert.equal(k.controleer(x, ankers).ok, false, 'een nagemaakt record met een andere sleutel');
  // rol-scheiding: het promotiebesluit tekenen met de BUILD-sleutel mag niet
  const y = kopie(); const p = y.records[2];
  p.handtekening = trust.sign('BUILD', Buffer.from(k.kanoniek({ nr: p.nr, soort: p.soort, tijd: p.tijd, vorige: p.vorige, velden: p.velden })), w.sleutels.BUILD);
  assert.equal(k.controleer(y, ankers).ok, false, 'promotie moet door de PROMOTION-rol getekend zijn');
  // een verifieerder zonder (bekend) anker faalt dicht
  assert.equal(k.controleer(kopie(), null).ok, false);
  assert.equal(k.controleer({ formaat: 'iets-anders', records: [] }, ankers).ok, false);
});

test('5. een beschadigde of ontbrekende keten wordt nooit aangevuld of stilzwijgend vervangen', t => {
  const w = wortel(t);
  gebouwdEnGetest(w, 'a');
  const pad = path.join(w.root, k.REL);
  const goed = fs.readFileSync(pad);
  const x = JSON.parse(goed); x.records[0].velden.run = 'andere-run';
  fs.writeFileSync(pad, JSON.stringify(x));
  geweigerd(() => k.voegToe(w.root, 'gebouwd', bouw('c'), { env: w.env }), 'KETEN_ONGELDIG');
  assert.equal(fs.readFileSync(pad, 'utf8'), JSON.stringify(x), 'het bestand is niet aangeraakt');
  fs.writeFileSync(pad, '{kapot');
  geweigerd(() => k.geverifieerd(w.root), 'KETEN_ONLEESBAAR');
  fs.rmSync(pad);
  geweigerd(() => k.geverifieerd(w.root), 'KETEN_ONLEESBAAR');
  fs.symlinkSync('/etc/hostname', pad);
  geweigerd(() => k.geverifieerd(w.root), 'KETEN_ONLEESBAAR');
});

test('6. gates: de deploy-poort laat ALLEEN het goedgekeurde digest door, op digest EN image-id', t => {
  const w = wortel(t);
  const a = gebouwdEnGetest(w, 'a'); prom(w, a.t);
  const keten = () => k.geverifieerd(w.root);
  const ok = { commit: COMMIT, digest: dig('a'), backupDigest: dig('b'), imageId: dig('1'), backupImageId: dig('2'), omgeving: 'productie' };
  assert.ok(k.eisGepromoveerd(keten(), ok));
  geweigerd(() => k.eisGepromoveerd(keten(), { ...ok, digest: dig('c') }), 'ANDER_DIGEST');
  geweigerd(() => k.eisGepromoveerd(keten(), { ...ok, imageId: dig('7') }), 'ANDER_DIGEST');          // zelfde digest, ander image-id: lokaal vervangen artefact
  geweigerd(() => k.eisGepromoveerd(keten(), { ...ok, backupDigest: dig('f') }), 'ANDER_DIGEST');
  geweigerd(() => k.eisGepromoveerd(keten(), { ...ok, omgeving: 'staging' }), 'GEEN_PROMOTIEBESLUIT');
  // een niet-gepromoveerd, wel geteste release is niet deploybaar
  const b = gebouwdEnGetest(w, 'c');
  geweigerd(() => k.eisGepromoveerd(keten(), { ...ok, digest: dig('c'), backupDigest: dig('d') }), 'ANDER_DIGEST');
  assert.ok(b.t);
});

test('7. NEGATIEF rollback: alleen naar een eerder goedgekeurd digest, benoemd als digest, vanaf het actieve digest', t => {
  const w = wortel(t);
  const a = gebouwdEnGetest(w, 'a'); const pa = prom(w, a.t);
  const b = gebouwdEnGetest(w, 'c'); prom(w, b.t);
  const d = gebouwdEnGetest(w, 'e');                                                          // gebouwd en getest, NOOIT gepromoveerd
  const basis = { vanDigest: dig('c'), naarDigest: dig('a'), naarBackupDigest: dig('b'), naarImageId: dig('1'), naarBackupImageId: dig('2'),
    omgeving: 'productie', besluit: 'CAB-9', goedgekeurdDoor: 'authority', doelRecord: pa.hash };
  const probeer = extra => k.voegToe(w.root, 'terugdraai', { ...basis, ...extra }, { env: w.env });
  geweigerd(() => probeer({ naarDigest: 'main' }), 'KETEN_WEIGERT');                           // branch
  geweigerd(() => probeer({ naarDigest: 'v1.2.3' }), 'KETEN_WEIGERT');                         // tag
  geweigerd(() => probeer({ naarDigest: COMMIT }), 'KETEN_WEIGERT');                           // commit-sha
  geweigerd(() => probeer({ naarDigest: dig('e'), naarBackupDigest: dig('f'), doelRecord: d.t.hash }), 'KETEN_WEIGERT');   // getest maar nooit goedgekeurd
  geweigerd(() => probeer({ naarDigest: dig('9'), doelRecord: 'f'.repeat(64) }), 'KETEN_WEIGERT');                        // onbekend digest
  geweigerd(() => probeer({ vanDigest: dig('a') }), 'KETEN_WEIGERT');                          // niet vanaf het actieve digest
  geweigerd(() => probeer({ omgeving: 'staging' }), 'KETEN_WEIGERT');                          // in een andere omgeving nooit goedgekeurd
  geweigerd(() => probeer({ naarImageId: dig('8') }), 'KETEN_WEIGERT');                        // ander image-id dan goedgekeurd
  const goed = probeer({});
  const keten = k.geverifieerd(w.root);
  assert.deepEqual(k.rollbackDoel(keten, { naarDigest: dig('a'), omgeving: 'productie' }), { digest: dig('a'), backupDigest: dig('b'), imageId: dig('1'), backupImageId: dig('2'), record: goed.hash });
  geweigerd(() => k.rollbackDoel(keten, { naarDigest: dig('c'), omgeving: 'productie' }), 'GEEN_ROLLBACKBESLUIT');   // het besluit gaat naar a, niet c
  geweigerd(() => k.rollbackDoel(keten, { naarDigest: 'latest', omgeving: 'productie' }), 'ROLLBACK_GEEN_DIGEST');
  // en na het terugdraaien is het nieuwere digest NIET meer deploybaar zonder nieuw besluit
  geweigerd(() => k.eisGepromoveerd(keten, { commit: COMMIT, digest: dig('c'), backupDigest: dig('d'), imageId: dig('1'), backupImageId: dig('2'), omgeving: 'productie' }), 'GEEN_PROMOTIEBESLUIT');
});

test('8. het draaiende image moet zelf een goedgekeurd artefact zijn voordat er iets overheen mag', t => {
  const w = wortel(t);
  const a = gebouwdEnGetest(w, 'a'); prom(w, a.t);
  const keten = k.geverifieerd(w.root);
  assert.ok(k.eisBewezenActief(keten, { imageId: dig('1'), omgeving: 'productie' }));
  geweigerd(() => k.eisBewezenActief(keten, { imageId: dig('5'), omgeving: 'productie' }), 'ACTIEF_ONBEWEZEN');
  geweigerd(() => k.eisBewezenActief(keten, { imageId: dig('1'), omgeving: 'staging' }), 'ACTIEF_ONBEWEZEN');
});

test('9. de sleutelkeuze: een record wordt alleen getekend met de sleutel die bij het vaste anker van zijn rol hoort', t => {
  const w = wortel(t);
  const vals = require('node:crypto').generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  geweigerd(() => k.voegToe(w.root, 'gebouwd', bouw('a'), { env: { ...w.env, RTG_RELEASE_SIGN_KEY: vals } }));
  geweigerd(() => k.voegToe(w.root, 'gebouwd', bouw('a'), { env: { ...w.env, RTG_RELEASE_SIGN_KEY: w.env.RTG_PROMOTION_SIGN_KEY } }));
  geweigerd(() => k.voegToe(w.root, 'gebouwd', bouw('a'), { env: {} }));
  assert.equal(fs.existsSync(path.join(w.root, k.REL)), false);
});

/* ---------- de CLI en de test-op-digest, met een nep-docker ---------- */
const cp = require('node:child_process');
const os = require('node:os');
const NEP_BRON = fs.readFileSync(path.join(__dirname, 'lib', 'nep-docker.js'), 'utf8');
const REPO = path.join(__dirname, '..');
function cliWortel(t) {
  const w = wortel(t);
  for (const f of ['scripts/artefactketen.js', 'scripts/lib/artefactketen.js', 'scripts/lib/artefacttest.js', 'server/config/release-trust.js', 'test/artefact-image.test.js']) {
    fs.mkdirSync(path.dirname(path.join(w.root, f)), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), path.join(w.root, f));
  }
  w.log = path.join(w.root, 'docker.log');
  fs.mkdirSync(path.join(w.root, 'bin'));
  fs.writeFileSync(path.join(w.root, 'bin', 'docker'), '#!' + process.execPath + '\n' + NEP_BRON, { mode: 0o755 });
  w.cli = (args, env = {}) => cp.spawnSync(process.execPath, [path.join(w.root, 'scripts/artefactketen.js'), ...args], { cwd: w.root, encoding: 'utf8',
    env: { PATH: path.join(w.root, 'bin') + path.delimiter + process.env.PATH, ...w.env, NEP_LOG: w.log, ...env } });
  return w;
}
const bouwArgs = ['gebouwd', '--commit=' + COMMIT, '--run=run-1', '--digest=' + dig('a'), '--backup-digest=' + dig('b'), '--image-id=' + dig('1'), '--backup-image-id=' + dig('2')];
const testArgs = ['testen', '--commit=' + COMMIT, '--repo=ghcr.io/rtg/app', '--digest=' + dig('a'), '--backup-repo=ghcr.io/rtg/backup', '--backup-digest=' + dig('b')];

test('10. CLI-keten met nep-docker: bouwen, testen op het digest, promoveren, deploy-poort, terugdraaien -- en er wordt nergens gebouwd', t => {
  const w = cliWortel(t);
  assert.equal(w.cli(bouwArgs).status, 0);
  const r = w.cli(testArgs); assert.equal(r.status, 0, r.stderr + r.stdout);
  const log = fs.readFileSync(w.log, 'utf8');
  assert.match(log, /pull ghcr\.io\/rtg\/app@sha256:a{64}/, 'getest wordt bij DIGEST opgehaald');
  assert.match(log, /artefact-image\.test\.js/, 'de toets draait in het image');
  assert.equal(w.cli(['promoveer', '--digest=' + dig('a'), '--omgeving=productie', '--besluit=CAB-7', '--door=authority']).status, 0);
  const ok = w.cli(['eis-promotie', '--commit=' + COMMIT, '--digest=' + dig('a'), '--backup-digest=' + dig('b'), '--image-id=' + dig('1'), '--backup-image-id=' + dig('2'), '--omgeving=productie']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(w.cli(['eis-actief', '--image-id=' + dig('1'), '--omgeving=productie']).status, 0);
  assert.doesNotMatch(fs.readFileSync(w.log, 'utf8'), /^build/m, 'geen enkele build in test of promotie');
  assert.ok(fs.existsSync(path.join(w.root, '.release/artefacttest-bewijs.json')), 'machineleesbaar testbewijs');
});

test('11. NEGATIEF CLI: test mislukt / ander digest waargenomen / pull faalt -> exit 1, record geslaagd:false, geen promotie mogelijk', t => {
  for (const env of [{ NEP_DIGEST: dig('9') }, { NEP_PULL_FAALT: '1' }, { NEP_TOETS_FAALT: '1' }]) {
    const w = cliWortel(t);
    assert.equal(w.cli(bouwArgs).status, 0);
    const r = w.cli(testArgs, env);
    assert.equal(r.status, 1, JSON.stringify(env));
    const p = w.cli(['promoveer', '--digest=' + dig('a'), '--omgeving=productie', '--besluit=CAB-7', '--door=authority']);
    assert.equal(p.status, 1, 'promotie na mislukte test: ' + JSON.stringify(env));
    assert.match(p.stderr, /GEEN_TESTBEWIJS/);
  }
});

test('12. NEGATIEF CLI: testen kan alleen een digest dat als gebouwd vastligt; tags worden geweigerd; promoveren van een onbekend digest ook', t => {
  const w = cliWortel(t);
  assert.equal(w.cli(testArgs).status, 1, 'zonder bouwrecord');
  assert.equal(w.cli(bouwArgs).status, 0);
  assert.equal(w.cli(testArgs.map(a => a.startsWith('--digest=') ? '--digest=latest' : a)).status, 1, 'tag in plaats van digest');
  assert.equal(w.cli(['promoveer', '--digest=' + dig('7'), '--omgeving=productie', '--besluit=x', '--door=y']).status, 1);
  assert.equal(w.cli(['promoveer', '--digest=' + dig('a'), '--omgeving=productie', '--besluit=x', '--door=y']).status, 1, 'gebouwd maar niet getest');
});

test('13. NEGATIEF CLI rollback: zonder digest, naar tag, naar onbewezen digest -> exit 1; naar het goedgekeurde digest -> alleen DAN drukt de poort de id\'s af', t => {
  const w = cliWortel(t);
  const cycle = (c, d, id) => {
    const bouwen = ['gebouwd', '--commit=' + COMMIT, '--run=r' + c, '--digest=' + dig(c), '--backup-digest=' + dig(d), '--image-id=' + dig(id), '--backup-image-id=' + dig('2')];
    assert.equal(w.cli(bouwen).status, 0);
    assert.equal(w.cli(['testen', '--commit=' + COMMIT, '--repo=r/a', '--digest=' + dig(c), '--backup-repo=r/b', '--backup-digest=' + dig(d)]).status, 0);
  };
  cycle('a', 'b', '1'); cycle('c', 'd', '3');
  const pr = c => w.cli(['promoveer', '--digest=' + dig(c), '--omgeving=productie', '--besluit=CAB-' + c, '--door=authority']);
  assert.equal(pr('a').status, 0); assert.equal(pr('c').status, 0);
  const td = n => w.cli(['terugdraai', '--naar=' + n, '--omgeving=productie', '--besluit=CAB-R', '--door=authority']);
  assert.equal(td('main').status, 1); assert.equal(td('v1.0.0').status, 1); assert.equal(td(COMMIT).status, 1); assert.equal(td(dig('9')).status, 1);
  assert.equal(w.cli(['eis-rollback', '--naar=' + dig('a'), '--omgeving=productie']).status, 1, 'nog geen terugdraaibesluit');
  assert.equal(td(dig('a')).status, 0);
  const d = w.cli(['eis-rollback', '--naar=' + dig('a'), '--omgeving=productie']);
  assert.equal(d.status, 0, d.stderr);
  assert.deepEqual(d.stdout.trim().split('\n'), [dig('a'), dig('b'), dig('1'), dig('2')]);
  assert.equal(w.cli(['eis-rollback', '--naar=' + dig('c'), '--omgeving=productie']).status, 1, 'het besluit gaat naar a, niet naar c');
  assert.equal(w.cli(['eis-promotie', '--commit=' + COMMIT, '--digest=' + dig('c'), '--backup-digest=' + dig('d'), '--image-id=' + dig('3'), '--backup-image-id=' + dig('2'), '--omgeving=productie']).status, 1, 'na terugdraaien is c niet meer goedgekeurd om actief te zijn');
});

test('14. ONBEREIKBAARHEID: een CLI zonder keten, met kapotte keten of zonder sleutel faalt dicht (exit 1), nooit stil door', t => {
  const w = cliWortel(t);
  for (const c of [['controleer'], ['eis-actief', '--image-id=' + dig('1'), '--omgeving=productie'], ['eis-rollback', '--naar=' + dig('a'), '--omgeving=productie']]) assert.equal(w.cli(c).status, 1, c[0] + ' zonder keten');
  assert.equal(w.cli(bouwArgs).status, 0);
  fs.appendFileSync(path.join(w.root, k.REL), 'rommel');
  assert.equal(w.cli(['controleer']).status, 1);
  const zonder = cliWortel(t);
  assert.equal(zonder.cli(bouwArgs, { RTG_RELEASE_SIGN_KEY: '' }).status, 1);
  assert.equal(w.cli(['onbekend']).status, 1);
});

test('15. de promotiepoort (productie-promotie) en de uitrolpoort weigeren een kandidaat die de keten niet goedkeurt', t => {
  const promotie = require('../scripts/lib/productie-promotie');
  const w = wortel(t);
  const a = gebouwdEnGetest(w, 'a');
  const kand = (d, b, id) => ({ image: { digest: dig(d), id: dig(id) }, backup: { digest: dig(b), id: dig('2') } });
  const eis = (x, env) => promotie.eisKetenbesluit(w.root, COMMIT, x, env);
  geweigerd(() => eis(kand('a', 'b', '1')), 'GEEN_PROMOTIEBESLUIT');                    // getest maar niet goedgekeurd
  prom(w, a.t);
  assert.ok(eis(kand('a', 'b', '1')));
  geweigerd(() => eis(kand('c', 'd', '1')), 'ANDER_DIGEST');                              // een herbouw met ander digest
  geweigerd(() => eis(kand('a', 'b', '5')), 'ANDER_DIGEST');                              // zelfde digest, vervangen image
  geweigerd(() => eis(kand('a', 'b', '1'), { RTG_OMGEVING: 'staging' }), 'GEEN_PROMOTIEBESLUIT');
  fs.writeFileSync(path.join(w.root, k.REL), fs.readFileSync(path.join(w.root, k.REL), 'utf8').replace(dig('a'), dig('9')));
  geweigerd(() => eis(kand('a', 'b', '1')), 'KETEN_ONGELDIG');                           // artefact na de test vervangen
  assert.match(fs.readFileSync(path.join(REPO, 'scripts/lib/productie-promotie.js'), 'utf8'), /if \(!isNative\) eisKetenbesluit\(/);
});
