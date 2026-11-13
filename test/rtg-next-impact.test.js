'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {afbouwImpact, raakt, alleToetsen} = require('../scripts/veranderbereik');
const {fingerprint} = require('../scripts/lib/experience/evidence');
const ROOT = path.join(__dirname, '..');

function fixture() {
  const delivery = {workPackages:['P0','P1','P3','P4','P6','P7'],workFunctions:['link:ov'],
    sceneFamily:'Journey',riskClass:'critical',scenarioFamilies:['transaction'],rationale:'Bestaande ritketen.'};
  const owners = {capabilities:{'vervoer.rit':'apps/ov.html','docs.lezen':'apps/read.html'},schermen:{
    'apps/ov.html':{capability:'vervoer.rit',rol:'eigenaar',afbouw:structuredClone(delivery)},
    'apps/rit.html':{capability:'vervoer.rit',rol:'tweede-ingang',afbouw:structuredClone(delivery)},
    'apps/old.html':{rol:'alias',naar:'/apps/ov.html#rit',afbouw:{...structuredClone(delivery),scenarioFamilies:['redirect']}},
    'apps/read.html':{capability:'docs.lezen',rol:'eigenaar',afbouw:{...structuredClone(delivery),workFunctions:[],scenarioFamilies:['content']}}
  }};
  const scenario = id => ({id,evidenceRequirements:['runtime']});
  const contract = {devices:['desktop'],profiles:{interface:{dimensions:['continuity']},redirect:{dimensions:['continuity']}},
    qualificationPlanning:{premiumCriteria:[{id:'continuity',dimensions:['continuity'],evidenceRequirements:['runtime']}],
      scenarioFamilies:{transaction:[scenario('pay-retry')],redirect:[scenario('safe-redirect')],content:[scenario('restore-content')]},
      budgetMatrix:[{id:'critical:desktop'}]}};
  return {owners,contract,routes:Object.keys(owners.schermen)};
}

test('afbouwimpact volgt bestaande eigenaar, tweede ingang en alias zonder scope te versmallen', () => {
  const input = fixture(), before = structuredClone(input);
  const impact = afbouwImpact('public/apps/ov.html', new Set(), input);
  assert.deepEqual(impact.directScreens, ['/apps/old.html','/apps/ov.html','/apps/rit.html']);
  assert.equal(impact.possibleScreens.length, 4);
  assert.equal(impact.fullRingRequired, true);
  assert.equal(impact.scope, 'conservative-all');
  assert.equal(impact.status, 'PLANNING_IMPACT');
  assert.ok(impact.scenarios.includes('pay-retry'));
  assert.ok(impact.scenarios.includes('safe-redirect'));
  assert.deepEqual(input, before, 'de projectie muteert geen register of contract');
});

test('onbekende backend, gedeelde bron en dynamische impact houden alle schermen in scope', () => {
  for (const source of ['server/kern/pay/poort.js','public/shared/unknown.js','unknown-generated-target.js']) {
    const impact = afbouwImpact(source, new Set(), fixture());
    assert.deepEqual(impact.directScreens, []);
    assert.equal(impact.possibleScreens.length, 4);
    assert.ok(impact.uncertainties.includes('NO_DIRECT_SCREEN_MAPPING'));
    assert.ok(impact.uncertainties.includes('DYNAMIC_SCREEN_DEPENDENCIES_NOT_PROVEN'));
    assert.equal(impact.fullRingRequired, true);
  }
});

test('omgekeerde sluiting kan directe schermen toevoegen maar geen conservatieve scope wegnemen', () => {
  const impact = afbouwImpact('public/apps/ov/runtime.js', new Set(['public/apps/ov.html']), fixture());
  assert.ok(impact.directScreens.includes('/apps/rit.html'));
  assert.equal(impact.possibleScreens.length, 4);
  assert.equal(impact.screens.find(s => s.route === '/apps/read.html').relation, 'conservative');
});

test('ontbrekende afbouwmetadata blijft in de noemer en wordt nooit een groene status', () => {
  const input = fixture(); delete input.owners.schermen['apps/ov.html'].afbouw;
  const impact = afbouwImpact('public/apps/ov.html', new Set(), input);
  assert.equal(impact.status, 'INCOMPLETE_PLANNING_IMPACT');
  assert.ok(impact.errors.includes('DELIVERY_MISSING:apps/ov.html'));
  assert.ok(impact.errors.includes('REQUIREMENTS_NOT_DEFINED:apps/ov.html'));
  assert.equal(impact.possibleScreens.length, 4);
  assert.ok(impact.screens.every(s => s.qualification === 'NOT_TESTED'));
});

