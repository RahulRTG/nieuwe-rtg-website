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
