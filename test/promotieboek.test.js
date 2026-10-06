'use strict';
/* Het promotieboek: een rollback gaat alleen naar een image dat eerder is
   gekwalificeerd en ondertekend gepromoveerd (scripts/lib/promotieboek.js).

   Twee lagen. De module zelf, met elke manier waarop een rollbackdoel vals kan
   zijn. En `scripts/docker/live.sh rollback` als PROCES, met een nep-docker op
   PATH die elke aanroep opschrijft: een onbewezen doel komt nooit tot
   `compose up`, een bewezen doel wel -- en nergens wordt er gebouwd. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const trust = require('../server/config/release-trust');
const H = require('../scripts/imageherkomst');
const boek = require('../scripts/lib/promotieboek');
const { trustFixture } = require('./release-trust-fixture');

const BRON = path.join(__dirname, '..');
const APP = 'sha256:' + 'a'.repeat(64), BCK = 'sha256:' + 'b'.repeat(64);
const DIG = 'sha256:' + 'c'.repeat(64), BDIG = 'sha256:' + 'd'.repeat(64);
const PIN = 'e'.repeat(64);

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-promotieboek-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sleutels = trustFixture(root);
  fs.mkdirSync(path.join(root, '.release'), { recursive: true });
  const zet = (bytes = {}) => {
    const b = { promotie: promotieDoc(), herkomst: herkomstDoc('app', DIG, sleutels.BUILD.privateKey),
      backupHerkomst: herkomstDoc('backup', BDIG, sleutels.BUILD.privateKey), ...bytes };
    b.promotieSig = b.promotieSig || Buffer.from(trust.sign('PROMOTION', b.promotie, sleutels.PROMOTION.privateKey) + '\n');
    for (const [naam, rel] of Object.entries(boek.BRONNEN)) fs.writeFileSync(path.join(root, rel), b[naam]);
  };
  return { root, sleutels, zet };
}

test('een gekwalificeerde, ondertekende promotie wordt een bewezen rollbackdoel', t => {
  const { root, zet } = opstelling(t);
  zet();
  boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN });
  assert.deepEqual(boek.controleerRollback(root, { imageId: APP, backupId: BCK, pin: PIN }), []);
});

test('een image dat nooit gepromoveerd is, of een ander stel ID\'s, is geen rollbackdoel', t => {
  const { root, zet } = opstelling(t);
  zet();
  boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN });
  const anders = 'sha256:' + '9'.repeat(64);
  assert.match(boek.controleerRollback(root, { imageId: anders, backupId: BCK, pin: PIN }).join(' '), /niet in het promotieboek/);
  assert.match(boek.controleerRollback(root, { imageId: APP, backupId: anders, pin: PIN }).join(' '), /backupimage/);
  assert.match(boek.controleerRollback(root, { imageId: APP, backupId: BCK, pin: '0'.repeat(64) }).join(' '), /bewijspin/);
  assert.notEqual(boek.controleerRollback(root, { imageId: 'latest', backupId: BCK, pin: PIN }).length, 0);
});

test('een veranderde byte in het boek, of een handtekening van de verkeerde rol, wordt geweigerd', t => {
  const { root, zet, sleutels } = opstelling(t);
  zet();
  boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN });
  const map = boek.mapVoor(root, APP);
  const p = JSON.parse(fs.readFileSync(path.join(map, 'promotie'), 'utf8'));
  p.commit = '1'.repeat(40);
  fs.writeFileSync(path.join(map, 'promotie'), JSON.stringify(p) + '\n');
  assert.match(boek.controleerRollback(root, { imageId: APP, backupId: BCK, pin: PIN }).join(' '), /PROMOTION-handtekening/);
  // archiveren met een promotie die door de BUILD-sleutel is getekend
  zet({ promotieSig: Buffer.from(trust.sign('BUILD', promotieDoc(), sleutels.BUILD.privateKey)) });
  assert.throws(() => boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN }), /PROMOTION-handtekening/);
});

test('een herkomst zonder kwalificatie van DIT image maakt geen rollbackdoel', t => {
  const { root, zet, sleutels } = opstelling(t);
  zet({ herkomst: herkomstDoc('app', DIG, sleutels.BUILD.privateKey, { imageId: 'sha256:' + '8'.repeat(64) }) });
  assert.throws(() => boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN }), /niet het gekwalificeerde app-image/);
  zet({ herkomst: herkomstDoc('app', 'sha256:' + '7'.repeat(64), sleutels.BUILD.privateKey) });
  assert.throws(() => boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN }), /ander digest/);
  const zonder = JSON.parse(herkomstDoc('app', DIG, sleutels.BUILD.privateKey).toString());
  delete zonder.kwalificatie; delete zonder.handtekening;
  zonder.handtekening = { algoritme: 'ed25519', waarde: H.teken(zonder, sleutels.BUILD.privateKey) };
  zet({ herkomst: Buffer.from(JSON.stringify(zonder)) });
  assert.throws(() => boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN }), /geen kwalificatie/);
});

/* ---- live.sh rollback als proces ------------------------------------------ */
function liveOpstelling(t) {
  const o = opstelling(t);
  const { root } = o;
  for (const rel of ['scripts/docker/live.sh', 'scripts/promotieboek.js', 'scripts/lib/promotieboek.js',
    'scripts/lib/kwalificatie.js', 'scripts/release-bewijs.js', 'scripts/imageherkomst.js',
    'scripts/lib/stempel.js', 'server/config/release-trust.js']) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(BRON, rel), path.join(root, rel));
  }
  // De TLS-proef praat met een echte host; hier zegt hij ja.
  fs.writeFileSync(path.join(root, 'scripts/publieke-tls-proef.js'), 'process.exit(0)\n');
  fs.writeFileSync(path.join(root, 'deploy/live.env'), 'RTG_IMAGE=rtg-app:live\n');
  fs.writeFileSync(path.join(root, '.env.productie'), 'APP_URL=https://rtg.example\n');
  const bin = path.join(root, 'nepbin');
  fs.mkdirSync(bin);
  const log = path.join(root, 'docker.log');
  fs.writeFileSync(path.join(bin, 'docker'), '#!' + process.execPath + `
const fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},a.join(' ')+'\\n');
if(a.includes('build')){process.exit(99)}
if(a[0]==='image'&&a[1]==='inspect'){process.exit([${JSON.stringify(APP)},${JSON.stringify(BCK)}].includes(a[a.length-1])?0:1)}
if(a[0]==='run'&&a.includes('sha256sum')){process.stdout.write(${JSON.stringify(PIN)}+'  /app/release-bewijs.json\\n');process.exit(0)}
process.exit(0)
`, { mode: 0o755 });
  const draai = (...args) => spawnSync('sh', [path.join(root, 'scripts/docker/live.sh'), ...args],
    { cwd: root, encoding: 'utf8', env: { PATH: bin + ':' + process.env.PATH, HOME: process.env.HOME } });
  return { ...o, draai, log, rollbackStaat: path.join(root, '.rtg-live-rollback') };
}

