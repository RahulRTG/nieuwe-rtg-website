/* DE HERKOMST VAN HET IMAGE, TAK VOOR TAK (scripts/imageherkomst.js).

   test/imageherkomst.test.js bewijst de hoofdlijn: lezers, stuklijst,
   handtekening en de controle op het draaiende image. Hier staan de randen
   die daar ongemeten bleven: rommelige invoer voor de lezers, de purl-vormen
   per ecosysteem, de bevroren CI-uitvoer, ELKE klacht van de strenge
   kandidaatcontrole afzonderlijk, en de standen van het commando zelf. Elk
   commando draait met --uit en --herkomst in een tijdelijke map (PROEFMAP) en
   zonder docker op het pad, zodat er niets in de repository belandt en er
   niets van buiten wordt gehaald.

   Los: node --test test/imageherkomst-takken.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const H = require('../scripts/imageherkomst');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'imageherkomst.js');
const HEX = c => c.repeat(64);

function metMap(doe) {
  const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-imageherkomst-tak-'));
  try { return doe(PROEFMAP); } finally { fs.rmSync(PROEFMAP, { recursive: true, force: true }); }
}

/* Het commando zonder docker en zonder signeersleutel: het pad bevat alleen
   node zelf (en git, voor gitInfo). */
function draai(args) {
  const git = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  const pad = [path.dirname(process.execPath)].concat(git ? [path.dirname(git)] : []).join(path.delimiter);
  const env = { ...process.env, PATH: pad, RTG_RELEASE_SIGN_KEY: '' };
  return spawnSync(process.execPath, [SCRIPT].concat(args), { encoding: 'utf8', env, timeout: 60000 });
}

/* --- de lezers ---------------------------------------------------------- */

test('dpkg zonder architectuur heet "unknown", en lege of ontbrekende invoer geeft niets', () => {
  const uit = H.leesDpkg('  tzdata \t 2024a \t\nbash\t5.2\n');
  assert.deepEqual(uit, [
    { naam: 'bash', versie: '5.2', arch: 'unknown' },
    { naam: 'tzdata', versie: '2024a', arch: 'unknown' }
  ]);
  assert.deepEqual(H.leesDpkg(undefined), []);
  assert.deepEqual(H.leesApk(null), []);
  assert.equal(H.leesApk('musl-1.2.5-r0').length, 1);
});

test('Cargo.lock: een andere sectie sluit het pakket af, en kale velden vallen weg', () => {
  const crates = H.leesCargoLock([
    'version = 3', 'name = "voor-elk-pakket"',
    '[[package]]', 'name = "zz"', 'version = "1.0.0"',
    '[metadata]', 'name = "geen-pakket"', 'version = "9"',
    '[[package]]', 'name = "aa"', 'version = "2.0.0"', 'source = "registry+x"',
    '[[package]]', 'name = "zonder-versie"'
  ].join('\n'));
  assert.deepEqual(crates.map(c => c.naam), ['aa', 'zz']);
  assert.equal(crates[0].source, 'registry+x');
  assert.deepEqual(H.leesCargoLock(null), []);
});

test('package-lock: onleesbaar is nul, een pakket zonder naam of versie krijgt zijn pad en "0"', () => {
  assert.deepEqual(H.leesNpmLock('{kapot'), { runtime: [], ontwikkeling: 0 });
  assert.deepEqual(H.leesNpmLock('{}'), { runtime: [], ontwikkeling: 0 });
  const npm = H.leesNpmLock(JSON.stringify({ packages: {
    '': { name: 'wortel' },
    'node_modules/kaal': {},
    'node_modules/leeg': null,
    'node_modules/@scope/b': { name: '@scope/b', version: '1.2.3', integrity: 'sha512-QQ' }
  } }));
  assert.equal(npm.ontwikkeling, 0);
  assert.deepEqual(npm.runtime, [
    { naam: '@scope/b', versie: '1.2.3', integriteit: 'sha512-QQ' },
    { naam: 'kaal', versie: '0', integriteit: null },
    { naam: 'leeg', versie: '0', integriteit: null }
  ]);
});

/* --- de stuklijst ------------------------------------------------------- */

