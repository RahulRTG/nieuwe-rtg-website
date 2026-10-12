'use strict';
/* Het promotieboek: het bewijsarchief bij de artefactketen. Een rollback gaat
   alleen naar een image dat de ARTEFACTKETEN als gepromoveerd kent en waarvan
   de kwalificatie en de ondertekende promotie bewaard zijn
   (scripts/lib/promotieboek.js). Er is een releaseketen: het boek beslist
   niets zonder haar.

   Twee lagen. De module zelf, met elke manier waarop een rollbackdoel vals kan
   zijn -- ook een boek dat klopt terwijl de keten het image niet kent. En
   `scripts/docker/live.sh rollback sha256:...` als PROCES, met een nep-docker
   op PATH die elke aanroep opschrijft: een onbewezen doel komt nooit tot
   `compose up`, een bewezen doel wel -- en nergens wordt er gebouwd. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const trust = require('../server/config/release-trust');
const H = require('../scripts/imageherkomst');
const boek = require('../scripts/lib/promotieboek');
const keten = require('../scripts/lib/artefactketen');
const { wortel, COMMIT } = require('./lib/artefact-fixture');

const BRON = path.join(__dirname, '..');
const APP = 'sha256:' + 'a'.repeat(64), BCK = 'sha256:' + 'b'.repeat(64);
const DIG = 'sha256:' + 'c'.repeat(64), BDIG = 'sha256:' + 'd'.repeat(64);
const PIN = 'e'.repeat(64);
const OMG = 'productie';
/* Een tweede release (andere digests en image-ID's), om vanaf terug te draaien. */
const APP2 = 'sha256:' + '5'.repeat(64), BCK2 = 'sha256:' + '6'.repeat(64);
const DIG2 = 'sha256:' + '7'.repeat(64), BDIG2 = 'sha256:' + '8'.repeat(64);

/* Bouwen, testen en promoveren in de artefactketen -- de enige bron. */
function promoveer(w, { digest, backupDigest, imageId, backupImageId, run }) {
  const g = keten.voegToe(w.root, 'gebouwd', { commit: COMMIT, run, digest, backupDigest, imageId, backupImageId }, { env: w.env });
  const t = keten.voegToe(w.root, 'getest', { commit: COMMIT, digest, backupDigest, waargenomenDigest: digest,
    waargenomenBackupDigest: backupDigest, testBewijsSha256: '9'.repeat(64), geslaagd: true, gebouwdRecord: g.hash }, { env: w.env });
  return keten.voegToe(w.root, 'gepromoveerd', { commit: COMMIT, digest, backupDigest, imageId, backupImageId,
    omgeving: OMG, besluit: 'CAB-' + run, goedgekeurdDoor: 'authority', testRecord: t.hash }, { env: w.env });
}
const A = { digest: DIG, backupDigest: BDIG, imageId: APP, backupImageId: BCK, run: 'a' };
const C = { digest: DIG2, backupDigest: BDIG2, imageId: APP2, backupImageId: BCK2, run: 'c' };

function herkomstDoc(rol, digest, sleutel, kw = {}) {
  const doc = H.maakHerkomst({ image: 'ghcr.io/rtg/x:candidate', digest, sbomBytes: Buffer.from('{}'),
    sbomComponenten: 1, bewijs: { inhoudSha256: 'f'.repeat(64), bestandAantal: 3 },
    kwalificatie: { formaat: 'rtg-kwalificatie-v1', rol, imageId: APP, backupImageId: BCK,
      inhoudSha256: 'f'.repeat(64), bestandAantal: 3, imageBewijsSha256: '1'.repeat(64),
      voorSha256: '2'.repeat(64), naSha256: '3'.repeat(64), ...kw },
    gemaakt: '2026-10-06T00:00:00.000Z' });
  doc.handtekening = { algoritme: 'ed25519', waarde: H.teken(doc, sleutel) };
  return Buffer.from(JSON.stringify(doc) + '\n');
}

function promotieDoc(over = {}) {
  return Buffer.from(JSON.stringify({ formaat: 'rtg-productie-promotie-v2',
    ondertekenDomein: trust.ROLES.PROMOTION.domain, commit: '0'.repeat(40),
    kandidaat: { image: { id: APP, digest: DIG, immutable: 'x@' + DIG, bewijsBestandSha256: PIN },
      backup: { id: BCK, digest: BDIG, immutable: 'y@' + BDIG, herkomstSha256: '4'.repeat(64) } },
    ...over }) + '\n');
}

