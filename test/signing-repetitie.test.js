'use strict';
/* DE GENERALE REPETITIE VAN SIGNING (deploy/TRUST.md, "Repetities gebruiken
   uitsluitend geisoleerde synthetische testidentiteiten").

   De losse stukken hadden al toetsen, elk met een stub waar de rest van de
   keten had moeten zitten: imageherkomst tekent, live-kandidaat controleert,
   productie-promotie weigert een build-sleutel. Wat nog NOOIT had gelopen is de
   keten zoals .github/workflows/release-image.yml hem draait: de scripts als
   PROCES, met de sleutel in een omgevingsvariabele en de ankers als bestanden
   in een gecommitte boom, waarbij de uitvoer van de ene stap de invoer van de
   volgende is. Er is nul keer een release doorheen gegaan, dus de eerste echte
   tag zou ook de eerste keer zijn dat deze stappen elkaar zien.

   Wat hier wel en niet bewezen wordt:
   - WEL: de stappen van de workflow, in die volgorde en met die vlaggen,
     sluiten op elkaar aan; drie gescheiden rollen, en een sleutel van de
     verkeerde rol of zonder anker stopt de keten voor er iets ontstaat.
   - NIET: docker. De pakketlijst komt uit een vast bestand (--pakketten) in
     plaats van uit een gebouwd image, en de digests zijn synthetisch. Wat een
     echte registry teruggeeft, bewijst pas de eerste echte tag.
   - NIET: de bevoegdheid van een echte custodian. Dit zijn testsleutels in het
     geheugen van deze toets; ze komen nooit in de repository. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const trust = require('../server/config/release-trust');

const BRON = path.join(__dirname, '..');
const STARTPUNTEN = ['scripts/imageherkomst.js', 'scripts/bron-release-bewijs.js',
  'scripts/release-bewijs.js', 'scripts/lib/productie-vrijgave.js'];
const DATA = ['package.json', 'package-lock.json', 'motor/Cargo.lock', '.nvmrc'];

/* Alleen wat de stappen werkelijk laden, gevolgd over hun eigen require's
   (ook de luie binnen een functie), zodat de boom klein blijft en een module
   die er ontbreekt de repetitie laat zakken in plaats van stil te ontbreken. */
function sluiting() {
  const gezien = new Set();
  const rij = STARTPUNTEN.map(r => path.join(BRON, r));
  while (rij.length) {
    const bestand = rij.pop();
    if (gezien.has(bestand)) continue;
    gezien.add(bestand);
    const tekst = fs.readFileSync(bestand, 'utf8');
    for (const m of tekst.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const basis = path.resolve(path.dirname(bestand), m[1]);
      const kandidaat = [basis, basis + '.js', basis + '.json', path.join(basis, 'index.js')]
        .find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (kandidaat) rij.push(kandidaat);
    }
  }
  return [...gezien].map(p => path.relative(BRON, p));
}

function pem(key, soort) { return key.export({ type: soort, format: 'pem' }).toString(); }

// welke vlaggen de repetitie per stand werkelijk meegaf (voor de derde toets)
const GEBRUIKT = {};
function run(root, args, env = {}) {
  if (args[0] === 'scripts/imageherkomst.js') {
    const stand = args[1].slice(2);
    GEBRUIKT[stand] = GEBRUIKT[stand] || new Set();
    for (const a of args.slice(1)) GEBRUIKT[stand].add(a.slice(2).split('=')[0]);
  }
  return spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } });
}

function opstelling(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-signing-repetitie-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const rel of [...sluiting(), ...DATA]) {
    const doel = path.join(root, rel);
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    fs.copyFileSync(path.join(BRON, rel), doel);
  }
  fs.writeFileSync(path.join(root, '.gitignore'), '.release/\n');
  // drie verschillende rollen, zoals de bootstrap ze vraagt; alleen de publieke helften gaan in de boom
  const rollen = {};
  for (const [naam, rol] of Object.entries(trust.ROLES)) {
    rollen[naam] = crypto.generateKeyPairSync('ed25519');
    fs.mkdirSync(path.join(root, 'deploy'), { recursive: true });
    fs.writeFileSync(path.join(root, rol.publicFile), pem(rollen[naam].publicKey, 'spki'));
  }
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  for (const a of [['init', '--quiet'], ['config', 'user.email', 'repetitie@test.invalid'],
    ['config', 'user.name', 'Repetitie'], ['add', '.'], ['commit', '--quiet', '-m', 'kandidaat']])
    assert.equal(git(...a).status, 0, 'git ' + a.join(' '));
  const commit = git('rev-parse', 'HEAD').stdout.trim();
  return { root, rollen, commit };
}