test('verweesde eigenaar, aliascyclus en ontbrekend eisencontract blijven expliciete fouten', () => {
  const input = fixture();
  delete input.owners.capabilities['docs.lezen'];
  input.owners.schermen['apps/old.html'].naar = '/apps/old.html';
  delete input.contract.qualificationPlanning;
  const impact = afbouwImpact('unknown.js', new Set(), input);
  assert.ok(impact.errors.includes('CANONICAL_OWNER_MISMATCH:apps/read.html'));
  assert.ok(impact.errors.includes('ALIAS_CYCLE:apps/old.html'));
  assert.equal(impact.possibleScreens.length, 4);
  assert.equal(impact.status, 'INCOMPLETE_PLANNING_IMPACT');
});

test('lege taaktoewijzing of ongeldige risicoklasse maakt de projectie onvolledig', () => {
  const input = fixture();
  input.owners.schermen['apps/ov.html'].afbouw.workPackages = [];
  input.owners.schermen['apps/read.html'].afbouw.riskClass = 'safe-because-tested';
  const impact = afbouwImpact('unknown.js', new Set(), input);
  assert.ok(impact.errors.includes('DELIVERY_INVALID:apps/ov.html'));
  assert.ok(impact.errors.includes('DELIVERY_INVALID:apps/read.html'));
  assert.equal(impact.status, 'INCOMPLETE_PLANNING_IMPACT');
  assert.equal(impact.possibleScreens.length, 4);
});

test('gewijzigde werkpakket-, risico- en scenario-eisen komen uit actuele owner.afbouw', () => {
  const input = fixture(), record = input.owners.schermen['apps/ov.html'];
  record.afbouw.workPackages.push('P2');
  record.afbouw.riskClass = 'sensitive';
  record.afbouw.scenarioFamilies = ['content'];
  record.afbouw.qualification = 'PROVEN';
  const impact = afbouwImpact('public/apps/ov.html', new Set(), input);
  const screen = impact.screens.find(s => s.route === '/apps/ov.html');
  assert.ok(screen.workPackages.includes('P2'));
  assert.equal(screen.riskClass, 'sensitive');
  assert.deepEqual(screen.scenarios, ['restore-content']);
  assert.equal(screen.qualification, 'NOT_TESTED', 'een aangeleverde kwaliteitsclaim wordt niet overgenomen');
});

test('raakt behoudt zijn bestaande testbereik en volle ring naast de nieuwe projectie', () => {
  const toets = alleToetsen()[0], source = 'public/apps/ov.html';
  const u = {_intern:{omgekeerd:new Map([[source,new Set(['test/'+toets])]]),
    kaart:new Map(),perToets:new Map(),statisch:new Set([toets])}};
  const result = raakt(u, source);
  assert.deepEqual(result.langsStatisch, [toets]);
  assert.deepEqual(result.langsWaarneming, []);
  assert.deepEqual(result.samen, [toets]);
  assert.equal(result.volleRing, alleToetsen().length - 1);
  const inventory = require('../scripts/lib/experience/subjects').screenInventory(ROOT);
  assert.equal(result.afbouw.possibleScreens.length, inventory.length);
  assert.ok(result.afbouw.directScreens.includes('/apps/ov.html'));
  assert.ok(result.afbouw.directScreens.includes('/apps/rit.html'));
  assert.equal(result.afbouw.qualification, 'NOT_TESTED');
});

test('--raakt --json geeft het bestaande impactresultaat met eerlijke afbouwprojectie terug', () => {
  const run = spawnSync(process.execPath, ['scripts/veranderbereik.js','--raakt','public/apps/ov.html','--json'],
    {cwd:ROOT,encoding:'utf8',maxBuffer:16*1024*1024,timeout:60000});
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.equal(output.bestand, 'public/apps/ov.html');
  assert.equal(typeof output.volleRing, 'number');
  assert.equal(output.afbouw.fullRingRequired, true);
  assert.equal(output.afbouw.qualification, 'NOT_TESTED');
});

test('de drie planningbronnen zijn invoer van de bestaande Experience-vingerafdruk', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-next-impact-'));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  fs.mkdirSync(path.join(root, 'docs/rtg-next'), {recursive:true});
  for (const file of ['programma.json','living-werkpakketten.json','overige-werkpakketten.json']) {
    const previous = fingerprint(root);
    fs.writeFileSync(path.join(root,'docs/rtg-next',file), '{}\n');
    assert.notEqual(fingerprint(root), previous, file + ' invalideert eerder bewijs');
  }
  const previous = fingerprint(root);
  fs.writeFileSync(path.join(root,'docs/rtg-next/werkboek.md'), 'Gegenereerde uitleg\n');
  assert.equal(fingerprint(root), previous, 'de gegenereerde projectie is geen tweede bewijsbron');
});