test('de stuklijst geeft apk-purls, hashes voor crates en npm, en valt terug op de naam rtg', () => {
  const s = H.maakSbom({
    os: [{ naam: 'musl', versie: '1.2.5-r0', arch: 'unknown', apk: true }],
    crates: [{ naam: 'serde', versie: '1.0.0', checksum: HEX('a'), source: 'registry+x' }],
    npm: { runtime: [{ naam: 'iets', versie: '2.0.0', integriteit: 'sha512-ZZZ' }, { naam: 'kaal', versie: '1' }], ontwikkeling: 0 },
    gemaakt: 't', serie: 's'
  });
  const per = Object.fromEntries(s.components.map(c => [c.name, c]));
  assert.equal(per.musl.purl, 'pkg:apk/alpine/musl@1.2.5-r0');
  assert.deepEqual(per.serde.hashes, [{ alg: 'SHA-256', content: HEX('a') }]);
  assert.equal(per.serde.description, undefined, 'een registry-crate is geen eigen crate');
  assert.deepEqual(per.iets.hashes, [{ alg: 'SHA-512', content: 'ZZZ' }]);
  assert.equal(per.kaal.hashes, undefined);
  assert.equal(per.node, undefined, 'zonder node geen platformcomponent');
  assert.equal(s.metadata.component.name, 'rtg');
  assert.equal(s.metadata.component.version, '0');
  assert.equal(s.metadata.component.hashes, undefined);
  assert.equal(s.metadata.component.description, 'RTG / RTFoundation productie-image');
  const prop = Object.fromEntries(s.metadata.properties.map(p => [p.name, p.value]));
  assert.equal(prop['rtg:runtime-dependencies-npm'], '2');
  assert.equal(prop['rtg:crates'], '1');
  assert.equal(prop['rtg:volledigheid'], 'image');
  const leeg = H.maakSbom({ gemaakt: 't', serie: 's' });
  assert.equal(leeg.components.length, 0);
  assert.equal(Object.fromEntries(leeg.metadata.properties.map(p => [p.name, p.value]))['rtg:dev-dependencies-npm'], '0');
});

test('maakHerkomst zonder bewijs, bron of bouw zet die velden expliciet op null', () => {
  const d = H.maakHerkomst({ sbomBytes: Buffer.from('x'), sbomComponenten: 0, gemaakt: 't' });
  assert.deepEqual(d.image, { verwijzing: null, digest: null });
  assert.equal(d.releasebewijs, null);
  assert.equal(d.bron, null);
  assert.equal(d.uitvoering, null);
  assert.equal(d.kwalificatie, null);
  assert.equal(d.bouw, null);
  assert.equal(d.sbom.sha256, H.sha256('x'));
  const met = H.maakHerkomst({ sbomBytes: 'y', bewijs: {}, gemaakt: 't' });
  assert.deepEqual(met.releasebewijs, { inhoudSha256: null, bestandAantal: null });
});

test('een handtekening van de verkeerde vorm faalt zonder te gooien', () => {
  const s = H.nieuweSleutel();
  const doc = { a: 1 };
  const goed = H.teken(doc, crypto.createPrivateKey(s.prive));
  assert.equal(H.controleerHandtekening(doc, goed, s.publiek), true);
  assert.equal(H.controleerHandtekening(doc, 'kort', s.publiek), false);
  assert.equal(H.controleerHandtekening(doc, undefined, s.publiek), false);
  assert.equal(H.controleerHandtekening(doc, goed, 'geen pem'), false);
});