const CI = { GITHUB_WORKFLOW: 'Release-imagekandidaat', GITHUB_RUN_ID: '4242', RUNNER_NAME: 'repetitie' };
const DIGEST = 'sha256:' + 'a1'.repeat(32);
const BACKUP_DIGEST = 'sha256:' + 'b2'.repeat(32);

test('generale repetitie: de signingstappen van release-image.yml lopen als proces op elkaar aan', t => {
  const { root, rollen, commit } = opstelling(t);
  const bouwSleutel = { RTG_RELEASE_SIGN_KEY: pem(rollen.BUILD.privateKey, 'pkcs8') };
  const image = 'ghcr.io/rtg/repetitie:candidate-' + commit.slice(0, 12) + '-4242';
  const backup = 'ghcr.io/rtg/repetitie:candidate-backup-' + commit.slice(0, 12) + '-4242';
  const stap = (naam, args, env) => {
    const r = run(root, args, env);
    assert.equal(r.status, 0, naam + ' faalde:\n' + r.stdout + r.stderr);
    return r;
  };

  // "Ondertekeningsrollen vóór bouw bewijzen"
  stap('sleutelcontrole', ['scripts/imageherkomst.js', '--sleutelcontrole'], bouwSleutel);

  // "Bevries CI-uitvoering en exacte Git-bron" (de suites zelf draaien hier niet)
  fs.mkdirSync(path.join(root, '.release'), { recursive: true });
  for (const f of ['ci-suite.json', 'ci-schermsuite-bewijs.json', 'ci-pg-bewijs.json'])
    fs.writeFileSync(path.join(root, '.release', f), JSON.stringify({ repetitie: f }) + '\n');
  stap('bronbewijs', ['scripts/bron-release-bewijs.js']);

  // "Het releasebewijs UIT het image halen": zonder docker maakt dezelfde functie het in een
  // nagebootste imagemap, met de twee binaries op de plek waar het image ze heeft
  const imageMap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-signing-image-'));
  t.after(() => fs.rmSync(imageMap, { recursive: true, force: true }));
  // dezelfde minimale imagevorm als test/live-kandidaat.test.js
  for (const [rel, inhoud] of Object.entries({ 'package.json': '{"name":"rtg","version":"1"}',
    'package-lock.json': '{}', 'server/app.js': 'module.exports=1', 'public/dist/app.js': 'bouw',
    'scripts/start.js': 'start', 'motor/src/lib.rs': 'pub fn x(){}', 'motor/Cargo.toml': '[package]',
    'motor/Cargo.lock': '', 'rtg-motor': 'motor', 'rtg-sentinel': 'sentinel', 'BEGROTING.json': '{"grens":1}' })) {
    fs.mkdirSync(path.dirname(path.join(imageMap, rel)), { recursive: true });
    fs.writeFileSync(path.join(imageMap, rel), inhoud);
  }
  const manifest = run(root, ['-e', "process.stdout.write(JSON.stringify(require('./scripts/release-bewijs').maakManifest(process.argv[1])))", imageMap],
    { RTG_RELEASE_COMMIT: commit });
  assert.equal(manifest.status, 0, manifest.stderr);
  fs.writeFileSync(path.join(root, '.release', 'image-release-bewijs.json'), manifest.stdout + '\n');
  const inhoud = JSON.parse(manifest.stdout).inhoudSha256;

  // "Stuklijst (SBOM) uit het gepubliceerde image" -- met --eis-image, dus een bron-stuklijst zakt
  fs.writeFileSync(path.join(root, '.release', 'pakketten.txt'), 'base-files\t13\tamd64\nlibc6\t2.36\tamd64\n');
  for (const [img, uit] of [[image, 'sbom.json'], [backup, 'sbom-backup.json']])
    stap('sbom', ['scripts/imageherkomst.js', '--sbom', '--image=' + img, '--pakketten=.release/pakketten.txt',
      '--bewijs=.release/image-release-bewijs.json', '--uit=.release/' + uit, '--eis-image']);

  // "Herkomst binden aan het digest en tekenen"
  for (const [img, dg, sbom, uit] of [[image, DIGEST, 'sbom.json', 'herkomst.json'],
    [backup, BACKUP_DIGEST, 'sbom-backup.json', 'herkomst-backup.json']])
    stap('binden', ['scripts/imageherkomst.js', '--binden', '--image=' + img, '--digest=' + dg,
      '--bewijs=.release/image-release-bewijs.json', '--sbom=.release/' + sbom, '--uit=.release/' + uit],
    { ...bouwSleutel, ...CI });

  // "Controleer de eigen publicatie"
  const controle = (img, dg, sbom, herkomst, extra = {}) => run(root, ['scripts/imageherkomst.js', '--controle',
    '--eis-kandidaat', '--herkomst=.release/' + herkomst, '--sbom=.release/' + sbom, '--image=' + img,
    '--draait=' + (extra.draait || dg), '--commit=' + commit, '--bewijs-inhoud=' + inhoud]);
  for (const r of [controle(image, DIGEST, 'sbom.json', 'herkomst.json'),
    controle(backup, BACKUP_DIGEST, 'sbom-backup.json', 'herkomst-backup.json')])
    assert.equal(r.status, 0, 'controle faalde:\n' + r.stdout + r.stderr);

  // de handtekening hoort bij het BUILD-anker en bij niets anders
  const doc = JSON.parse(fs.readFileSync(path.join(root, '.release', 'herkomst.json'), 'utf8'));
  const zonder = { ...doc }; delete zonder.handtekening;
  const H = require(path.join(root, 'scripts', 'imageherkomst.js'));
  assert.equal(H.controleerHandtekening(zonder, doc.handtekening.waarde, pem(rollen.BUILD.publicKey, 'spki')), true);
  assert.equal(H.controleerHandtekening(zonder, doc.handtekening.waarde, pem(rollen.PROMOTION.publicKey, 'spki')), false,
    'een buildhandtekening klopt ook onder het promotieanker');

  // wat er draait is een ander image: dan is het niet deze kandidaat
  assert.notEqual(controle(image, DIGEST, 'sbom.json', 'herkomst.json', { draait: BACKUP_DIGEST }).status, 0,
    'een ander draaiend digest ging door de controle');
  // een byte in het herkomstdocument veranderen breekt de handtekening
  const gewijzigd = { ...doc, gemaakt: '2000-01-01T00:00:00.000Z' };
  fs.writeFileSync(path.join(root, '.release', 'herkomst.json'), JSON.stringify(gewijzigd, null, 2) + '\n');
  assert.notEqual(controle(image, DIGEST, 'sbom.json', 'herkomst.json').status, 0,
    'een gewijzigd herkomstdocument ging door de controle');
});

