/* DE MATERIAALLIJST -- klopt hij nog met wat er werkelijk in de release zit?

   WAT DEZE TOETS WEL EN NIET VASTLEGT, en dat verschil is de hele opzet.

   Hij vergelijkt SBOM.json NIET regel voor regel met een verse ronde. Dat zou
   een momentopname zijn die bij elke commit rood staat: de afdruk over de eigen
   code verandert per definitie zodra er een letter verandert. Een poort die
   altijd rood staat, wordt binnen een week genegeerd.

   Hij legt de EIGENSCHAPPEN vast die waar horen te blijven:
     - elk basis-image uit de Dockerfile staat erin (de werkelijke derdenlaag);
     - elke crate uit Cargo.lock staat erin;
     - er zit GEEN npm-pakket in de release -- de nuldependency-belofte, die de
       norm al bewaakt en die hier zichtbaar wordt gemaakt;
     - de afdruk is reproduceerbaar: twee rondes geven hetzelfde antwoord.

   Dat laatste is de belangrijkste. Een afdruk die per ronde verschilt, kan de
   vraag "is wat er draait ook wat er is gebouwd" niet beantwoorden, en dan is
   het bewijs een sier.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de basis-images uit de lijst gelaten (basisImages -> [])
     -> "elk basis-image uit de Dockerfile staat op de lijst" ZAKT (RAAK)
   - de afdruk over de inhoud zonder het PAD laten lopen
     -> "een verplaatst bestand is een andere release" ZAKT (RAAK)
   - devDependencies als inRelease meetellen
     -> "er zit geen npm-pakket in de release" ZAKT (RAAK)

   Draai los: node --test test/sbom.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sbom = require('../scripts/sbom');

const WORTEL = path.join(__dirname, '..');
const lijst = sbom.bouw();

test('elk basis-image uit de Dockerfile staat op de lijst', () => {
  const df = fs.readFileSync(path.join(WORTEL, 'Dockerfile'), 'utf8');
  const uitDocker = [...df.matchAll(/^FROM\s+(\S+)/gmi)].map(m => m[1]).filter(r => r.includes(':'));
  assert.ok(uitDocker.length >= 2, 'de Dockerfile heeft meerdere fasen (' + uitDocker.length + ')');
  const opLijst = new Set(lijst.onderdelen.filter(o => o.ecosysteem === 'oci').map(o => o.naam + ':' + o.versie));
  for (const ref of uitDocker) assert.ok(opLijst.has(ref), ref + ' staat niet op de materiaallijst');
});

test('elke crate uit Cargo.lock staat op de lijst', () => {
  const lock = fs.readFileSync(path.join(WORTEL, 'motor', 'Cargo.lock'), 'utf8');
  const namen = [...lock.matchAll(/\[\[package\]\][\s\S]*?name\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  const opLijst = new Set(lijst.onderdelen.filter(o => o.ecosysteem === 'cargo').map(o => o.naam));
  for (const n of namen) assert.ok(opLijst.has(n), 'crate ' + n + ' staat niet op de materiaallijst');
});

test('er zit GEEN npm-pakket in de release: de nuldependency-belofte', () => {
  const inRelease = lijst.onderdelen.filter(o => o.ecosysteem === 'npm' && o.inRelease);
  assert.equal(inRelease.length, 0,
    'productie draait zonder npm-afhankelijkheden; gevonden: ' + inRelease.map(o => o.naam).join(', '));
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0,
    'en package.json draagt er ook geen (dat is wat de lijst weerspiegelt)');
});

test('de afdruk is reproduceerbaar: twee rondes geven hetzelfde antwoord', () => {
  const a = sbom.bouw().eigenCode.afdruk;
  const b = sbom.bouw().eigenCode.afdruk;
  assert.equal(a, b, 'een afdruk die per ronde verschilt, bewijst niets');
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});

test('een verplaatst bestand is een andere release, ook met dezelfde bytes', () => {
  /* Het pad gaat MEE in de afdruk. Zonder dat zou README.md naar docs/README.md
     verplaatsen dezelfde afdruk opleveren -- en dat is een andere release.

     HIER STOND EERST EEN ZWAKKE VERSIE, en een mutatie heeft hem gevonden: hij
     vergeleek dezelfde twee bestanden in een andere VOLGORDE. Dat verschilt ook
     zonder het pad in de som, dus de toets bleef groen terwijl het pad eruit
     was gehaald. Nu twee verschillende paden met IDENTIEKE inhoud -- het enige
     geval dat de vraag echt stelt. */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sbom-'));
  fs.writeFileSync(path.join(tmp, 'een.txt'), 'zelfde bytes');
  fs.writeFileSync(path.join(tmp, 'twee.txt'), 'zelfde bytes');
  const een = sbom.afdrukVan(['een.txt'], tmp).afdruk;
  const twee = sbom.afdrukVan(['twee.txt'], tmp).afdruk;
  assert.notEqual(een, twee, 'zelfde inhoud op een ander pad hoort een andere afdruk te geven');
  assert.equal(een, sbom.afdrukVan(['een.txt'], tmp).afdruk, 'en hetzelfde pad hetzelfde');
});