function opstelling(t) {
  const w = wortel(t);
  const root = w.root;
  fs.mkdirSync(path.join(root, '.release'), { recursive: true });
  const zet = (bytes = {}) => {
    const b = { promotie: promotieDoc(), herkomst: herkomstDoc('app', DIG, w.sleutels.BUILD),
      backupHerkomst: herkomstDoc('backup', BDIG, w.sleutels.BUILD), ...bytes };
    b.promotieSig = b.promotieSig || Buffer.from(trust.sign('PROMOTION', b.promotie, w.sleutels.PROMOTION) + '\n');
    for (const [naam, rel] of Object.entries(boek.BRONNEN)) fs.writeFileSync(path.join(root, rel), b[naam]);
  };
  return { ...w, sleutels: { BUILD: { privateKey: w.sleutels.BUILD }, PROMOTION: { privateKey: w.sleutels.PROMOTION } }, zet };
}
const doel = { imageId: APP, backupId: BCK, pin: PIN, omgeving: OMG };

test('een gekwalificeerde, ondertekende promotie die de keten kent wordt een bewezen rollbackdoel', t => {
  const w = opstelling(t);
  promoveer(w, A);
  w.zet();
  boek.archiveer(w.root, doel);
  assert.deepEqual(boek.controleerRollback(w.root, doel), []);
  // later is een andere release actief: het doel blijft bewezen, want de keten kent zijn promotie
  promoveer(w, C);
  assert.deepEqual(boek.controleerRollback(w.root, doel), []);
});

test('de keten beslist: zonder keten, of zonder actieve promotie van DIT image, geen archief en geen rollbackdoel', t => {
  const w = opstelling(t);
  w.zet();
  assert.throws(() => boek.archiveer(w.root, doel), /artefactketen/, 'zonder keten');
  promoveer(w, C);
  assert.throws(() => boek.archiveer(w.root, doel), /niet als actief gepromoveerd/, 'de keten kent een ander image');
  assert.match(boek.controleerRollback(w.root, doel).join(' '), /niet als gepromoveerd in de artefactketen/);
  promoveer(w, A);
  assert.throws(() => boek.archiveer(w.root, { ...doel, omgeving: 'staging' }), /niet als actief gepromoveerd/, 'andere omgeving');
  boek.archiveer(w.root, doel);
  assert.match(boek.controleerRollback(w.root, { ...doel, omgeving: 'staging' }).join(' '), /niet als gepromoveerd/);
  // een kapotte keten is nooit een lege lijst: dan is het nee
  fs.appendFileSync(path.join(w.root, keten.REL), 'rommel');
  assert.match(boek.controleerRollback(w.root, doel).join(' '), /artefactketen beslist en is niet te lezen/);
});

test('een archief dat naar een ander record wijst dan de keten, of andere digests noemt, wordt geweigerd', t => {
  const w = opstelling(t);
  promoveer(w, A);
  w.zet();
  boek.archiveer(w.root, doel);
  const idx = path.join(boek.mapVoor(w.root, APP), 'index.json');
  const i = JSON.parse(fs.readFileSync(idx, 'utf8'));
  fs.writeFileSync(idx, JSON.stringify({ ...i, ketenRecord: '0'.repeat(64) }));
  assert.match(boek.controleerRollback(w.root, doel).join(' '), /verwijst niet naar een gepromoveerd-record/);
  // een promotiedocument dat andere digests noemt dan het ketenrecord
  const w2 = opstelling(t);
  promoveer(w2, { ...A, digest: 'sha256:' + '4'.repeat(64) });
  w2.zet();
  assert.throws(() => boek.archiveer(w2.root, doel), /andere digests dan het gepromoveerd-record/);
});