test('live.sh rollback naar een onbewezen image komt nooit tot compose up, en bouwt nooit', t => {
  const { draai, log, rollbackStaat } = liveOpstelling(t);
  fs.writeFileSync(rollbackStaat, APP + '\n' + BCK + '\n' + PIN + '\n');
  const r = draai('rollback');
  assert.equal(r.status, 65, r.stdout + r.stderr);
  assert.match(r.stderr, /rollback geweigerd: .*niet in het promotieboek/);
  const aanroepen = fs.readFileSync(log, 'utf8');
  assert.doesNotMatch(aanroepen, /compose .*up/);
  assert.deepEqual(aanroepen.split('\n').filter(l => /(^| )build( |$)/.test(l)), []);
});

test('live.sh rollback naar een bewezen image zet exact dat image terug zonder te bouwen', t => {
  const { root, zet, draai, log, rollbackStaat } = liveOpstelling(t);
  zet();
  boek.archiveer(root, { imageId: APP, backupId: BCK, pin: PIN });
  fs.writeFileSync(rollbackStaat, APP + '\n' + BCK + '\n' + PIN + '\n');
  const r = draai('rollback');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const aanroepen = fs.readFileSync(log, 'utf8');
  assert.match(aanroepen, /compose .* up -d --no-build motor app sentinel backup/);
  assert.deepEqual(aanroepen.split('\n').filter(l => /(^| )build( |$)/.test(l)), [], 'rollback bouwde een image');
  assert.equal(fs.readFileSync(path.join(root, '.rtg-live-release'), 'utf8'), APP + '\n' + BCK + '\n' + PIN + '\n');
  // een verkeerde pin in de rollbackstaat: geweigerd, ook als het image in het boek staat
  fs.writeFileSync(rollbackStaat, APP + '\n' + BCK + '\n' + '0'.repeat(64) + '\n');
  assert.equal(draai('rollback').status, 65);
});