test('de lijst zegt wat hij NIET beweert', () => {
  assert.match(lijst.uitleg, /niet dat het veilig is|scanner/i,
    'een materiaallijst is geen keurmerk, en dat hoort erin te staan');
  const opgeslagen = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SBOM.json'), 'utf8'));
  assert.equal(opgeslagen.formaat, lijst.formaat, 'SBOM.json is van hetzelfde formaat als de generator maakt');
  assert.ok(opgeslagen.eigenCode.bestanden > 100, 'en hij dekt de hele boom, niet een handvol bestanden');
});

/* ---- het bouwstempel: kan een DRAAIEND proces zeggen welke build het is? ---- */

test('zonder stempel zegt de server dat hij geen release is, met de reden', () => {
  const oud = { c: process.env.RTG_BOUW_COMMIT, a: process.env.RTG_BRON_AFDRUK };
  delete process.env.RTG_BOUW_COMMIT; delete process.env.RTG_BRON_AFDRUK;
  delete require.cache[require.resolve('../server/bouwstempel')];
  const { bouwstempel } = require('../server/bouwstempel');
  const s = bouwstempel();
  assert.equal(s.vastgelegd, false);
  assert.equal(s.commit, null);
  assert.ok(s.reden && /release-image|stempel/i.test(s.reden), 'en er staat WAAROM: ' + s.reden);
  if (oud.c) process.env.RTG_BOUW_COMMIT = oud.c;
  if (oud.a) process.env.RTG_BRON_AFDRUK = oud.a;
});

test('met een stempel draagt hij commit en bronafdruk, en geen reden meer', () => {
  process.env.RTG_BOUW_COMMIT = 'abc123';
  process.env.RTG_BRON_AFDRUK = 'sha256:' + 'f'.repeat(64);
  delete require.cache[require.resolve('../server/bouwstempel')];
  const { bouwstempel } = require('../server/bouwstempel');
  const s = bouwstempel();
  assert.equal(s.vastgelegd, true);
  assert.equal(s.commit, 'abc123');
  assert.equal(s.reden, null, 'een vastgelegd stempel heeft geen excuus nodig');
  delete process.env.RTG_BOUW_COMMIT; delete process.env.RTG_BRON_AFDRUK;
});

