'use strict';
/* ============================================================================
   KWALIFICATIE -- DE WEIGERINGEN AAN DE RAND

   kwalificatie.test.js bewijst de hoofdlijn: een werkboom die het image is
   kwalificeert, een verschil zakt. Dit bestand toetst de randen, elk met een
   concrete uitkomst: een .dockerignore die ontbreekt of letterlijke paden met
   slashes noemt, een manifest zonder vorm of met een vervalste totaalhash, een
   werkboom die niet te scannen is (symlink, geen frontend), een imagerecord
   of fase die niet deugt, een samenvatting waarvan voor en na verschillen, en
   elke klacht van controleer() afzonderlijk.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const release = require('../scripts/release-bewijs');
const kw = require('../scripts/lib/kwalificatie');

const APP = 'sha256:' + 'a'.repeat(64), BCK = 'sha256:' + 'b'.repeat(64);

function werkboom(t, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kwal-t-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, inhoud] of Object.entries({ 'package.json': '{"name":"x"}', 'server/app.js': 'x=1',
    'public/dist/app.js': 'bouw', 'rtg-motor': 'm', 'rtg-sentinel': 's', ...extra })) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), inhoud);
  }
  return root;
}
/* Een werkboom met een imagerecord en een inhoudsbewijs dat precies klopt. */
function opstelling(t) {
  const root = werkboom(t);
  const manifest = release.maakManifest(root);
  const bytes = Buffer.from(JSON.stringify(manifest) + '\n');
  fs.mkdirSync(path.join(root, '.release'), { recursive: true });
  fs.writeFileSync(path.join(root, kw.REL.imageBewijs), bytes);
  const rec = { formaat: 'rtg-kwalificatie-v1-image', image: 'rtg:x', imageId: APP, backupImageId: BCK,
    bewijsSha256: kw.sha256(bytes), gepubliceerdImageId: APP, gepubliceerdBackupImageId: BCK };
  kw.schrijfJson(root, kw.REL.image, rec);
  return { root, manifest, rec };
}

test('nietGeleverd: zonder .dockerignore een lege lijst; slashes, commentaar, uitzonderingen en globs vallen weg', t => {
  const root = werkboom(t);
  assert.deepEqual(kw.nietGeleverd(root), []);
  fs.writeFileSync(path.join(root, '.dockerignore'), '# uitleg\r\n/scripts/dev/\n!server/app.js\n*.md\nfo?o\n[ab]\n\n  docs  \n');
  assert.deepEqual(kw.nietGeleverd(root), ['scripts/dev', 'docs']);
});

test('vergelijk: een manifest zonder vorm is een bewijsverschil zonder verdere scan', t => {
  const root = werkboom(t);
  const geenBewijs = { ok: false, verschillen: [{ soort: 'bewijs', pad: null }], extraToegestaan: [] };
  assert.deepEqual(kw.vergelijk(root, null), geenBewijs);
  assert.deepEqual(kw.vergelijk(root, { formaat: 'ander' }), geenBewijs);
  assert.deepEqual(kw.vergelijk(root, { formaat: 'rtg-release-bewijs-v1', bestanden: {} }), geenBewijs);
  assert.deepEqual(kw.vergelijk(root, { formaat: 'rtg-release-bewijs-v1', bestanden: [] }), geenBewijs, 'zonder inhoudshash');
});

test('vergelijk: een totaalhash die niet bij de lijst past is een bewijsverschil, ook als elk bestand klopt', t => {
  const root = werkboom(t);
  const manifest = release.maakManifest(root);
  const r = kw.vergelijk(root, { ...manifest, inhoudSha256: 'f'.repeat(64) });
  assert.equal(r.ok, false);
  assert.deepEqual(r.verschillen, [{ soort: 'bewijs', pad: null }]);
  assert.equal(r.bestandAantal, manifest.bestanden.length);
  assert.equal(r.werkboomSha256, manifest.inhoudSha256, 'de werkboom zelf is ongewijzigd');
});

test('vergelijk: een werkboom die niet te scannen is geeft een scanverschil met de uitleg', t => {
  const root = werkboom(t);
  const manifest = release.maakManifest(root);
  fs.symlinkSync(path.join(root, 'server/app.js'), path.join(root, 'server/link.js'));
  const r = kw.vergelijk(root, manifest);
  assert.equal(r.ok, false);
  assert.equal(r.verschillen.length, 1);
  assert.equal(r.verschillen[0].soort, 'scan');
  assert.match(r.verschillen[0].uitleg, /symlink/);
});