test('controleerHerkomst: een draaiend image vergelijken zonder digest in het document', () => {
  const s = H.nieuweSleutel();
  const doc = H.maakHerkomst({ sbomBytes: 'x', gemaakt: 't' });
  doc.handtekening = { algoritme: 'ed25519', waarde: H.teken(doc, crypto.createPrivateKey(s.prive)) };
  const r = H.controleerHerkomst({ document: doc, publiekPem: s.publiek, draait: ' sha256:1 ' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.klachten, ['Dit document noemt geen image-digest, dus er valt niets te vergelijken.']);
  assert.equal(H.controleerHerkomst({ document: null }).ok, false);
  const zonderSbomVeld = { ...doc };
  delete zonderSbomVeld.sbom;
  const r2 = H.controleerHerkomst({ document: zonderSbomVeld, sbomBytes: 'x', publiekPem: s.publiek });
  assert.ok(r2.klachten.some(k => /tegen undefined/.test(k)));
});

/* --- de bevroren CI-uitvoer --------------------------------------------- */

function zetUitvoer(PROEFMAP) {
  for (const [naam, rel] of Object.entries(H.UITVOER_BESTANDEN)) {
    fs.mkdirSync(path.dirname(path.join(PROEFMAP, rel)), { recursive: true });
    fs.writeFileSync(path.join(PROEFMAP, rel), '{"' + naam + '":"groen"}\n');
  }
}

test('uitvoeringHashes noemt elk bevroren bewijs, en weigert als er een ontbreekt', () => {
  metMap((PROEFMAP) => {
    assert.throws(() => H.uitvoeringHashes(PROEFMAP), /Verplicht bevroren CI-bewijs ontbreekt: \.release\/ci-suite\.json/);
    zetUitvoer(PROEFMAP);
    const u = H.uitvoeringHashes(PROEFMAP);
    assert.deepEqual(Object.keys(u).sort(), Object.keys(H.UITVOER_BESTANDEN).sort());
    assert.equal(u.pg.pad, '.release/ci-pg-bewijs.json');
    assert.equal(u.pg.bytes, '{"pg":"groen"}\n'.length);
    assert.equal(u.pg.sha256, H.sha256('{"pg":"groen"}\n'));
  });
});

/* --- de strenge kandidaatcontrole --------------------------------------- */

const IMAGE = 'ghcr.io/rtg/app:kandidaat';
const DIGEST = 'sha256:' + HEX('d');
const IMAGE_ID = 'sha256:' + HEX('b');
const INHOUD = HEX('1');

function kandidaat(PROEFMAP, wijzig) {
  zetUitvoer(PROEFMAP);
  const sleutel = H.nieuweSleutel();
  const sbom = H.maakSbom({ app: { naam: 'rtg', versie: '1' }, image: IMAGE,
    os: [{ naam: 'base', versie: '1', arch: 'amd64' }], gemaakt: 't', serie: 's' });
  const sbomBytes = Buffer.from(JSON.stringify(sbom));
  const uitvoering = H.uitvoeringHashes(PROEFMAP);
  const document = H.maakHerkomst({ image: IMAGE, digest: DIGEST, sbomBytes,
    sbomComponenten: sbom.components.length, bewijs: { inhoudSha256: INHOUD, bestandAantal: 3 },
    bron: { commit: 'c0ffee', werkboomSchoon: true }, uitvoering,
    kwalificatie: { formaat: 'rtg-kwalificatie-v1', rol: 'app', imageId: IMAGE_ID, backupImageId: 'sha256:' + HEX('c'),
      inhoudSha256: INHOUD, bestandAantal: 3, imageBewijsSha256: HEX('7'), voorSha256: HEX('8'), naSha256: HEX('9') },
    bouw: { draaier: 'github-actions', workflow: 'release-image', run: '9' }, gemaakt: 't' });
  if (wijzig) wijzig(document);
  document.handtekening = { algoritme: 'ed25519', waarde: H.teken(document, crypto.createPrivateKey(sleutel.prive)) };
  return { document, sbomBytes, publiekPem: sleutel.publiek, draait: DIGEST, commit: 'c0ffee', image: IMAGE,
    bewijsInhoudSha256: INHOUD, uitvoering, imageId: IMAGE_ID };
}

test('een kandidaat die alles bindt, komt door de strenge controle', () => {
  metMap((PROEFMAP) => {
    const r = H.controleerKandidaatHerkomst(kandidaat(PROEFMAP));
    assert.deepEqual(r.klachten, []);
    assert.equal(r.ok, true);
  });
});

test('elke ontbrekende binding geeft precies haar eigen klacht', () => {
  const gevallen = [
    [d => { d.image.digest = 'sha256:kort'; }, /geen immutable registrydigest/],
    [d => { d.image.verwijzing = 'ghcr.io/rtg/ander:1'; }, /andere imagereferentie/],
    [d => { d.bron.werkboomSchoon = false; }, /schone releasecommit/],
    [d => { d.bron = null; }, /schone releasecommit/],
    [d => { d.bouw.draaier = 'laptop'; }, /geautoriseerde CI-bouwherkomst/],
    [d => { d.bouw = null; }, /geautoriseerde CI-bouwherkomst/],
    [d => { d.releasebewijs.inhoudSha256 = HEX('2'); }, /exacte runtime-inhoudsbewijs/],
    [d => { d.sbom.componenten = 99; }, /SBOM-telling wijkt af/],
    [d => { delete d.uitvoering.pg; }, /niet alle bevroren CI-uitvoeringsbewijzen/],
    [d => { d.uitvoering.pg.bytes = 0; }, /niet alle bevroren CI-uitvoeringsbewijzen/],
    [d => { d.uitvoering.pg.sha256 = 'x'; }, /niet alle bevroren CI-uitvoeringsbewijzen/],
    [d => { d.uitvoering.pg.pad = 'elders.json'; }, /niet alle bevroren CI-uitvoeringsbewijzen/],
    [d => { d.uitvoering = null; }, /niet alle bevroren CI-uitvoeringsbewijzen/],
    [d => { d.kwalificatie = null; }, /draagt geen kwalificatie/]
  ];
  for (const [wijzig, verwacht] of gevallen) {
    metMap((PROEFMAP) => {
      const r = H.controleerKandidaatHerkomst(kandidaat(PROEFMAP, wijzig));
      assert.equal(r.ok, false, String(verwacht));
      assert.ok(r.klachten.some(k => verwacht.test(k)), verwacht + ' -- gezien: ' + r.klachten.join(' | '));
    });
  }
});

test('ook de argumenten van de controle zelf tellen: commit, inhoud, uitvoering en image-ID', () => {
  metMap((PROEFMAP) => {
    const basis = kandidaat(PROEFMAP);
    const klacht = (extra, re) => {
      const r = H.controleerKandidaatHerkomst({ ...basis, ...extra });
      assert.equal(r.ok, false);
      assert.ok(r.klachten.some(k => re.test(k)), re + ' -- gezien: ' + r.klachten.join(' | '));
    };
    klacht({ commit: 'anders' }, /schone releasecommit/);
    klacht({ bewijsInhoudSha256: 'geen-hash' }, /exacte runtime-inhoudsbewijs/);
    klacht({ uitvoering: { ...basis.uitvoering, pg: { ...basis.uitvoering.pg, bytes: 1 } } }, /wijkt af van de signed provenance/);
    klacht({ imageId: 'sha256:' + HEX('e') }, /niet het gekwalificeerde app-image/);
    klacht({ rol: 'backup' }, /hoort bij rol app, niet bij backup/);
    klacht({ draait: 'sha256:' + HEX('f') }, /niet het getekende image/);
  });
});

test('een ontbrekende of onvolledige stuklijst zakt de kandidaat', () => {
  metMap((PROEFMAP) => {
    const basis = kandidaat(PROEFMAP);
    const zonder = H.controleerKandidaatHerkomst({ ...basis, sbomBytes: null });
    assert.ok(zonder.klachten.some(k => /ontbreekt of is onleesbaar/.test(k)));
    assert.ok(zonder.klachten.some(k => /geen volledige inventaris/.test(k)));
    const bron = Buffer.from(JSON.stringify(H.maakSbom({ gemaakt: 't', serie: 's' })));
    const alleenBron = H.controleerKandidaatHerkomst({ ...basis, sbomBytes: bron });
    assert.ok(alleenBron.klachten.some(k => /geen volledige inventaris/.test(k)));
    assert.ok(!alleenBron.klachten.some(k => /onleesbaar/.test(k)));
    const geenDoc = H.controleerKandidaatHerkomst({ ...basis, document: { formaat: 'x' } });
    assert.equal(geenDoc.ok, false);
    assert.ok(geenDoc.klachten.some(k => /Onbekend formaat/.test(k)));
    assert.ok(geenDoc.klachten.some(k => /geen immutable registrydigest/.test(k)));
  });
});

/* --- het commando ------------------------------------------------------- */

test('zonder stand geeft het commando zijn gebruik en een foutcode', () => {
  const r = draai([]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Gebruik: --sleutelcontrole/);
});

test('--nieuwe-sleutel en --sleutelcontrole geven nooit een sleutel uit', () => {
  const nieuw = draai(['--nieuwe-sleutel']);
  assert.equal(nieuw.status, 1);
  assert.match(nieuw.stderr, /\[herkomst\] Maak echte signingkeys/);
  assert.doesNotMatch(nieuw.stdout + nieuw.stderr, /PRIVATE KEY/);
  const controle = draai(['--sleutelcontrole']);
  assert.equal(controle.status, 1, controle.stdout + controle.stderr);
  assert.match(controle.stderr, /\[herkomst\]/);
});

test('--sbom met een dpkg-bestand schrijft een image-stuklijst naar --uit', () => {
  metMap((PROEFMAP) => {
    const pakketten = path.join(PROEFMAP, 'dpkg.txt');
    fs.writeFileSync(pakketten, 'libc6\t2.36\tamd64\nbash\t5.2\tamd64\n');
    const uit = path.join(PROEFMAP, 'uit', 'sbom.json');
    const r = draai(['--sbom', '--pakketten=' + pakketten, '--uit', uit, '--eis-image']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Stuklijst geschreven/);
    assert.doesNotMatch(r.stdout, /LET OP/);
    const s = JSON.parse(fs.readFileSync(uit, 'utf8'));
    assert.ok(s.components.some(c => c.name === 'libc6'));
    assert.equal(s.metadata.properties.find(p => p.name === 'rtg:volledigheid').value, 'image');
  });
});

test('--sbom zonder docker wordt eerlijk een bronstuklijst, en --eis-image laat dat zakken', () => {
  metMap((PROEFMAP) => {
    const uit = path.join(PROEFMAP, 'bron.json');
    const r = draai(['--sbom', '--image=ghcr.io/rtg/bestaat-niet:0', '--uit=' + uit, '--eis-image']);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /BRON-stuklijst/);
    const s = JSON.parse(fs.readFileSync(uit, 'utf8'));
    assert.equal(s.metadata.properties.find(p => p.name === 'rtg:volledigheid').value, 'alleen-bron');
    assert.match(s.metadata.component.description, /bestaat-niet/);
    const zonderEis = draai(['--sbom', '--uit=' + uit]);
    assert.equal(zonderEis.status, 0, zonderEis.stderr);
  });
});