test('het stempel wordt NIET door het proces zelf uitgerekend', () => {
  /* Een proces dat zijn eigen afdruk berekent, berekent hem over de bestanden
     die het op dat moment heeft -- en dat is precies de vraag niet. De bron
     hoort dus alleen uit de omgeving te komen, en nergens anders vandaan. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server', 'bouwstempel.js'), 'utf8');
  assert.ok(!/require\(.*sbom|createHash|readFileSync/.test(bron),
    'bouwstempel.js hoort niets te lezen of te hashen; hij geeft door wat de bouwer zei');
});

/* ---- de uitrolproef: draait wat er is gebouwd? ---- */

const uitrol = require('../scripts/uitrolproef');
const AFDRUK = 'sha256:' + 'a'.repeat(64);
const ANDERS = 'sha256:' + 'b'.repeat(64);

test('een gelijke bronafdruk is GELIJK, en zegt erbij wat het niet bewijst', () => {
  const u = uitrol.oordeel({ vastgelegd: true, bronAfdruk: AFDRUK }, AFDRUK);
  assert.equal(u.stand, 'gelijk');
  assert.equal(u.code, 0);
  assert.match(u.let, /basis-images|handtekening/i,
    'een provenance-werktuig dat niet zegt wat het NIET bewijst, wordt overschat');
});

test('een andere bronafdruk is een alarm, met beide waarden erbij', () => {
  const u = uitrol.oordeel({ vastgelegd: true, bronAfdruk: ANDERS }, AFDRUK);
  assert.equal(u.stand, 'anders');
  assert.equal(u.code, 1);
  assert.equal(u.draait, ANDERS);
  assert.equal(u.verwacht, AFDRUK, 'wie dit leest moet kunnen zien WAT er afwijkt');
});

test('geen stempel is NIET VAST TE STELLEN, en niet stiekem goed of fout', () => {
  /* BESTUUR.md: onbekend is een eersteklas uitslag naast in orde en storing.
     Een server zonder stempel als "gelijk" tellen zou de proef waardeloos maken;
     als "anders" zou elke ontwikkelserver een alarm geven. */
  const geen = uitrol.oordeel({ vastgelegd: false, reden: 'geen release-image' }, AFDRUK);
  assert.equal(geen.stand, 'niet vast te stellen');
  assert.equal(geen.code, 2);
  assert.match(geen.waarom, /release-image/, 'met de reden van de server zelf');

  const zonderVerwachting = uitrol.oordeel({ vastgelegd: true, bronAfdruk: AFDRUK }, null);
  assert.equal(zonderVerwachting.stand, 'niet vast te stellen',
    'ook zonder verwachte afdruk valt er niets vast te stellen');
});

test('de drie uitslagen hebben drie verschillende afsluitcodes', () => {
  const codes = [
    uitrol.oordeel({ vastgelegd: true, bronAfdruk: AFDRUK }, AFDRUK).code,
    uitrol.oordeel({ vastgelegd: true, bronAfdruk: ANDERS }, AFDRUK).code,
    uitrol.oordeel(null, AFDRUK).code
  ];
  assert.deepEqual(codes, [0, 1, 2],
    'een uitrolpijplijn moet de drie uit elkaar kunnen houden zonder tekst te lezen');
});

test('een opgeschreven digest komt in de lijst, en zonder staat dat er ook', () => {
  /* De pijplijn schrijft BASISIMAGES.json met wat hij werkelijk trok. Dat
     bestand hoort bij het ARTEFACT en niet bij de bron, dus het staat in
     .gitignore -- hier wordt allebei de standen beproefd. */
  const pad = path.join(WORTEL, 'BASISIMAGES.json');
  const bestond = fs.existsSync(pad);
  const bewaard = bestond ? fs.readFileSync(pad) : null;
  try {
    const ref = (lijst.onderdelen.find(o => o.ecosysteem === 'oci') || {});
    assert.ok(ref.naam, 'er is minstens een basis-image');
    const volleRef = ref.naam + ':' + ref.versie;
    const digest = 'sha256:' + 'c'.repeat(64);
    fs.writeFileSync(pad, JSON.stringify({ images: { [volleRef]: digest } }));
    const met = sbom.bouw();
    const gevonden = met.onderdelen.find(o => o.naam === ref.naam && o.versie === ref.versie);
    assert.equal(gevonden.integriteit, digest, 'de getrokken digest staat erbij');
    assert.match(gevonden.let, /werkelijk trok/, 'met wat die digest betekent');
    assert.ok(met.telling.imagesMetDigest >= 1, 'en hij wordt geteld');

    fs.unlinkSync(pad);
    const zonder = sbom.bouw();
    const kaal = zonder.onderdelen.find(o => o.naam === ref.naam && o.versie === ref.versie);
    assert.equal(kaal.integriteit, null);
    assert.match(kaal.let, /geen digest opgeschreven/,
      'zonder digest staat dat er als de eerlijke stand, niet als fout');
  } finally {
    if (bestond) fs.writeFileSync(pad, bewaard);
    else if (fs.existsSync(pad)) fs.unlinkSync(pad);
  }
});

/* ---- het releasezegel: staat RTG hier achter? ---- */

const zegel = require('../scripts/releasezegel');
const crypto = require('crypto');

function sleutelpaar() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey };
}
const teken = (bytes, priv) => crypto.sign(null, bytes, priv);