test('generale repetitie: de verkeerde rol, geen sleutel of een ontbrekend anker stopt de keten vóór de bouw', t => {
  const { root, rollen } = opstelling(t);
  const probeer = env => run(root, ['scripts/imageherkomst.js', '--sleutelcontrole'], env);

  const evidence = probeer({ RTG_RELEASE_SIGN_KEY: pem(rollen.EVIDENCE.privateKey, 'pkcs8') });
  assert.equal(evidence.status, 1);
  assert.match(evidence.stderr, /hoort niet bij het vaste vertrouwensanker voor BUILD/);
  assert.equal(probeer({ RTG_RELEASE_SIGN_KEY: pem(rollen.PROMOTION.privateKey, 'pkcs8') }).status, 1);
  const leeg = probeer({});
  assert.equal(leeg.status, 1);
  assert.match(leeg.stderr, /RTG_RELEASE_SIGN_KEY ontbreekt/);

  // een van de drie ankers weg: de bouwsleutel alleen is niet genoeg
  fs.unlinkSync(path.join(root, trust.ROLES.EVIDENCE.publicFile));
  const zonderAnker = probeer({ RTG_RELEASE_SIGN_KEY: pem(rollen.BUILD.privateKey, 'pkcs8') });
  assert.equal(zonderAnker.status, 1);
  assert.match(zonderAnker.stderr, /vertrouwensanker ontbreekt/);
});

/* De repetitie typt de stappen van de workflow na, en een naschrift loopt uit
   de pas zodra de workflow verandert. Daarom per stand dezelfde vlaggen: wat de
   workflow meegeeft, gaf de repetitie hierboven ook mee (vastgelegd in run()).
   De enige toegestane afwijking is --pakketten, de vervanging voor docker. */
test('generale repetitie: de vlaggen per stap zijn die van release-image.yml', () => {
  const wf = fs.readFileSync(path.join(BRON, '.github', 'workflows', 'release-image.yml'), 'utf8')
    .replace(/\\\n\s*/g, ' ');
  for (const stand of ['sleutelcontrole', 'sbom', 'binden', 'controle']) {
    const inWorkflow = new Set();
    for (const m of wf.matchAll(new RegExp('imageherkomst\\.js --' + stand + '[^\\n]*', 'g')))
      for (const v of m[0].matchAll(/--([a-z-]+)/g)) inWorkflow.add(v[1]);
    assert.ok(inWorkflow.size, 'de workflow heeft geen stap --' + stand + ' meer');
    const gebruikt = new Set(GEBRUIKT[stand] || []);
    gebruikt.delete('pakketten');
    assert.deepEqual([...gebruikt].sort(), [...inWorkflow].sort(),
      'de repetitie van --' + stand + ' loopt uit de pas met de workflow');
  }
});
