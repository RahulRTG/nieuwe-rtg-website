'use strict';
/* De kwalificatie: de geteste werkboom moet byte voor byte de runtime-inhoud
   van het gepubliceerde image zijn (scripts/lib/kwalificatie.js). Elke
   afwijking -- inhoud, ontbrekend, nieuw, een andere publicatie -- zakt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const release = require('../scripts/release-bewijs');
const kw = require('../scripts/lib/kwalificatie');

const APP = 'sha256:' + 'a'.repeat(64), BCK = 'sha256:' + 'b'.repeat(64);

function opstelling(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kwal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, inhoud] of Object.entries({ 'package.json': '{"name":"x","version":"1"}', 'package-lock.json': '{}',
    'server/app.js': 'x=1', 'public/dist/app.js': 'bouw', 'scripts/start.js': 's', 'scripts/a11y.js': 'dev',
    'motor/src/lib.rs': 'fn x(){}', 'motor/Cargo.toml': '', 'motor/Cargo.lock': '', 'rtg-motor': 'm', 'rtg-sentinel': 's',
    'REG.json': '{}', '.dockerignore': 'node_modules\nscripts/a11y.js\n*.md\n' })) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), inhoud);
  }
  // Het "image": dezelfde boom zonder het dev-script (zoals .dockerignore dat doet).
  fs.renameSync(path.join(root, 'scripts/a11y.js'), path.join(root, 'a11y.tmp'));
  const manifest = release.maakManifest(root);
  fs.renameSync(path.join(root, 'a11y.tmp'), path.join(root, 'scripts/a11y.js'));
  const bytes = Buffer.from(JSON.stringify(manifest) + '\n');
  fs.mkdirSync(path.join(root, '.release'), { recursive: true });
  fs.writeFileSync(path.join(root, kw.REL.imageBewijs), bytes);
  kw.schrijfJson(root, kw.REL.image, { formaat: 'rtg-kwalificatie-v1-image', image: 'rtg:x', imageId: APP,
    backup: 'rtg:b', backupImageId: BCK, bewijsSha256: kw.sha256(bytes), inhoudSha256: manifest.inhoudSha256,
    gepubliceerdImageId: APP, gepubliceerdBackupImageId: BCK });
  return { root, manifest };
}

test('een werkboom die het image is, kwalificeert; het dev-script uit .dockerignore staat er met naam bij', t => {
  const { root, manifest } = opstelling(t);
  const voor = kw.fase(root, 'voor');
  assert.equal(voor.ok, true, JSON.stringify(voor.verschillen));
  assert.deepEqual(voor.extraToegestaan, ['scripts/a11y.js']);
  kw.fase(root, 'na');
  const s = kw.samenvatting(root);
  assert.equal(s.imageId, APP);
  assert.equal(s.inhoudSha256, manifest.inhoudSha256);
  assert.deepEqual(kw.controleer({ ...s, rol: 'app' }, { imageId: APP, inhoudSha256: manifest.inhoudSha256 }), []);
  assert.deepEqual(kw.controleer({ ...s, rol: 'backup' }, { imageId: BCK, rol: 'backup' }), []);
});

test('een gewijzigde, ontbrekende of extra runtimebyte laat de kwalificatie zakken', t => {
  const { root } = opstelling(t);
  fs.appendFileSync(path.join(root, 'server/app.js'), ' ');
  assert.deepEqual(kw.fase(root, 'voor').verschillen.map(v => v.soort + ':' + v.pad), ['inhoud:server/app.js']);
  fs.writeFileSync(path.join(root, 'server/app.js'), 'x=1');
  fs.rmSync(path.join(root, 'public/dist/app.js'));
  assert.deepEqual(kw.fase(root, 'voor').verschillen.map(v => v.soort + ':' + v.pad), ['ontbreekt:public/dist/app.js']);
  fs.writeFileSync(path.join(root, 'public/dist/app.js'), 'bouw');
  fs.writeFileSync(path.join(root, 'server/extra.js'), 'nieuw');
  assert.deepEqual(kw.fase(root, 'voor').verschillen.map(v => v.soort + ':' + v.pad), ['nieuw:server/extra.js']);
  // een glob in .dockerignore stelt NIETS vrij
  fs.writeFileSync(path.join(root, '.dockerignore'), 'server/*.js\n');
  assert.equal(kw.fase(root, 'voor').ok, false);
});

test('een stap die runtime-invoer herschrijft tussen voor en na, of een andere publicatie, tekent niet', t => {
  const { root } = opstelling(t);
  kw.fase(root, 'voor');
  fs.writeFileSync(path.join(root, 'REG.json'), '{"herschreven":true}');
  assert.equal(kw.fase(root, 'na').ok, false);
  assert.throws(() => kw.samenvatting(root), /fase "na" is niet groen/);
  fs.writeFileSync(path.join(root, 'REG.json'), '{}');
  kw.fase(root, 'na');
  kw.samenvatting(root);
  const rec = kw.imageRecord(root);
  kw.schrijfJson(root, kw.REL.image, { ...rec, gepubliceerdImageId: 'sha256:' + 'c'.repeat(64) });
  assert.throws(() => kw.samenvatting(root), /opnieuw gebouwd/);
  kw.schrijfJson(root, kw.REL.image, { ...rec, gepubliceerdBackupImageId: null });
  assert.throws(() => kw.samenvatting(root), /backupimage/);
});

test('de kandidaatcontrole eist exact het gekwalificeerde image-ID en de juiste rol', () => {
  const blok = { formaat: 'rtg-kwalificatie-v1', rol: 'app', imageId: APP, backupImageId: BCK, inhoudSha256: 'f'.repeat(64),
    bestandAantal: 2, imageBewijsSha256: '1'.repeat(64), voorSha256: '2'.repeat(64), naSha256: '3'.repeat(64) };
  assert.deepEqual(kw.controleer(blok, { imageId: APP }), []);
  assert.match(kw.controleer(blok, { imageId: BCK }).join(' '), /niet het gekwalificeerde app-image/);
  assert.match(kw.controleer(blok, {}).join(' '), /Zonder lokaal image-ID/);
  assert.match(kw.controleer(blok, { imageId: APP, inhoudSha256: '0'.repeat(64) }).join(' '), /runtime-inhoud/);
  assert.match(kw.controleer(blok, { imageId: BCK, rol: 'backup' }).join(' '), /rol app/);
  assert.match(kw.controleer(null, { imageId: APP }).join(' '), /geen kwalificatie/);
});