test('vergelijk: een extra bestand onder een niet-geleverde map telt als toegestaan, met naam', t => {
  const root = werkboom(t);
  const manifest = release.maakManifest(root);
  fs.writeFileSync(path.join(root, '.dockerignore'), 'scripts/dev\n');
  fs.mkdirSync(path.join(root, 'scripts/dev'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts/dev/b.js'), 'b');
  fs.writeFileSync(path.join(root, 'scripts/dev/a.js'), 'a');
  const r = kw.vergelijk(root, manifest);
  /* .dockerignore zelf is runtime-invoer en staat niet in het manifest */
  assert.deepEqual(r.verschillen, [{ soort: 'nieuw', pad: '.dockerignore' }]);
  assert.deepEqual(r.extraToegestaan, ['scripts/dev/a.js', 'scripts/dev/b.js']);
});

test('imageRecord weigert elk record zonder formaat, image-ID of imagenaam', t => {
  const { root, rec } = opstelling(t);
  for (const fout of [{ formaat: 'x' }, { imageId: 'latest' }, { imageId: undefined }, { image: '' }, { image: 7 }]) {
    kw.schrijfJson(root, kw.REL.image, { ...rec, ...fout });
    assert.throws(() => kw.imageRecord(root), /bronimage ontbreekt of is ongeldig/, JSON.stringify(fout));
  }
  kw.schrijfJson(root, kw.REL.image, null);
  assert.throws(() => kw.imageRecord(root), /bronimage/);
});

test('fase kent alleen voor en na, en weigert een inhoudsbewijs dat niet uit het image kwam', t => {
  const { root } = opstelling(t);
  assert.throws(() => kw.fase(root, 'tussen'), /fase is voor of na/);
  const pad = path.join(root, kw.REL.imageBewijs);
  fs.appendFileSync(pad, ' ');
  assert.throws(() => kw.fase(root, 'voor'), /niet meer het bewijs dat uit het image kwam/);
});

test('fase met een kapot manifest schrijft een rood record met nulwaarden', t => {
  const { root, rec } = opstelling(t);
  const bytes = Buffer.from(JSON.stringify({ formaat: 'iets' }));
  fs.writeFileSync(path.join(root, kw.REL.imageBewijs), bytes);
  kw.schrijfJson(root, kw.REL.image, { ...rec, bewijsSha256: kw.sha256(bytes) });
  const r = kw.fase(root, 'voor');
  assert.equal(r.ok, false);
  assert.equal(r.inhoudSha256, null);
  assert.equal(r.werkboomSha256, null);
  assert.equal(r.bestandAantal, 0);
  assert.equal(r.aantalVerschillen, 1);
  assert.deepEqual(kw.leesJson(root, kw.REL.voor).verschillen, [{ soort: 'bewijs', pad: null }]);
});

test('samenvatting: een fase van een ander image, en verschillende werkbomen tussen voor en na, tekenen niet', t => {
  const { root, rec } = opstelling(t);
  kw.fase(root, 'voor');
  kw.fase(root, 'na');
  const s = kw.samenvatting(root);
  assert.equal(s.formaat, kw.FORMAAT);
  assert.deepEqual(s.nietGeleverd, []);

  const voor = kw.leesJson(root, kw.REL.voor);
  kw.schrijfJson(root, kw.REL.voor, { ...voor, imageId: BCK });
  assert.throws(() => kw.samenvatting(root), /fase "voor" is niet groen of hoort bij een ander image/);
  kw.schrijfJson(root, kw.REL.voor, { ...voor, inhoudSha256: undefined });
  assert.throws(() => kw.samenvatting(root), /fase "voor"/);
  kw.schrijfJson(root, kw.REL.voor, { ...voor, werkboomSha256: '0'.repeat(64) });
  assert.throws(() => kw.samenvatting(root), /veranderde tussen voor en na/);
  kw.schrijfJson(root, kw.REL.voor, voor);
  kw.schrijfJson(root, kw.REL.image, { ...rec, backupImageId: 'geen' });
  assert.throws(() => kw.samenvatting(root), /backupimage/);
  kw.schrijfJson(root, kw.REL.image, { ...rec, backupImageId: undefined, gepubliceerdBackupImageId: undefined });
  assert.throws(() => kw.samenvatting(root), /backupimage/);
});

test('controleer: een onbekende rol, en elk ontbrekend veld, krijgt een eigen klacht', () => {
  const goed = { formaat: kw.FORMAAT, rol: 'app', imageId: APP, backupImageId: BCK, inhoudSha256: 'f'.repeat(64),
    bestandAantal: 2, imageBewijsSha256: '1'.repeat(64), voorSha256: '2'.repeat(64), naSha256: '3'.repeat(64) };
  assert.deepEqual(kw.controleer(goed, { imageId: APP, rol: 'beheer' }), ['Onbekende kwalificatierol.']);
  assert.deepEqual(kw.controleer(goed), ['Zonder lokaal image-ID valt niet te bewijzen dat dit het gekwalificeerde image is.']);
  const leeg = { formaat: kw.FORMAAT, rol: 'app' };
  assert.deepEqual(kw.controleer(leeg, { imageId: APP }), [
    'De kwalificatie noemt geen geldig image-ID.',
    'De kwalificatie noemt geen geldige inhoudshash.',
    'De kwalificatie mist imageBewijsSha256.',
    'De kwalificatie mist voorSha256.',
    'De kwalificatie mist naSha256.',
    'De kwalificatie telt geen bestanden.',
    'Het image (' + APP + ') is niet het gekwalificeerde app-image (undefined).']);
  assert.deepEqual(kw.controleer({ ...goed, backupImageId: 'x' }, { imageId: APP }), ['De kwalificatie noemt geen geldig image-ID.']);
  assert.deepEqual(kw.controleer({ ...goed, bestandAantal: 0 }, { imageId: APP }), ['De kwalificatie telt geen bestanden.']);
  assert.deepEqual(kw.controleer({ ...goed, bestandAantal: 1.5 }, { imageId: APP }), ['De kwalificatie telt geen bestanden.']);
  assert.deepEqual(kw.controleer({ ...goed, rol: 'backup' }, { imageId: BCK, rol: 'backup', inhoudSha256: 'f'.repeat(64) }), []);
  assert.deepEqual(kw.controleer({ ...goed, rol: 'backup' }, { imageId: APP, rol: 'backup' }),
    ['Het image (' + APP + ') is niet het gekwalificeerde backup-image (' + BCK + ').']);
});
