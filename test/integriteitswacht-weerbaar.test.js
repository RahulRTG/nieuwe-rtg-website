/* DE INTEGRITEITSWACHT, WEERBAAR (server/kern/integriteitswacht.js).

   De integriteitswacht vergelijkt de draaiende bron met het releasebewijs in
   het image, en optioneel het bewijs zelf met een externe pin
   (RTG_RELEASE_BEWIJS_SHA256). test/incidentcontrole.test.js toetst de twee
   gewone breuken (een gewijzigd bronbestand, een verkeerde pin). Hier gaat het
   om wat een aanvaller of een kapotte opslag met het BEWIJS zelf doet: weg,
   vervangen door een symlink of map, opgeblazen, onleesbaar, van een ander
   formaat, of met een verzamelhash die niet klopt -- en om een scan die
   omvalt.

   Wat hier niet mag sneuvelen:
   1. geen bewijs is GEEN groen licht: controleer() geeft ok:false met de
      reden, en bestanden() geeft niets terug in plaats van een oude lijst;
   2. een bewijs dat een symlink of een map is, te groot is, geen JSON is of
      een onbekend formaat heeft, wordt geweigerd met een eigen reden;
   3. een pin die geen SHA-256 is, telt als ongeldig en NIET als "geen pin";
      een geldige pin mag hoofdletters en witruimte dragen;
   4. elke soort verschil (nieuw, ontbreekt, grootte, inhoud, een vervalste
      verzamelhash) wordt bij naam genoemd, ook alleen een gewijzigde inhoud
      met dezelfde grootte;
   5. de lijst details is begrensd op 200 en zegt DAT hij begrensd is;
   6. een scan die omvalt is een bevinding (soort "scan") en geen crash;
   7. het antwoord bevat paden, groottes en hashes -- nooit broninhoud.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `const pinGeldig = !ingesteldePin || (SHA.test(ingesteldePin) && ...)`
     vervangen door `!ingesteldePin || bewijsSha256 === ingesteldePin ||
     !SHA.test(ingesteldePin)`
     -> "3. een pin die geen SHA-256 is" en "5. de lijst details" ZAKKEN (RAAK).
   - `if (!stat.isFile() || stat.isSymbolicLink()) throw ...` weggehaald
     -> "2. een bewijs dat een symlink of map is" ZAKT (RAAK).
   - `detailsBegrensd: (r.verschillen || []).length > details.length` vervangen
     door `detailsBegrensd: false`
     -> "5. de lijst details is begrensd" ZAKT (RAAK).

   Draai: node --test test/integriteitswacht-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const maakIntegriteit = require('../server/kern/integriteitswacht');
const release = require('../scripts/release-bewijs');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function maakRelease(t, opties) {
  const o = opties || {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-integriteit-weerbaar-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const map of ['server', 'public/dist', 'scripts', 'motor/src', 'motor/target/release', '.release'])
    fs.mkdirSync(path.join(root, map), { recursive: true });
  const inhoud = {
    'package.json': '{"name":"x","version":"1"}', 'server/app.js': 'GEHEIME_BRONTEKST_1234',
    'public/dist/app.js': 'bouw', 'scripts/start.js': 'start', 'motor/src/lib.rs': 'pub fn x() {}',
    'motor/target/release/rtg-motor': 'binair', 'motor/target/release/rtg-sentinel': 'bewaker'
  };
  for (const [rel, waarde] of Object.entries(inhoud)) fs.writeFileSync(path.join(root, rel), waarde);
  const bestanden = Object.keys(inhoud).sort().map(p => {
    const b = fs.readFileSync(path.join(root, p));
    return { pad: p, bytes: b.length, sha256: sha(b), extra: 'mag niet naar buiten' };
  });
  const manifest = Object.assign({ formaat: 'rtg-release-bewijs-v1', gemaakt: '2026-10-01T00:00:00.000Z',
    bestandAantal: bestanden.length, bestanden, inhoudSha256: release.totaalHash(bestanden) }, o.manifest || {});
  const rauw = Buffer.from(JSON.stringify(manifest));
  const bewijsPad = path.join(root, '.release/release-bewijs.json');
  fs.writeFileSync(bewijsPad, rauw);
  return { root, bewijsPad, pin: sha(rauw), manifest };
}

function zonderEnv(namen, fn) {
  const oud = {};
  for (const n of namen) { oud[n] = process.env[n]; delete process.env[n]; }
  try { return fn(); } finally {
    for (const n of namen) if (oud[n] === undefined) delete process.env[n]; else process.env[n] = oud[n];
  }
}

test('1. geen bewijs is geen groen licht: ok:false, de reden, en geen bestandenlijst', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-integriteit-leeg-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  zonderEnv(['RTG_RELEASE_BEWIJS', 'RTG_RELEASE_BEWIJS_SHA256'], () => {
    const w = maakIntegriteit({ root });
    const s = w.status();
    assert.equal(s.beschikbaar, false);
    assert.equal(s.bewijs, null);
    assert.equal(s.pinIngesteld, false);
    assert.equal(s.pinGeldig, null, 'zonder bewijs is er ook geen oordeel over de pin');
    assert.equal(s.fout, 'Geen releasebewijs gevonden.');
    assert.equal(s.laatst, null, 'nog nooit gecontroleerd');
    const c = w.controleer();
    assert.equal(c.laatst.ok, false, 'ontbrekend bewijs mag nooit als heel gelden');
    assert.equal(c.laatst.verschillen, 1);
    assert.deepEqual(c.laatst.details, [{ soort: 'bewijs', pad: null, uitleg: 'Geen releasebewijs gevonden.' }]);
    assert.ok(c.laatst.duurMs >= 0);
    assert.deepEqual(w.bestanden(), []);
    assert.equal(w.status().laatst.ok, false, 'de laatste uitslag blijft staan voor het bord');
  });
  // een eigen pad uit de omgeving wordt tegen de root opgelost
  const oud = process.env.RTG_RELEASE_BEWIJS;
  process.env.RTG_RELEASE_BEWIJS = 'elders/bewijs.json';
  try {
    const w = maakIntegriteit({ root, pin: '' });
    fs.mkdirSync(path.join(root, 'elders'));
    assert.equal(w.status().beschikbaar, false);
    fs.writeFileSync(path.join(root, 'elders/bewijs.json'), '{"formaat":"rtg-release-bewijs-v1","bestanden":[]}');
    const s = w.status();
    assert.equal(s.beschikbaar, true);
    assert.equal(s.bewijs, path.join('elders', 'bewijs.json'));
    assert.equal(s.gemaakt, null); assert.equal(s.bestandAantal, 0); assert.equal(s.inhoudSha256, null);
  } finally { if (oud === undefined) delete process.env.RTG_RELEASE_BEWIJS; else process.env.RTG_RELEASE_BEWIJS = oud; }
});

test('2. een bewijs dat een symlink of map is, te groot is, geen JSON is of een ander formaat heeft, wordt geweigerd', (t) => {
  const r = maakRelease(t);
  const doel = path.join(r.root, 'bewijs-elders.json');
  fs.copyFileSync(r.bewijsPad, doel);

  const link = path.join(r.root, 'link.json');
  fs.symlinkSync(doel, link);
  const viaLink = maakIntegriteit({ root: r.root, bewijsPad: link, pin: '' }).controleer();
  assert.equal(viaLink.beschikbaar, false, 'een symlink kan stil naar een ander bewijs wijzen');
  assert.equal(viaLink.fout, 'Het releasebewijs is geen gewoon bestand.');
  assert.equal(viaLink.laatst.ok, false);

  const map = path.join(r.root, 'een-map.json');
  fs.mkdirSync(map);
  assert.equal(maakIntegriteit({ root: r.root, bewijsPad: map, pin: '' }).status().fout, 'Het releasebewijs is geen gewoon bestand.');

  const groot = path.join(r.root, 'groot.json');
  fs.writeFileSync(groot, '');
  fs.truncateSync(groot, 16 * 1024 * 1024 + 1);
  assert.equal(maakIntegriteit({ root: r.root, bewijsPad: groot, pin: '' }).status().fout, 'Het releasebewijs is onverwacht groot.');

  const kapot = path.join(r.root, 'kapot.json');
  fs.writeFileSync(kapot, '{"formaat": "rtg-release-bewijs-v1", bestanden');
  const k = maakIntegriteit({ root: r.root, bewijsPad: kapot, pin: '' });
  assert.equal(k.status().beschikbaar, false);
  assert.match(k.status().fout, /JSON/i, 'een onleesbaar bewijs noemt de parse-fout');
  assert.deepEqual(k.bestanden(), []);

  for (const vorm of ['null', '{"formaat":"rtg-release-bewijs-v0","bestanden":[]}', '{"formaat":"rtg-release-bewijs-v1","bestanden":{}}']) {
    fs.writeFileSync(kapot, vorm);
    assert.equal(k.status().fout, 'Het releasebewijs heeft een onbekend formaat.', vorm);
  }
});

test('3. een pin die geen SHA-256 is, is ongeldig; een geldige pin mag hoofdletters en witruimte dragen', (t) => {
  const r = maakRelease(t);
  const onzin = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad, pin: 'niet-een-hash' }).controleer();
  assert.equal(onzin.pinIngesteld, true);
  assert.equal(onzin.pinGeldig, false, 'een kapotte pin is geen ontbrekende pin');
  assert.equal(onzin.laatst.ok, false);
  assert.equal(onzin.laatst.verschillen, 1);
  assert.equal(onzin.laatst.details[0].soort, 'pin');
  assert.equal(onzin.laatst.details[0].uitleg, 'RTG_RELEASE_BEWIJS_SHA256 is geen geldige SHA-256.');

  const netjes = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad, pin: '  ' + r.pin.toUpperCase() + '\n' }).controleer();
  assert.equal(netjes.pinGeldig, true);
  assert.equal(netjes.laatst.ok, true);
  assert.equal(netjes.laatst.detailsBegrensd, false);
  assert.equal(netjes.bewijsSha256, r.pin);

  // de pin uit de omgeving telt als opties.pin ontbreekt
  const oud = process.env.RTG_RELEASE_BEWIJS_SHA256;
  process.env.RTG_RELEASE_BEWIJS_SHA256 = 'f'.repeat(64);
  try {
    const env = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad }).controleer();
    assert.equal(env.pinIngesteld, true);
    assert.equal(env.pinGeldig, false);
    assert.equal(env.laatst.details[0].uitleg, 'De SHA-256 van het releasebewijs wijkt af van de externe pin.');
  } finally { if (oud === undefined) delete process.env.RTG_RELEASE_BEWIJS_SHA256; else process.env.RTG_RELEASE_BEWIJS_SHA256 = oud; }
});

test('4. elke soort verschil wordt bij naam genoemd, ook een gelijke grootte met andere inhoud', (t) => {
  const r = maakRelease(t);
  const w = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad, pin: r.pin });
  assert.equal(w.controleer().laatst.ok, true);
  fs.writeFileSync(path.join(r.root, 'scripts/start.js'), 'STARt');           // zelfde grootte
  fs.rmSync(path.join(r.root, 'public/dist/app.js'));                          // weg
  fs.writeFileSync(path.join(r.root, 'server/achterdeur.js'), 'x');            // nieuw
  const s = w.controleer();
  assert.equal(s.laatst.ok, false);
  const soort = (p) => (s.laatst.details.find(d => d.pad === p) || {}).soort;
  assert.equal(soort('scripts/start.js'), 'inhoud', 'zelfde grootte, andere bytes: de hash vangt het');
  assert.equal(soort('public/dist/app.js'), 'ontbreekt');
  assert.equal(soort('server/achterdeur.js'), 'nieuw');
  assert.equal(s.laatst.verschillen, 3);
  assert.equal(s.pinGeldig, true, 'de bron is gewijzigd, het bewijs zelf niet');

  // een bewijs waarvan de verzamelhash vervalst is, zonder pin
  const r2 = maakRelease(t, { manifest: { inhoudSha256: '0'.repeat(64) } });
  const v = maakIntegriteit({ root: r2.root, bewijsPad: r2.bewijsPad, pin: '' }).controleer();
  assert.equal(v.laatst.ok, false);
  assert.ok(v.laatst.details.some(d => d.soort === 'bewijs' && /verzamelhash/.test(d.uitleg)));
  assert.equal(v.pinIngesteld, false);
});

test('5. de lijst details is begrensd op 200, en zegt dat hij begrensd is', (t) => {
  const r = maakRelease(t);
  for (let i = 0; i < 205; i++) fs.writeFileSync(path.join(r.root, 'server', 'n' + i + '.js'), '');
  const s = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad, pin: 'kapot' }).controleer();
  assert.equal(s.laatst.verschillen, 206, '205 nieuwe bestanden en een kapotte pin');
  assert.equal(s.laatst.details.length, 201, 'tweehonderd verschillen plus de pin vooraan');
  assert.equal(s.laatst.details[0].soort, 'pin');
  assert.equal(s.laatst.detailsBegrensd, true, 'wie de lijst leest, moet weten dat er meer is');
});

test('6. een scan die omvalt is een bevinding, geen crash', (t) => {
  const r = maakRelease(t);
  const echt = release.verifieer;
  release.verifieer = () => { throw new Error('schijf weg'); };
  try {
    const s = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad, pin: r.pin }).controleer();
    assert.equal(s.laatst.ok, false);
    assert.deepEqual(s.laatst.details, [{ soort: 'scan', pad: null, uitleg: 'schijf weg' }]);
    assert.equal(s.laatst.bestandAantal, 0);
  } finally { release.verifieer = echt; }
  // en een echte scanfout in de bron (een symlink) komt ook als bevinding terug
  fs.symlinkSync(path.join(r.root, 'server/app.js'), path.join(r.root, 'server/link.js'));
  const s2 = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad, pin: r.pin }).controleer();
  assert.equal(s2.laatst.ok, false);
  assert.equal(s2.laatst.details[0].soort, 'scan');
  assert.match(s2.laatst.details[0].uitleg, /symlink/);
});

test('7. het antwoord draagt paden, groottes en hashes -- nooit broninhoud of extra velden', (t) => {
  const r = maakRelease(t);
  const w = maakIntegriteit({ root: r.root, bewijsPad: r.bewijsPad, pin: r.pin });
  const lijst = w.bestanden();
  assert.equal(lijst.length, 7);
  for (const b of lijst) assert.deepEqual(Object.keys(b), ['pad', 'bytes', 'sha256']);
  const s = w.controleer();
  assert.equal(s.bewijs, path.join('.release', 'release-bewijs.json'));
  assert.equal(s.gemaakt, '2026-10-01T00:00:00.000Z');
  assert.equal(s.bestandAantal, 7);
  assert.equal(s.laatst.bestandAantal, 7);
  const alles = JSON.stringify([s, lijst]);
  assert.equal(alles.includes('GEHEIME_BRONTEKST'), false, 'broninhoud mag nooit in het antwoord');
  assert.equal(alles.includes('mag niet naar buiten'), false);
  // een bewijs buiten de root wordt relatief getoond, niet als leeg pad
  const buiten = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-integriteit-buiten-'));
  t.after(() => fs.rmSync(buiten, { recursive: true, force: true }));
  const elders = path.join(buiten, 'b.json');
  fs.copyFileSync(r.bewijsPad, elders);
  const s3 = maakIntegriteit({ root: r.root, bewijsPad: elders, pin: r.pin }).status();
  assert.equal(s3.bewijs, path.relative(r.root, elders));
  // zonder opties: de eigen repository, de standaard-kandidaten, en hij leest alleen
  zonderEnv(['RTG_RELEASE_BEWIJS', 'RTG_RELEASE_BEWIJS_SHA256'], () => {
    const eigen = maakIntegriteit().status();
    assert.equal(eigen.pinIngesteld, false);
    assert.equal(typeof eigen.beschikbaar, 'boolean');
  });
});
