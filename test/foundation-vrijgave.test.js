'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('node:child_process');
const vrijgave = require('../server/config/foundation-vrijgave');
const extern = require('../server/config/external-release');
const { COMMIT, groenDossier, maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');

test('alleen een ondertekend dossier met de werkelijk gemounte bewijsbytes geldt', t => {
  const maakRoot = naam => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-extern-' + naam + '-'));
    t.after(() => fs.rmSync(root, { recursive:true, force:true }));
    return root;
  };
  const goed = maakRoot('goed'); maakGetekendeVrijgave(goed);
  assert.equal(extern.controleerReleaseRoot(goed, COMMIT).ok, true);

  const verzonnen = maakRoot('verzonnen');
  fs.mkdirSync(path.join(verzonnen, '.release'), { recursive:true });
  fs.writeFileSync(path.join(verzonnen, '.release', 'external-release.json'), JSON.stringify(groenDossier()));
  assert.equal(extern.controleerReleaseRoot(verzonnen, COMMIT).ok, false,
    'zelfverklaarde PASS zonder signer en bestanden mag niets openen');

  const mist = maakRoot('mist'); maakGetekendeVrijgave(mist);
  fs.unlinkSync(path.join(mist, '.release', 'external-evidence', 'dpia.bewijs'));
  assert.equal(extern.controleerReleaseRoot(mist, COMMIT).ok, false);

  const providerMist = maakRoot('provider-mist'); maakGetekendeVrijgave(providerMist);
  fs.unlinkSync(path.join(providerMist, '.release', 'external-evidence', 'payment-provider.bewijs'));
  assert.equal(extern.controleerReleaseRoot(providerMist, COMMIT).ok, false,
    'een providerkey of zelfverklaarde PASS vervangt geen werkelijk providerbewijs');

  const geknoeid = maakRoot('geknoeid'); maakGetekendeVrijgave(geknoeid);
  fs.appendFileSync(path.join(geknoeid, '.release', 'external-evidence', 'juridisch.bewijs'), 'gewijzigd');
  assert.match(extern.controleerReleaseRoot(geknoeid, COMMIT).reden, /bewijsbytes-wijken-af/);

  const verkeerd = maakRoot('verkeerd');
  const vast = crypto.generateKeyPairSync('ed25519');
  const ander = crypto.generateKeyPairSync('ed25519');
  maakGetekendeVrijgave(verkeerd, { sleutels:vast, tekenSleutel:ander.privateKey });
  assert.equal(extern.controleerReleaseRoot(verkeerd, COMMIT).reden, 'handtekening-klopt-niet');

  const link = maakRoot('link'); maakGetekendeVrijgave(link);
  const doel = path.join(link, '.release', 'external-evidence', 'echt-providerbewijs');
  const gekoppeld = path.join(link, '.release', 'external-evidence', 'payout-provider.bewijs');
  fs.renameSync(gekoppeld, doel);
  fs.symlinkSync(doel, gekoppeld);
  assert.equal(extern.controleerReleaseRoot(link, COMMIT).ok, false,
    'een symlink kan gemounte bewijsbytes niet omleiden');
});

test('algemene release accepteert bewezen gesloten Foundation maar runtime-open niet', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-gesloten-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  maakGetekendeVrijgave(root, { wijzigDossier:d => {
    d.controles.foundationMinderjarigen.vrijgave = 'GESLOTEN';
    d.controles.foundationMinderjarigen.leeftijdscontrole = 'NIET_VRIJGEGEVEN';
    d.controles.foundationMinderjarigen.moderatie = 'NIET_VRIJGEGEVEN';
  } });
  const algemeen = extern.controleerReleaseRoot(root, COMMIT);
  assert.equal(algemeen.ok, true);
  assert.equal(algemeen.foundation.vrijgave, 'GESLOTEN');
  const paden = extern.padenVoorDossier(path.join(root, '.release', 'external-release.json'), root);
  const openen = extern.controleerBestanden({ ...paden, releaseCommit:COMMIT,
    vereisteControles:extern.FOUNDATION_CONTROLES, eisFoundationOpen:true });
  assert.equal(openen.ok, false);
  assert.equal(openen.reden, 'foundationvoorwaarden-niet-pass');
});

test('Foundationvoorwaarden blijven onderdeel van de ondertekende inhoud', t => {
  for (const [naam, verander] of [
    ['leeftijd', d => { d.controles.foundationMinderjarigen.leeftijdscontrole = 'OPEN'; }],
    ['moderatie', d => { d.controles.foundationMinderjarigen.moderatie = 'OPEN'; }],
    ['besluit', d => { d.controles.foundationMinderjarigen.vrijgave = 'GESLOTEN'; }]
  ]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-' + naam + '-'));
    t.after(() => fs.rmSync(root, { recursive:true, force:true }));
    maakGetekendeVrijgave(root, { wijzigDossier:verander });
    assert.equal(vrijgave.beoordeel({ env:{ [vrijgave.ENV_NAAM]:'1' }, root }).vrijgegeven, false);
  }
});