test('een image dat nooit gepromoveerd is, of een ander stel ID\'s, is geen rollbackdoel', t => {
  const w = opstelling(t);
  const { root, zet } = w;
  promoveer(w, A);
  zet();
  boek.archiveer(root, doel);
  const anders = 'sha256:' + '9'.repeat(64);
  assert.match(boek.controleerRollback(root, { ...doel, imageId: anders }).join(' '), /niet als gepromoveerd in de artefactketen/);
  assert.match(boek.controleerRollback(root, { ...doel, backupId: anders }).join(' '), /niet als gepromoveerd in de artefactketen/);
  assert.match(boek.controleerRollback(root, { ...doel, pin: '0'.repeat(64) }).join(' '), /bewijspin/);
  assert.notEqual(boek.controleerRollback(root, { ...doel, imageId: 'latest' }).length, 0);
});

test('een veranderde byte in het boek, of een handtekening van de verkeerde rol, wordt geweigerd', t => {
  const w = opstelling(t);
  const { root, zet, sleutels } = w;
  promoveer(w, A);
  zet();
  boek.archiveer(root, doel);
  const map = boek.mapVoor(root, APP);
  const p = JSON.parse(fs.readFileSync(path.join(map, 'promotie'), 'utf8'));
  p.commit = '1'.repeat(40);
  fs.writeFileSync(path.join(map, 'promotie'), JSON.stringify(p) + '\n');
  assert.match(boek.controleerRollback(root, doel).join(' '), /PROMOTION-handtekening/);
  // archiveren met een promotie die door de BUILD-sleutel is getekend
  zet({ promotieSig: Buffer.from(trust.sign('BUILD', promotieDoc(), sleutels.BUILD.privateKey)) });
  assert.throws(() => boek.archiveer(root, doel), /PROMOTION-handtekening/);
});

test('een herkomst zonder kwalificatie van DIT image maakt geen rollbackdoel', t => {
  const w = opstelling(t);
  const { root, zet, sleutels } = w;
  promoveer(w, A);
  zet({ herkomst: herkomstDoc('app', DIG, sleutels.BUILD.privateKey, { imageId: 'sha256:' + '8'.repeat(64) }) });
  assert.throws(() => boek.archiveer(root, doel), /niet het gekwalificeerde app-image/);
  zet({ herkomst: herkomstDoc('app', 'sha256:' + '7'.repeat(64), sleutels.BUILD.privateKey) });
  assert.throws(() => boek.archiveer(root, doel), /ander digest/);
  const zonder = JSON.parse(herkomstDoc('app', DIG, sleutels.BUILD.privateKey).toString());
  delete zonder.kwalificatie; delete zonder.handtekening;
  zonder.handtekening = { algoritme: 'ed25519', waarde: H.teken(zonder, sleutels.BUILD.privateKey) };
  zet({ herkomst: Buffer.from(JSON.stringify(zonder)) });
  assert.throws(() => boek.archiveer(root, doel), /geen kwalificatie/);
});

/* ---- live.sh rollback als proces ------------------------------------------
   De ketenpoort (artefactketen eis-rollback) komt EERST en beslist; het
   promotieboek leest dezelfde keten en eist de bewaarde kwalificatie. Het
   auditboek (PostgreSQL) is hier een stomp die alleen zegt dat de regel staat:
   dat het echte boek schrijft en verankert, bewijzen de *.pg-toetsen. */