test('--binden weigert zonder digest, en zonder rol of CI-bewijs voordat er iets getekend wordt', () => {
  metMap((PROEFMAP) => {
    const sbom = path.join(PROEFMAP, 'sbom.json');
    fs.writeFileSync(sbom, JSON.stringify({ components: [{}] }));
    const uit = path.join(PROEFMAP, 'herkomst.json');
    const geenDigest = draai(['--binden', '--image=ghcr.io/rtg/x:1', '--sbom=' + sbom, '--uit=' + uit]);
    assert.equal(geenDigest.status, 1);
    assert.match(geenDigest.stderr, /Zonder --digest/);
    const geenRol = draai(['--binden', '--digest=sha256:' + HEX('0'), '--sbom=' + sbom, '--uit=' + uit, '--rol=nee']);
    assert.equal(geenRol.status, 1);
    assert.match(geenRol.stderr, /\[herkomst\]/);
    assert.equal(fs.existsSync(uit), false, 'er mag geen ongetekend document ontstaan');
  });
});

test('--controle: geen document, een vreemde handtekening, en de strenge stand', () => {
  metMap((PROEFMAP) => {
    const weg = draai(['--controle', '--herkomst=' + path.join(PROEFMAP, 'weg.json')]);
    assert.equal(weg.status, 1);
    assert.match(weg.stderr, /Geen herkomstdocument gevonden/);

    const k = kandidaat(PROEFMAP);
    const herkomstPad = path.join(PROEFMAP, 'herkomst.json');
    fs.writeFileSync(herkomstPad, JSON.stringify(k.document));
    const vreemd = draai(['--controle', '--herkomst=' + herkomstPad, '--draait=' + DIGEST]);
    assert.equal(vreemd.status, 1);
    assert.match(vreemd.stdout, /stuklijst zelf is niet meegelezen/);
    assert.match(vreemd.stderr, /✗ De handtekening klopt niet/);

    fs.writeFileSync(path.join(PROEFMAP, 'sbom.json'), k.sbomBytes);
    const metSbom = draai(['--controle', '--herkomst', herkomstPad]);
    assert.equal(metSbom.status, 1);
    assert.doesNotMatch(metSbom.stdout, /niet meegelezen/);
    assert.doesNotMatch(metSbom.stderr, /niet de stuklijst waaronder/);

    const streng = draai(['--controle', '--eis-kandidaat', '--herkomst=' + herkomstPad]);
    assert.equal(streng.status, 1);
  });
});
