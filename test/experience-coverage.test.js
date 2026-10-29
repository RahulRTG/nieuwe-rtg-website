'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const coverage = require('../scripts/lib/experience/coverage');

const ROOT = path.join(__dirname,'..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT,'experience-architecture/coverage-contract.json')));
const signatures = JSON.parse(fs.readFileSync(path.join(ROOT,'experience-architecture/signatures.json')));

test('EXPERIENCEWERKT.json is exact uit de actuele inventaris afgeleid', () => {
  const stored = fs.readFileSync(path.join(ROOT,'EXPERIENCEWERKT.json'),'utf8');
  const report = coverage.build(ROOT,{contract,signatures});
  assert.equal(stored,coverage.serializeRegistry(report));
});

test('register is volledig afgeleid uit alle logische apps en alle fysieke schermen', () => {
  const apps = coverage.appInventory(ROOT);
  const screens = coverage.screenInventory(ROOT);
  const report = coverage.build(ROOT,{contract,signatures,apps,screens,sourceHash:'source',commit:'candidate'});
  assert.ok(apps.length>=contract.inventoryBaselines.logicalApps);
  assert.ok(screens.length>=contract.inventoryBaselines.screens);
  assert.equal(report.logicalApps.length,apps.length);
  assert.equal(report.screens.length,screens.length);
  assert.equal(new Set(report.logicalApps.map(row=>row.id)).size,apps.length);
  assert.equal(new Set(report.screens.map(row=>row.route)).size,screens.length);
  assert.equal(report.logicalApps.every(row=>row.screenIds.length > 0),true);
  assert.equal(report.logicalApps.every(row=>row.interactionInventory && Number.isInteger(row.interactionInventory.found)),true);
  assert.equal(report.screens.every(row=>row.owner && row.owner.rol && (row.owner.capability || (row.owner.rol==='alias' && row.owner.naar))),true);
  const stored = coverage.registryView(report);
  assert.equal(Object.keys(stored.logicalApps[0].dimensions).length,contract.dimensions.length);
  assert.equal(stored.logicalApps[0].dimensions.identity.status,'NOT_TESTED');
  assert.equal(JSON.parse(coverage.serializeRegistry(report)).screens.length,screens.length);
});

test('een nieuw scherm vergroot automatisch de noemer en blijft zonder signature rood', () => {
  const apps = [{id:'app:test',function:'link:test',name:'Test',world:'LivingOS',persona:'lid',destination:'/apps/test.html',entry:'/apps/test.html'}];
  const screens = [{id:'screen:/apps/test.html',route:'/apps/test.html',world:'living',profile:'interface'}];
  const first = coverage.build(ROOT,{contract,signatures:{version:1,apps:{},screens:{}},apps,screens,sourceHash:'source',commit:'candidate'});
  screens.push({id:'screen:/apps/new.html',route:'/apps/new.html',world:'living',profile:'interface'});
  const second = coverage.build(ROOT,{contract,signatures:{version:1,apps:{},screens:{}},apps,screens,sourceHash:'source',commit:'candidate'});
  assert.equal(second.summary.screens.total,first.summary.screens.total+1);
  assert.equal(second.screens.at(-1).signature.status,'NOT_TESTED');
  assert.equal(second.status,'NOT_TESTED');
});

test('niet-toepasselijk vereist een expliciet besluit en een reden', () => {
  const broken = structuredClone(contract);
  broken.profiles.redirect.notApplicable.composition = {decision:'',reason:''};
  const report = coverage.build(ROOT,{contract:broken,signatures,apps:[],screens:[{id:'screen:/apps/r.html',route:'/apps/r.html',world:'redirect',profile:'redirect'}],sourceHash:'source',commit:'candidate'});
  assert.equal(coverage.validate(ROOT,report,broken,signatures).some(e=>e.includes('UNJUSTIFIED_NOT_APPLICABLE')),true);
});

test('bewijs met andere bron of kandidaat is STALE', () => {
  const record = {status:'PROVEN',sourceHash:'old',commit:'candidate',configurationHash:'cfg',artifact:'proof',method:'browser'};
  assert.equal(coverage.evidenceStatus(record,'new','candidate','identity'),'STALE');
  assert.equal(coverage.evidenceStatus({...record,sourceHash:'new',commit:'other'},'new','candidate','identity'),'STALE');
});

test('AI-oordeel kan menselijke kwaliteit niet bewijzen', () => {
  const base = {status:'PROVEN',sourceHash:'source',commit:'candidate',configurationHash:'cfg',artifact:'proof'};
  assert.equal(coverage.evidenceStatus({...base,method:'ai-review',reviewer:{type:'ai',id:'model'}},'source','candidate','human-quality'),'BLOCKED');
  assert.equal(coverage.evidenceStatus({...base,method:'human-user-test',reviewer:{type:'human',id:'reviewer-1'}},'source','candidate','human-quality'),'PROVEN');
});

test('alle vereiste combinaties moeten afzonderlijk bewezen zijn', () => {
  const app = {id:'app:test',function:'link:test',name:'Test',world:'LivingOS',persona:'lid',destination:'/apps/test.html',entry:'/apps/test.html'};
  const screen = {id:'screen:/apps/test.html',route:'/apps/test.html',world:'living',profile:'interface'};
  const declared = {identity:'test',purpose:'testdoel',composition:'rustige taakcompositie',motion:'continu',interactionDensity:'quiet',interactions:[{id:'save',label:'Opslaan'}],humanTasks:['Rond de testtaak af']};
  const sig = {version:1,apps:{'app:test':declared},screens:{'/apps/test.html':declared}};
  const empty = coverage.build(ROOT,{contract,signatures:sig,apps:[app],screens:[screen],sourceHash:'source',commit:'candidate'});
  assert.equal(empty.status,'NOT_TESTED');
  const records=[];
  for (const subject of empty.logicalApps.concat(empty.screens)) for (const dimension of subject.dimensions.filter(d=>d.applicable)) for (const requirement of coverage.requirements(contract,subject.profile || 'interface',dimension.id,subject.signature)) {
    records.push({subjectType:subject.id.startsWith('app:')?'app':'screen',subjectId:subject.id,dimension:dimension.id,requirement,status:'PROVEN',sourceHash:'source',commit:'candidate',configurationHash:'cfg',artifact:'proof/'+subject.id+'/'+dimension.id+'/'+requirement,method:dimension.id==='human-quality'?'human-user-test':'browser',...(dimension.id==='human-quality'?{reviewer:{type:'human',id:'reviewer-1'}}:{})});
  }
  const proven = coverage.build(ROOT,{contract,signatures:sig,evidence:{version:1,records},apps:[app],screens:[screen],sourceHash:'source',commit:'candidate'});
  assert.equal(proven.status,'PROVEN');
  records.pop();
  const incomplete = coverage.build(ROOT,{contract,signatures:sig,evidence:{version:1,records},apps:[app],screens:[screen],sourceHash:'source',commit:'candidate'});
  assert.equal(incomplete.status,'NOT_TESTED');
});

test('een signature kan de centrale toestanden- en apparatennoemer niet verkleinen', () => {
  const fake = {status:'DECLARED',value:{additionalStates:[],additionalDevices:[],states:['normal'],devices:['desktop']}};
  assert.equal(coverage.requirements(contract,'interface','composition',fake).length,contract.states.length*contract.devices.length);
  assert.equal(coverage.requirements(contract,'interface','adaptability',fake).length,contract.devices.length*contract.networks.length);
});

test('een app-signature mag door APPWERKT gevonden bediening niet verbergen', () => {
  const app = {id:'app:test',function:'link:test',name:'Test',world:'LivingOS',persona:'lid',destination:'/apps/test.html',entry:'/apps/test.html',interactionInventory:{source:'APPWERKT.json',found:1,touched:['Opslaan'],untouched:[]}};
  const screen = {id:'screen:/apps/test.html',route:'/apps/test.html',world:'living',profile:'interface'};
  const bad = {identity:'test',purpose:'testdoel',composition:'rustig',motion:'continu',interactionDensity:'quiet',interactions:[{id:'save',label:'Bewaren'}],humanTasks:['Rond de taak af']};
  const report = coverage.build(ROOT,{contract,signatures:{version:1,apps:{'app:test':bad},screens:{}},apps:[app],screens:[screen],sourceHash:'source',commit:'candidate'});
  assert.equal(report.logicalApps[0].signature.status,'BLOCKED');
  assert.match(report.logicalApps[0].signature.reason,/APPWERKT-interacties/);
});