function liveOpstelling(t) {
  const o = opstelling(t);
  const { root } = o;
  for (const rel of ['scripts/docker/live.sh', 'scripts/promotieboek.js', 'scripts/lib/promotieboek.js',
    'scripts/lib/kwalificatie.js', 'scripts/release-bewijs.js', 'scripts/imageherkomst.js',
    'scripts/lib/stempel.js', 'server/config/release-trust.js', 'scripts/artefactketen.js', 'scripts/lib/artefactketen.js']) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(BRON, rel), path.join(root, rel));
  }
  fs.mkdirSync(path.join(root, 'server/kern'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server/kern/auditboek.js'),
    "exports.deelbaar = () => ({ noteerEnAnker: async r => { require('fs').appendFileSync(__dirname + '/../../audit.log', r.type + '\\n'); return { ok: true }; } });\n");
  // De TLS-proef praat met een echte host; hier zegt hij ja.
  fs.writeFileSync(path.join(root, 'scripts/publieke-tls-proef.js'), 'process.exit(0)\n');
  fs.writeFileSync(path.join(root, 'deploy/live.env'), 'RTG_IMAGE=rtg-app:live\n');
  fs.writeFileSync(path.join(root, '.env.productie'), 'APP_URL=https://rtg.example\n');
  const bin = path.join(root, 'nepbin');
  fs.mkdirSync(bin);
  const log = path.join(root, 'docker.log');
  const lokaal = { [APP]: DIG, [BCK]: BDIG };
  fs.writeFileSync(path.join(bin, 'docker'), '#!' + process.execPath + `
const fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},a.join(' ')+'\\n');
const lokaal=${JSON.stringify(lokaal)};
if(a.includes('build')){process.exit(99)}
if(a[0]==='image'&&a[1]==='inspect'){const id=a[a.length-1];if(!lokaal[id])process.exit(1);
  if(a.some(x=>x.includes('RepoDigests')))process.stdout.write(id+' ["ghcr.io/rtg/x@'+lokaal[id]+'"]\\n');process.exit(0)}
if(a[0]==='run'&&a.includes('sha256sum')){process.stdout.write(${JSON.stringify(PIN)}+'  /app/release-bewijs.json\\n');process.exit(0)}
process.exit(0)
`, { mode: 0o755 });
  const draai = (...args) => spawnSync('sh', [path.join(root, 'scripts/docker/live.sh'), ...args],
    { cwd: root, encoding: 'utf8', env: { PATH: bin + ':' + process.env.PATH, HOME: process.env.HOME } });
  /* A gepromoveerd (en gearchiveerd als het boek dat moet), daarna C actief, en
     een ondertekend terugdraaibesluit van C naar A. */
  const terugNaarA = ({ archief }) => {
    const pa = promoveer(o, A);
    if (archief) { o.zet(); boek.archiveer(root, doel); }
    promoveer(o, C);
    keten.voegToe(root, 'terugdraai', { vanDigest: DIG2, naarDigest: DIG, naarBackupDigest: BDIG, naarImageId: APP,
      naarBackupImageId: BCK, omgeving: OMG, besluit: 'CAB-R', goedgekeurdDoor: 'authority', doelRecord: pa.hash }, { env: o.env });
  };
  return { ...o, draai, log, terugNaarA };
}

const bouwRegels = log => fs.readFileSync(log, 'utf8').split('\n').filter(l => /(^| )build( |$)/.test(l));

test('live.sh rollback zonder ketenbesluit, of naar een doel zonder bewaarde kwalificatie, komt nooit tot compose up, en bouwt nooit', t => {
  const zonderBesluit = liveOpstelling(t);
  promoveer(zonderBesluit, A); zonderBesluit.zet(); boek.archiveer(zonderBesluit.root, doel); promoveer(zonderBesluit, C);
  const r0 = zonderBesluit.draai('rollback', DIG);
  assert.equal(r0.status, 65, r0.stdout + r0.stderr);
  assert.match(r0.stderr, /geen ondertekend terugdraaibesluit/);

  const zonderArchief = liveOpstelling(t);
  zonderArchief.terugNaarA({ archief: false });
  const r = zonderArchief.draai('rollback', DIG);
  assert.equal(r.status, 65, r.stdout + r.stderr);
  assert.match(r.stderr, /rollback geweigerd: .*niet in het promotieboek/);
  const aanroepen = fs.readFileSync(zonderArchief.log, 'utf8');
  assert.doesNotMatch(aanroepen, /compose .*up/);
  assert.deepEqual(bouwRegels(zonderArchief.log), []);
});

test('live.sh rollback naar een bewezen image zet exact dat image terug zonder te bouwen', t => {
  const { root, draai, log, terugNaarA } = liveOpstelling(t);
  terugNaarA({ archief: true });
  const r = draai('rollback', DIG);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const aanroepen = fs.readFileSync(log, 'utf8');
  assert.match(aanroepen, /compose .* up -d --no-build motor app sentinel backup/);
  assert.deepEqual(bouwRegels(log), [], 'rollback bouwde een image');
  assert.equal(fs.readFileSync(path.join(root, '.rtg-live-release'), 'utf8'), APP + '\n' + BCK + '\n' + PIN + '\n');
  assert.match(fs.readFileSync(path.join(root, 'audit.log'), 'utf8'), /rollback\.uitgevoerd/);
  // een tag in plaats van een digest: geweigerd voordat er iets gebeurt
  assert.equal(draai('rollback', 'v1.0.0').status, 64);
});
