'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bewijs = require('../scripts/beproeving-ci-bewijs');

const COMMIT = 'a'.repeat(40);
const norm = {
  prestatieBron: '4k/17g/linux/sqlite', prestatieKalibratie: 13.3,
  prestatie: { p99Ms: 233, eventLoopP99Ms: 97.9 },
  notities: [
    { datum: '2026-08-27', soort: 'schuld', sleutel: 'p99Ms', van: 144, vervalt: '2026-09-30' },
    { datum: '2026-08-27', soort: 'schuld', sleutel: 'eventLoopP99Ms', van: 64.8, vervalt: '2026-09-30' }
  ]
};
function meting(extra = {}) {
  const basis = {
    gedraaid: '2026-10-01T10:01:00.000Z',
    stempel: { commit: COMMIT, boomVuil: false, instrument: 'scripts/beproeving.js', node: 'v26.1.0' },
    modus: 'sqlite', machine: { kernen: 4, geheugenGB: 17, platform: 'linux', node: 'v26.1.0', kalibratieBasisMs: 13.4 },
    oordeel: 'PASS', gezakteDrempels: 0, meters: { p99Ms: 140, eventLoopP99Ms: 64 }
  };
  return Object.assign(basis, extra);
}
const start = { schema: bewijs.SCHEMA, gestart: '2026-10-01T10:00:00.000Z', commit: COMMIT };

test('verlopen prestatieschuld gebruikt de oude lat en niet de verlaagde huidige norm', () => {
  const r = bewijs.doelenUitNorm(norm, '2026-10-01');
  assert.deepEqual(r.fouten, []);
  assert.equal(r.doelen.p99Ms.waarde, 144);
  assert.equal(r.doelen.eventLoopP99Ms.waarde, 64.8);
  assert.equal(r.doelen.p99Ms.bron, 'verlopen schuld');
});

test('een exacte, schone en vergelijkbare Node 26-meting kan de twee schulden bewijzen', () => {
  const r = bewijs.beoordeel({ meting: meting(), norm, start, verwachteCommit: COMMIT,
    verwachteNodeMajor: 26, vandaag: '2026-10-01' });
  assert.equal(r.ok, true, r.fouten.join('\n'));
  assert.equal(r.bron, norm.prestatieBron);
});

test('bron, kalibratie, commit, Node en tijd zijn ieder fail-closed', () => {
  const gevallen = [
    meting({ stempel: { commit: 'b'.repeat(40), boomVuil: false, instrument: 'scripts/beproeving.js', node: 'v26.1.0' } }),
    meting({ stempel: { commit: COMMIT, boomVuil: true, instrument: 'scripts/beproeving.js', node: 'v26.1.0' } }),
    meting({ stempel: { commit: COMMIT, boomVuil: false, instrument: 'scripts/anders.js', node: 'v26.1.0' } }),
    meting({ machine: { kernen: 8, geheugenGB: 17, platform: 'linux', node: 'v26.1.0', kalibratieBasisMs: 13.4 } }),
    meting({ machine: { kernen: 4, geheugenGB: 17, platform: 'linux', node: 'v26.1.0', kalibratieBasisMs: 30 } }),
    meting({ machine: { kernen: 4, geheugenGB: 17, platform: 'linux', node: 'v24.0.0', kalibratieBasisMs: 13.4 } }),
    meting({ gedraaid: '2026-10-01T09:59:59.000Z' })
  ];
  for (const invoer of gevallen) {
    const r = bewijs.beoordeel({ meting: invoer, norm, start, verwachteCommit: COMMIT,
      verwachteNodeMajor: 26, vandaag: '2026-10-01' });
    assert.equal(r.ok, false, 'een onvergelijkbare meting mag niet groen worden');
  }
});

test('een gewone PASS betaalt de schuld niet als de twee echte prestatielatten niet zijn gehaald', () => {
  const r = bewijs.beoordeel({ meting: meting({ meters: { p99Ms: 145, eventLoopP99Ms: 65 } }),
    norm, start, verwachteCommit: COMMIT, verwachteNodeMajor: 26, vandaag: '2026-10-01' });
  assert.equal(r.ok, false);
  assert.match(r.fouten.join('\n'), /p99Ms/);
  assert.match(r.fouten.join('\n'), /eventLoopP99Ms/);
});

test('de workflow publiceert uitsluitend het runartefact en bewaart meting plus log', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ronde.yml'), 'utf8');
  assert.match(yml, /workflow_dispatch:/);
  assert.match(yml, /default:\s*'beproeving'/,
    'een handmatige prestatiemeting hoort niet ook de drie andere urenlange jobs te starten');
  assert.match(yml, /inputs\.omvang == 'alles'/,
    'de volledige wekelijkse ronde moet handmatig nog steeds aanroepbaar blijven');
  assert.match(yml, /RTG_BEPROEVING_EXPECTED_COMMIT:\s*\$\{\{ github\.sha \}\}/);
  assert.match(yml, /node scripts\/beproeving-ci-bewijs\.js --voorbereiden/);
  assert.match(yml, /if:\s*always\(\)[\s\S]{0,240}node scripts\/beproeving-ci-bewijs\.js --controleer/);
  assert.match(yml, /beproeving\.log/);
  assert.match(yml, /\.release\/beproeving-ci-meting\.json/);
  assert.doesNotMatch(yml, /cat LAATSTE_METING\.json/,
    'een oude tracked meting mag nooit als actuele CI-meting in de samenvatting staan');
  assert.match(yml, /beproeving-ci-oordeel\.json/);
  assert.match(yml, /if-no-files-found:\s*error/);
  assert.match(yml, /node-version-file:\s*'\.nvmrc'/);
  assert.match(yml, /ref:\s*\$\{\{ github\.sha \}\}/);
  assert.equal(fs.readFileSync(path.join(__dirname, '..', '.nvmrc'), 'utf8').trim(), '26');
});

test('voorbereiden raakt tracked LAATSTE_METING niet en alleen een verse run wordt gepubliceerd', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'beproeving-ci-bewijs.js'), 'utf8');
  const voorbereiding = bron.slice(bron.indexOf('function voorbereiden'), bron.indexOf('function controleren'));
  assert.doesNotMatch(voorbereiding, /schrijf\(METING/,
    'de wachtstand mag tracked LAATSTE_METING niet self-invalidating wijzigen');
  assert.match(voorbereiding, /schrijf\(CI_METING/);
  assert.equal(bewijs.isVers(meting(), start, COMMIT), true);
  assert.equal(bewijs.isVers(meting({ gedraaid: '2026-10-01T09:59:00.000Z' }), start, COMMIT), false);
  assert.equal(bewijs.isVers(meting(), start, 'b'.repeat(40)), false);
});

test('de Beproeving gebruikt een exacte en geen verkorte Git-stempel', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'beproeving.js'), 'utf8');
  assert.match(bron, /stempel:\s*exactStempel\(\)/);
});

test('productiecode kopieert de twee schuldlatten niet als tweede handmatige waarheid', () => {
  const productie = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'beproeving-ci-bewijs.js'), 'utf8') +
    fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ronde.yml'), 'utf8');
  assert.doesNotMatch(productie, /\b144\b|64[,.]8/,
    'de waarden horen uitsluitend uit NORM.json/vervalcontract te komen');
});