test('schijfcontrole leest alleen vaste bewijsplaatsen en eist een schone releasecommit', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-vrijgave-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  maakGetekendeVrijgave(root);
  const env = { [vrijgave.ENV_NAAM]:'1', RTF_FOUNDATION_RELEASE_FILE:'/tmp/negeren.json' };
  assert.equal(vrijgave.beoordeel({ env, root }).vrijgegeven, true);
  const release = JSON.parse(fs.readFileSync(path.join(root, 'release-bewijs.json')));
  release.bron.gewijzigd = true;
  fs.writeFileSync(path.join(root, 'release-bewijs.json'), JSON.stringify(release));
  assert.equal(vrijgave.beoordeel({ env, root }).vrijgegeven, false);
});

test('een hostmanifest voor commit A kan gewijzigde runtime B niet vrijgeven', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-runtime-wissel-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  maakGetekendeVrijgave(root, { commit:COMMIT });
  const echtA = fs.readFileSync(path.join(root, 'release-bewijs.json'));
  fs.writeFileSync(path.join(root, 'public', 'dist', 'app.js'), 'onbewezen runtime B\n');
  fs.writeFileSync(path.join(root, '.release', 'release-bewijs.json'), echtA);
  const oordeel = vrijgave.beoordeel({ env:{ [vrijgave.ENV_NAAM]:'1' }, root });
  assert.equal(oordeel.vrijgegeven, false);
  assert.equal(oordeel.reden, 'runtimebewijs-ongeldig');
});

test('golive bewaart geldpoorten en blokkeert een onbewezen Foundation-vlag', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'golive.js'), 'utf8');
  const compose = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
  assert.match(bron, /foundationVrijgave\.beoordeel\(\{ env \}\)/);
  assert.match(bron, /Foundation-vrijgave geweigerd/);
  assert.match(compose, /\.\/\.release:\/run\/rtg-release:ro/);
  const paden = vrijgave.dossierPaden(path.join(__dirname, '..'));
  assert.deepEqual(paden, ['/run/rtg-release/external-release.json',
    path.join(__dirname, '..', '.release', 'external-release.json')]);
  assert.equal(paden.some(pad => pad.includes('/run/secrets/')), false);
  assert.deepEqual(vrijgave.releaseBewijsPaden(path.join(__dirname, '..')),
    [path.join(__dirname, '..', 'release-bewijs.json')]);
  for (const tekst of ['inkomende betaalrail', 'productie-uitbetaalrail', 'Foundation-settlement'])
    assert.match(bron, new RegExp(tekst));
});

test('live golive bewaart alleen gevalideerd containerbewijs host-side', () => {
  const live = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'docker', 'live.sh'), 'utf8');
  const blok = live.slice(live.indexOf('  golive)'), live.indexOf('  probe)'));
  assert.match(blok, /RTG_GOLIVE_BEWIJS_JSON=/);
  assert.match(blok, /rtg-golive-bewijs-v1/);
  assert.match(blok, /mv "\$bewijs_tmp" "\$bewijs_doel"/);
  assert.doesNotMatch(blok, /exec -T app node scripts\/golive\.js/);
});

test('de signer tekent alleen een compleet dossier op een schone exacte HEAD', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-extern-signer-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  const sleutels = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.join(root, 'deploy'), { recursive:true });
  fs.writeFileSync(path.join(root, '.gitignore'), '.release/\n');
  fs.writeFileSync(path.join(root, 'deploy', 'release-sleutel.pub'),
    sleutels.publicKey.export({ type:'spki', format:'pem' }));
  const git = (...args) => spawnSync('git', args, { cwd:root, encoding:'utf8' });
  assert.equal(git('init', '--quiet').status, 0);
  assert.equal(git('config', 'user.email', 'release@test.invalid').status, 0);
  assert.equal(git('config', 'user.name', 'Release Test').status, 0);
  assert.equal(git('add', '.gitignore', 'deploy/release-sleutel.pub').status, 0);
  assert.equal(git('commit', '--quiet', '-m', 'vertrouwensanker').status, 0);
  const commit = git('rev-parse', 'HEAD').stdout.trim();
  maakGetekendeVrijgave(root, { commit, sleutels, runtimeBewijs:false });
  fs.unlinkSync(path.join(root, '.release', 'external-release.sig'));
  const prive = sleutels.privateKey.export({ type:'pkcs8', format:'pem' }).toString('base64');
  const resultaat = require('../scripts/external-release-teken').teken(root,
    { RTG_RELEASE_SIGN_KEY:prive });
  assert.equal(resultaat.ok, true);

  fs.appendFileSync(path.join(root, 'deploy', 'release-sleutel.pub'), '\n');
  assert.throws(() => require('../scripts/external-release-teken').teken(root,
    { RTG_RELEASE_SIGN_KEY:prive }), /productiebron bevat wijzigingen/);
});