test('een geldig zegel is GELDIG, en zegt erbij wat het niet bewijst', () => {
  const k = sleutelpaar();
  const bytes = Buffer.from(JSON.stringify(zegel.maak({ image: 'ghcr.io/x:v1' })));
  const u = zegel.verifieer(bytes, teken(bytes, k.priv), k.pub);
  assert.equal(u.stand, 'geldig');
  assert.equal(u.code, 0);
  assert.match(u.let, /GitHub|vertrouwensbron/i,
    'een eigen handtekening bewijst niet wie er heeft gebouwd, en dat hoort in de uitslag');
});

test('een verklaring die is AANGERAAKT breekt het zegel', () => {
  const k = sleutelpaar();
  const bytes = Buffer.from('{"image":"ghcr.io/x:v1"}');
  const sig = teken(bytes, k.priv);
  const geknoeid = Buffer.from('{"image":"ghcr.io/kwaad:v1"}');
  const u = zegel.verifieer(geknoeid, sig, k.pub);
  assert.equal(u.stand, 'gebroken');
  assert.equal(u.code, 1);
  assert.match(u.waarom, /veranderd|niet door RTG/i);
});

test('een handtekening van een ANDERE sleutel is gebroken, niet geldig', () => {
  const echt = sleutelpaar(), vals = sleutelpaar();
  const bytes = Buffer.from('{"image":"ghcr.io/x:v1"}');
  const u = zegel.verifieer(bytes, teken(bytes, vals.priv), echt.pub);
  assert.equal(u.stand, 'gebroken', 'wie de sleutel niet heeft, kan niet namens RTG spreken');
});

test('zonder publieke sleutel is het NIET VAST TE STELLEN, en niet stiekem goed', () => {
  const k = sleutelpaar();
  const bytes = Buffer.from('{"a":1}');
  const u = zegel.verifieer(bytes, teken(bytes, k.priv), null);
  assert.equal(u.stand, 'niet vast te stellen');
  assert.equal(u.code, 2);
  /* Op de REDEN en niet alleen op de stand. Zonder de wachter valt dit geval
     ook in de catch eronder, en dan klopt de uitslag toevallig maar zegt hij
     "de sleutel is niet te lezen" in plaats van "er is geen sleutel". Een
     mutatie die de wachter weghaalde, zakte hier eerst NIET op -- gevonden
     doordat ze bleef staan. */
  assert.match(u.waarom, /geen publieke releasesleutel/i,
    'de reden hoort te zeggen dat er GEEN sleutel is, niet dat hij onleesbaar is: ' + u.waarom);
  const zonderSig = zegel.verifieer(bytes, null, k.pub);
  assert.equal(zonderSig.stand, 'niet vast te stellen', 'en zonder handtekening ook niet');
});

test('de verklaring bedenkt niets: alles komt uit de materiaallijst', () => {
  const v = zegel.maak({ image: 'ghcr.io/rtg:v9', imageDigest: 'sha256:' + 'd'.repeat(64) });
  const s = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SBOM.json'), 'utf8'));
  assert.equal(v.bronAfdruk, s.eigenCode.afdruk, 'de bronafdruk komt uit SBOM.json');
  assert.equal(v.commit, s.product.commit);
  assert.equal(v.image, 'ghcr.io/rtg:v9');
  assert.equal(v.npmInRelease, 0, 'en de nuldependency-stand reist mee in het zegel');
  /* Wat onbekend is, is null en geen lege string: een lege string ziet eruit
     als een antwoord. */
  const leeg = zegel.maak({});
  assert.equal(leeg.image, null);
  assert.equal(leeg.imageDigest, null);
});

test('de PRIVEsleutel staat nergens in de repository', () => {
  /* Een script dat een privesleutel wegschrijft, zet hem vroeg of laat in een
     commit. releasesleutel.js drukt hem af en schrijft alleen de publieke helft. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'releasesleutel.js'), 'utf8');
  assert.ok(!/writeFileSync\([^)]*priv/i.test(bron), 'de privesleutel wordt niet weggeschreven');
  assert.match(bron, /RELEASE\.pub/, 'de publieke helft wel');
  const ignore = fs.readFileSync(path.join(WORTEL, '.gitignore'), 'utf8');
  for (const naam of ['RELEASE.key', 'RELEASE.sig', 'RELEASE.json']) {
    assert.ok(ignore.includes(naam), naam + ' hoort in .gitignore');
  }
});
