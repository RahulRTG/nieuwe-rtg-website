/* ============================================================================
   DE HERKOMST VAN HET PRODUCTIE-IMAGE (scripts/imageherkomst.js).

   Niet te verwarren met test/herkomst.test.js: die gaat over de herkomst van
   GEGEVENS in RTG Command (waar komt dit veld vandaan). Dit gaat over de
   herkomst van het IMAGE: wat zit erin, waar komt het vandaan, en klopt wat er
   draait met wat er getekend is.

   Wat hier bewezen moet worden is niet dat er een JSON-bestand uitkomt -- dat
   ziet iedereen -- maar dat het bestand IETS TEGENHOUDT. Een handtekening die
   ook onder een gewijzigd document blijft kloppen, een stuklijst die de helft
   van het image niet noemt zonder dat te zeggen, of een controle die groen geeft
   terwijl er een ander image draait: zo wordt dit soort bewijs stil waardeloos.
   Elke toets hieronder heeft daarom een TEGENPROEF.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de handtekeningcontrole uitgezet (`else if (false)`)
     -> "een gewijzigd document valt om" en "een vreemde sleutel telt niet" ZAKKEN (RAAK)
   - `volledigheid` altijd op 'image' gezet
     -> "een stuklijst zonder image-pakketten zegt dat" ZAKT (RAAK)
   - de vergelijking met het draaiende image overgeslagen
     -> "een geldig document over een ander image" ZAKT (RAAK)
   - de hercontrole van de stuklijst-hash overgeslagen
     -> "een ANDERE stuklijst naast hetzelfde document" ZAKT (RAAK)

   Los: node --test test/imageherkomst.test.js
   ========================================================================== */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const H = require('../scripts/imageherkomst');

const WORTEL = path.join(__dirname, '..');

/* --- de lezers ----------------------------------------------------------- */

test('dpkg-uitvoer wordt een gesorteerde pakketlijst, en half-geinstalleerde regels vallen af', () => {
  const uit = H.leesDpkg([
    'libssl3\t3.0.14-1~deb12u2\tamd64',
    'zlib1g\t1:1.2.13.dfsg-1\tamd64',
    'weggehaald\t\tamd64',            // dpkg kent hem nog, hij staat er niet meer
    '',
    'adduser\t3.134\tall'
  ].join('\n'));
  assert.deepStrictEqual(uit.map(p => p.naam), ['adduser', 'libssl3', 'zlib1g']);
  assert.strictEqual(uit.find(p => p.naam === 'libssl3').versie, '3.0.14-1~deb12u2');
  assert.ok(!uit.some(p => p.naam === 'weggehaald'), 'een pakket zonder versie is niet geinstalleerd');
});

test('Cargo.lock levert elke crate met zijn checksum, en de eigen crate zonder', () => {
  const crates = H.leesCargoLock([
    '[[package]]', 'name = "rtg-motor"', 'version = "0.1.0"', '',
    '[[package]]', 'name = "libc"', 'version = "0.2.155"',
    'source = "registry+https://github.com/rust-lang/crates.io-index"',
    'checksum = "97b3888a4aecf77e811145cadf6eef5901f4782c53886191b2f693f24761847c"'
  ].join('\n'));
  assert.strictEqual(crates.length, 2);
  const libc = crates.find(c => c.naam === 'libc');
  assert.strictEqual(libc.checksum, '97b3888a4aecf77e811145cadf6eef5901f4782c53886191b2f693f24761847c');
  assert.strictEqual(crates.find(c => c.naam === 'rtg-motor').checksum, undefined);
});

test('de echte Cargo.lock van dit huis wordt gelezen zoals hij is', () => {
  const crates = H.leesCargoLock(fs.readFileSync(path.join(WORTEL, 'motor', 'Cargo.lock'), 'utf8'));
  assert.ok(crates.length >= 1, 'de eigen crate hoort er altijd in te staan');
  assert.ok(crates.some(c => c.naam === 'rtg-motor'));
});

test('dev-pakketten tellen wel mee als aantal maar staan niet in de runtime-lijst', () => {
  const npm = H.leesNpmLock(JSON.stringify({
    packages: {
      '': { name: 'rtg-website' },
      'node_modules/playwright': { name: 'playwright', version: '1.62.1', dev: true },
      'node_modules/iets': { name: 'iets', version: '2.0.0', integrity: 'sha512-AAAA' }
    }
  }));
  assert.strictEqual(npm.ontwikkeling, 1);
  assert.deepStrictEqual(npm.runtime.map(p => p.naam), ['iets']);
});

