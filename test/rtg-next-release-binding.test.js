'use strict';
/* Alleen read-only protocoltoetsen: scripts draaien in een afgesloten VM met
   proces-/schrijfstubs. Geen releaseworkflow, Docker, launchctl of netwerk. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const silent = {log() {}, error() {}};
const commit = 'a'.repeat(40);

function releaseFixture(productie, stopAt) {
  const calls = [], writes = [], exit = {code:null};
  const fakeProcess = {execPath:process.execPath, argv:['node', 'scripts/release-gate.js', ...(productie ? ['--productie'] : [])],
    env:{}, pid:1, exit(code) { exit.code = code; throw Error('STOPPED_BY_GATE'); }};
  const imports = {
    child_process:{spawnSync(command, args) {
      calls.push({command, args});
      return {status:args.join(' ') === stopAt ? 71 : 0};
    }},
    fs:{rmSync() {}, mkdirSync() {}, writeFileSync(...args) { writes.push(args); }, renameSync() {}},
    path,
    './afbouw-slot':{pak:() => () => {}, kindOmgeving:env => env},
    './lib/afbouw-afloop':{magStarten:() => ({mag:true}), lees:() => ({runId:'unit-only'})},
    './lib/stempel':{exactStempel:() => ({commit, boomVuil:false})}
  };
  try {
    vm.runInNewContext(source('scripts/release-gate.js'), {
      require(name) { if (!(name in imports)) throw Error('Onverwachte afhankelijkheid: ' + name); return imports[name]; },
      __dirname:path.join(ROOT, 'scripts'), process:fakeProcess, console:silent
    });
  } catch (error) { if (error.message !== 'STOPPED_BY_GATE') throw error; }
  return {calls:calls.map(call => call.args.join(' ')), writes, exitCode:exit.code};
}

test('gewone releasepoort voert planningcheck uit maar vraagt geen productiegate', () => {
  const run = releaseFixture(false);
  assert.ok(run.calls.includes('scripts/rtg-next-programma.js --check'));
  assert.equal(run.calls.some(call => /--gate=/.test(call)), false);
  assert.equal(run.exitCode, null);
  const report = JSON.parse(run.writes[0][1]);
  assert.ok(report.controles.some(row => row.naam === 'RTG NEXT-planning' && row.geslaagd === true));
  assert.equal(report.productie, false);
});

test('ongeldige planning stopt release vóór inhoudsbewijs en vóór groen releasepoortbewijs', () => {
  const run = releaseFixture(false, 'scripts/rtg-next-programma.js --check');
  assert.equal(run.exitCode, 71);
  assert.equal(run.calls.includes('scripts/release-bewijs.js'), false);
  assert.equal(run.writes.length, 0);
});

test('productierelease vraagt G3 vóór nieuwe bewijsaanmaak en nooit G4 in zichzelf', () => {
  const run = releaseFixture(true);
  const qualification = run.calls.indexOf('scripts/rtg-next-programma.js --gate=G3');
  assert.ok(qualification > run.calls.indexOf('scripts/rtg-next-programma.js --check'));
  assert.ok(qualification < run.calls.indexOf('scripts/release-bewijs.js'));
  assert.equal(run.calls.some(call => call.includes('--gate=G4')), false);
  const report = JSON.parse(run.writes[0][1]);
  assert.equal(report.productie, true);
  assert.ok(report.controles.some(row => row.naam === 'RTG NEXT-onafhankelijke kwalificatie' && row.geslaagd === true));
});

test('rode onafhankelijke kwalificatie voorkomt nieuw releasebewijs en groene afsluiting', () => {
  const run = releaseFixture(true, 'scripts/rtg-next-programma.js --gate=G3');
  assert.equal(run.exitCode, 71);
  assert.equal(run.calls.includes('scripts/release-bewijs.js'), false);
  assert.equal(run.writes.length, 0);
});

function liveFixture(result) {
  const events = [], output = [], errors = [];
  const candidate = {image:{immutable:'image@sha256:one', id:'one', digest:'digest-one', bewijsBestandSha256:'proof'},
    backup:{immutable:'backup@sha256:two', id:'two', digest:'digest-two'}};
  const processStub = {env:{}, stdout:{write(value) { output.push(value); }}, exitCode:0};
  const imports = {
    path,
    './lib/productie-vrijgave':{eisSchoneReleasebron:() => commit, leesProductiestatus() { events.push('status'); }},
    './lib/experience/qualification-gates':{assess(root, options) {
      assert.equal(root, ROOT); assert.deepEqual({...options}, {gate:'G4'}); events.push('G4'); return result;
    }},
    './lib/productie-promotie':{controleer() { events.push('promotion'); return {kandidaat:candidate}; }, eisKetenbesluit() { events.push('decision'); }},
    './lib/live-kandidaat':{controleer() { events.push('candidate'); return candidate; }}
  };
  vm.runInNewContext(source('scripts/live-vrijgave.js'), {
    require(name) { if (!(name in imports)) throw Error('Onverwachte afhankelijkheid: ' + name); return imports[name]; },
    __dirname:path.join(ROOT, 'scripts'), process:processStub, console:{error(value) { errors.push(value); }}
  });
  return {events, output, errors, exitCode:processStub.exitCode};
}

test('OCI-vrijgave geeft bij rode G4 geen imagegegevens aan daadwerkelijke deploy', () => {
  const run = liveFixture({status:'BLOCKED', candidateCommit:commit, blockers:['human-quality']});
  assert.equal(run.exitCode, 1);
  assert.deepEqual(run.events, ['status','G4']);
  assert.equal(run.output.length, 0);
  assert.match(run.errors[0], /RTG NEXT G4 blokkeert activatie/);
});

test('OCI-vrijgave bindt G4 exact aan dezelfde commit en behoudt bestaande promotiecontrole', () => {
  assert.equal(liveFixture({status:'PROVEN', candidateCommit:'b'.repeat(40), blockers:[]}).exitCode, 1);
  const run = liveFixture({status:'PROVEN', candidateCommit:commit, blockers:[]});
  assert.equal(run.exitCode, 0);
  assert.deepEqual(run.events, ['status','G4','promotion','candidate','decision']);
  assert.equal(run.output[0].split('\n')[0], commit);
});

function nativeFixture(result) {
  const events = [], module = {exports:{}};
  const fail = () => { throw Error('ONVERWACHT_EFFECT'); };
  const imports = {
    'node:fs':{mkdirSync:fail, writeFileSync:fail}, 'node:path':path,
    'node:child_process':{execFileSync:fail}, 'node:timers/promises':{setTimeout:fail},
    './lib/native-artifact':{},
    './lib/native-host':{authorized() { events.push('authorized'); throw Error('AUTHORIZED_BOUNDARY_REACHED'); }},
    './lib/experience/qualification-gates':{assess(root, options) {
      assert.equal(root, ROOT); assert.deepEqual({...options}, {gate:'G4'}); events.push('G4'); return result;
    }}
  };
  const requireStub = name => { if (!(name in imports)) throw Error('Onverwachte afhankelijkheid: ' + name); return imports[name]; };
  requireStub.main = null;
  vm.runInNewContext(source('scripts/native-activate.js'), {
    require:requireStub, module, process:{platform:'darwin', arch:'arm64'}, console:silent
  });
  return {events, activate:() => module.exports.activate(ROOT, commit)};
}

test('native G4 stopt vóór lock, staging, pointerwijziging en servicestart', async () => {
  const run = nativeFixture({status:'BLOCKED', candidateCommit:commit, blockers:['human-quality']});
  await assert.rejects(run.activate(), /RTG NEXT G4 blokkeert native activatie/);
  assert.deepEqual(run.events, ['G4']);
});

test('native G4 bindt kandidaat exact en behoudt oorspronkelijke authorisatiegrens', async () => {
  const wrong = nativeFixture({status:'PROVEN', candidateCommit:'b'.repeat(40), blockers:[]});
  await assert.rejects(wrong.activate(), /RTG NEXT G4 blokkeert native activatie/);
  assert.deepEqual(wrong.events, ['G4']);
  const good = nativeFixture({status:'PROVEN', candidateCommit:commit, blockers:[]});
  await assert.rejects(good.activate(), /AUTHORIZED_BOUNDARY_REACHED/);
  assert.deepEqual(good.events, ['G4','authorized']);
});

test('OCI gebruikt de versterkte vrijgave tweemaal vóór de echte wissel; rollback blijft eigen pad', () => {
  const live = source('scripts/docker/live.sh');
  const deploy = live.slice(live.indexOf('  deploy)'), live.indexOf('  status)'));
  const first = deploy.indexOf('node scripts/live-vrijgave.js');
  const second = deploy.indexOf('node scripts/live-vrijgave.js', first + 1);
  assert.ok(first > 0 && second > first);
  assert.ok(second < deploy.indexOf('compose up -d --no-build'));
  const rollback = live.slice(live.indexOf('  rollback)'), live.indexOf('  restore)'));
  assert.doesNotMatch(rollback, /qualification-gates|--gate=G4|live-vrijgave/);
  assert.match(rollback, /eis-rollback/);
  assert.match(source('scripts/native-activate.js'), /host\.select\(root, commit, 'rollback'\)/);
});