/* --- de stuklijst -------------------------------------------------------- */

function stuklijst(extra) {
  return H.maakSbom(Object.assign({
    app: { naam: 'rtg-website', versie: '1.0.0' },
    image: 'ghcr.io/x/y:v1',
    os: [{ naam: 'libssl3', versie: '3.0.14', arch: 'amd64' }],
    crates: [{ naam: 'rtg-motor', versie: '0.1.0' }],
    npm: { runtime: [], ontwikkeling: 1 },
    node: 'v22.22.2',
    bewijs: { inhoudSha256: 'abc123', bestandAantal: 10 },
    gemaakt: '2026-08-18T00:00:00.000Z',
    serie: '00000000-0000-4000-8000-000000000000'
  }, extra || {}));
}

test('de stuklijst is CycloneDX en noemt OS-pakket, crate en runtime', () => {
  const s = stuklijst();
  assert.strictEqual(s.bomFormat, 'CycloneDX');
  assert.strictEqual(s.specVersion, '1.5');
  const namen = s.components.map(c => c.name);
  assert.ok(namen.includes('libssl3'), 'een OS-pakket uit het image');
  assert.ok(namen.includes('rtg-motor'), 'de eigen crate');
  assert.ok(namen.includes('node'), 'de runtime zelf');
});

test('een stuklijst zonder image-pakketten ZEGT dat hij alleen de bron dekt', () => {
  const volledig = stuklijst().metadata.properties.find(p => p.name === 'rtg:volledigheid');
  assert.strictEqual(volledig.value, 'image');
  /* De tegenproef, en dit is de belangrijkste bewering van het hele bestand:
     zonder pakketten uit het image mag dit nooit 'image' zeggen. Een stuklijst
     die stil de helft weglaat, leest als dekking die er niet is. */
  const zonder = stuklijst({ os: [] }).metadata.properties.find(p => p.name === 'rtg:volledigheid');
  assert.strictEqual(zonder.value, 'alleen-bron');
});

test('dezelfde invoer geeft dezelfde bytes -- anders is een hash erover niets waard', () => {
  assert.strictEqual(JSON.stringify(stuklijst()), JSON.stringify(stuklijst()));
  const eenVolgorde = stuklijst({
    os: [{ naam: 'zlib1g', versie: '1.2', arch: 'amd64' }, { naam: 'libssl3', versie: '3.0.14', arch: 'amd64' }]
  });
  const andereVolgorde = stuklijst({
    os: [{ naam: 'libssl3', versie: '3.0.14', arch: 'amd64' }, { naam: 'zlib1g', versie: '1.2', arch: 'amd64' }]
  });
  assert.strictEqual(JSON.stringify(eenVolgorde), JSON.stringify(andereVolgorde),
    'de volgorde van de invoer mag niet doorwerken');
});

/* --- de handtekening ----------------------------------------------------- */

function getekendDocument(sbomBytes, sleutel) {
  const doc = H.maakHerkomst({
    image: 'ghcr.io/x/y:v1',
    digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    sbomBytes,
    sbomComponenten: 3,
    bewijs: { inhoudSha256: 'abc123', bestandAantal: 10 },
    bron: { commit: 'deadbeef', tag: 'v1', werkboomSchoon: true },
    bouw: { node: 'v22', workflow: 'Productie-image', run: '1', draaier: 'github-actions' },
    gemaakt: '2026-08-18T00:00:00.000Z'
  });
  doc.handtekening = {
    algoritme: 'ed25519',
    publiekeSleutelSha256: 'x',
    waarde: H.teken(doc, crypto.createPrivateKey(sleutel.prive))
  };
  return doc;
}

test('een geldig document met de juiste sleutel en de juiste stuklijst komt door', () => {
  const sleutel = H.nieuweSleutel();
  const sbomBytes = Buffer.from(JSON.stringify(stuklijst()));
  const doc = getekendDocument(sbomBytes, sleutel);
  const r = H.controleerHerkomst({ document: doc, sbomBytes, publiekPem: sleutel.publiek });
  assert.deepStrictEqual(r.klachten, []);
  assert.strictEqual(r.ok, true);
});

test('een gewijzigd document valt om, ook al staat de oude handtekening er nog onder', () => {
  const sleutel = H.nieuweSleutel();
  const sbomBytes = Buffer.from(JSON.stringify(stuklijst()));
  const doc = getekendDocument(sbomBytes, sleutel);
  doc.image.digest = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
  const r = H.controleerHerkomst({ document: doc, sbomBytes, publiekPem: sleutel.publiek });
  assert.strictEqual(r.ok, false);
  assert.ok(r.klachten.some(k => k.includes('handtekening klopt niet')));
});

test('een ANDERE stuklijst naast hetzelfde document valt om', () => {
  const sleutel = H.nieuweSleutel();
  const sbomBytes = Buffer.from(JSON.stringify(stuklijst()));
  const doc = getekendDocument(sbomBytes, sleutel);
  const andere = Buffer.from(JSON.stringify(stuklijst({ os: [{ naam: 'kwaadaardig', versie: '1', arch: 'amd64' }] })));
  const r = H.controleerHerkomst({ document: doc, sbomBytes: andere, publiekPem: sleutel.publiek });
  assert.strictEqual(r.ok, false);
  assert.ok(r.klachten.some(k => k.includes('niet de stuklijst waaronder getekend is')));
});

test('een handtekening van een VREEMDE sleutel telt niet', () => {
  const echte = H.nieuweSleutel();
  const vreemde = H.nieuweSleutel();
  const sbomBytes = Buffer.from(JSON.stringify(stuklijst()));
  const doc = getekendDocument(sbomBytes, vreemde);
  const r = H.controleerHerkomst({ document: doc, sbomBytes, publiekPem: echte.publiek });
  assert.strictEqual(r.ok, false, 'wie zelf een sleutel meebrengt, tekent voor niemand');
});

test('zonder vastgelegde publieke sleutel is een handtekening geen bewijs', () => {
  const sleutel = H.nieuweSleutel();
  const sbomBytes = Buffer.from(JSON.stringify(stuklijst()));
  const doc = getekendDocument(sbomBytes, sleutel);
  const r = H.controleerHerkomst({ document: doc, sbomBytes, publiekPem: null });
  assert.strictEqual(r.ok, false);
  assert.ok(r.klachten.some(k => k.includes('geen vastgelegde publieke sleutel')));
});

test('een document zonder handtekening komt er niet mee weg', () => {
  const sleutel = H.nieuweSleutel();
  const sbomBytes = Buffer.from(JSON.stringify(stuklijst()));
  const doc = getekendDocument(sbomBytes, sleutel);
  delete doc.handtekening;
  const r = H.controleerHerkomst({ document: doc, sbomBytes, publiekPem: sleutel.publiek });
  assert.strictEqual(r.ok, false);
  assert.ok(r.klachten.some(k => k.includes('geen handtekening')));
});

/* DE CONTROLE DIE OP DE MACHINE TELT. Een geldige handtekening onder een ANDER
   image is precies het geval waarvoor deze hele laag bestaat: het bewijs klopt,
   maar het gaat niet over wat er draait. */
test('een geldig document over een ander image dan wat er draait, zakt', () => {
  const sleutel = H.nieuweSleutel();
  const sbomBytes = Buffer.from(JSON.stringify(stuklijst()));
  const doc = getekendDocument(sbomBytes, sleutel);
  const goed = H.controleerHerkomst({ document: doc, sbomBytes, publiekPem: sleutel.publiek, draait: doc.image.digest });
  assert.strictEqual(goed.ok, true);
  const fout = H.controleerHerkomst({
    document: doc, sbomBytes, publiekPem: sleutel.publiek,
    draait: 'sha256:3333333333333333333333333333333333333333333333333333333333333333'
  });
  assert.strictEqual(fout.ok, false);
  assert.ok(fout.klachten.some(k => k.includes('niet het getekende image')));
});

test('een onbekend formaat wordt niet half geaccepteerd', () => {
  const r = H.controleerHerkomst({ document: { formaat: 'iets-anders' }, publiekPem: 'x' });
  assert.strictEqual(r.ok, false);
});

/* De canonieke vorm is de spil onder de handtekening: twee documenten die
   hetzelfde beweren moeten dezelfde bytes geven, anders tekent de ene wat de
   andere niet leest. */
test('de canonieke vorm negeert sleutelvolgorde maar niet inhoud', () => {
  assert.strictEqual(H.canoniek({ a: 1, b: { c: 2, d: 3 } }), H.canoniek({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notStrictEqual(H.canoniek({ a: 1 }), H.canoniek({ a: 2 }));
});
