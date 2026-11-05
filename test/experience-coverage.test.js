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
  assert.equal(report.releaseReadiness.qualificationGates.length,8);
  assert.equal(report.releaseReadiness.status,'NOT_TESTED');
  assert.equal(report.status,'NOT_TESTED','schermbewijs alleen mag de operationele vrijgavepoorten niet omzeilen');
});

test('de acht Deep Green-vrijgavepoorten en Experience-budgetten zijn fail-closed', () => {
  const report = coverage.build(ROOT,{contract,signatures,apps:[],screens:[],sourceHash:'source',commit:'candidate'});
  assert.deepEqual(report.releaseReadiness.qualificationGates.map(gate=>gate.id),[
    'evidence-dependency-integrity','negative-contracts','data-migration-compatibility','concurrency-load',
    'external-dependencies','experience-budgets','operational-incident','independent-reproducibility'
  ]);
  assert.equal(report.releaseReadiness.qualificationGates.every(gate=>gate.status==='NOT_TESTED'),true);
  assert.deepEqual(report.releaseReadiness.experienceBudgets,contract.release.experienceBudgets);
  assert.equal(report.status,'NOT_TESTED');
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

test('query- en fragmentcontexten delen een fysiek scherm zonder hun eigen bewijsidentiteit te verliezen', () => {
  const destinations = ['/apps/app.html?pas=rtg', '/apps/app.html?pas=business#tab=zorg', 'https://vreemd.invalid/apps/app.html', '//vreemd.invalid/apps/app.html'];
  const apps = destinations.map((destination, i) => ({ id:'app:context:'+i, destination, entry:destination }));
  const screen = { id:'screen:/apps/app.html', route:'/apps/app.html', world:'living', profile:'interface' };
  const report = coverage.build(ROOT,{contract,signatures:{version:1,apps:{},screens:{}},apps,screens:[screen],sourceHash:'source',commit:'candidate'});
  assert.deepEqual(report.logicalApps.map(row=>row.screenIds), [[screen.id],[screen.id],[],[]]);
  assert.deepEqual(report.logicalApps.map(row=>row.destination), destinations);
  assert.deepEqual(report.logicalApps.map(row=>row.entry), destinations);
  assert.deepEqual(report.screens[0].logicalAppIds, ['app:context:0','app:context:1']);
  assert.equal(report.logicalApps.every(row=>row.signature.status==='NOT_TESTED'), true);
});

test('niet-toepasselijk vereist een expliciet besluit en een reden', () => {
  const broken = structuredClone(contract);
  broken.profiles.redirect.notApplicable.composition = {decision:'',reason:''};
  const report = coverage.build(ROOT,{contract:broken,signatures,apps:[],screens:[{id:'screen:/apps/r.html',route:'/apps/r.html',world:'redirect',profile:'redirect'}],sourceHash:'source',commit:'candidate'});
  assert.equal(coverage.validate(ROOT,report,broken,signatures).some(e=>e.includes('UNJUSTIFIED_NOT_APPLICABLE')),true);
});

test('bewijs met andere bron of kandidaat is STALE', () => {
  const record = {status:'PROVEN',worktreeDirty:false,sourceHash:'old',commit:'candidate',configurationHash:'cfg',artifact:'proof',method:'browser'};
  assert.equal(coverage.evidenceStatus(record,'new','candidate','identity'),'STALE');
  assert.equal(coverage.evidenceStatus({...record,sourceHash:'new',commit:'other'},'new','candidate','identity'),'STALE');
});

test('AI-oordeel kan menselijke kwaliteit niet bewijzen', () => {
  const base = {status:'PROVEN',sourceHash:'source',commit:'candidate',configurationHash:'cfg',artifact:'proof'};
  assert.equal(coverage.evidenceStatus({...base,method:'ai-review',reviewer:{type:'ai',id:'model'}},'source','candidate','human-quality'),'BLOCKED');
  assert.equal(coverage.evidenceStatus({...base,method:'human-user-test',reviewer:{type:'human',id:'reviewer-1'}},'source','candidate','human-quality'),'BLOCKED');
});

test('metadata voor alle combinaties vervangt nooit echte bewijsartefacten', () => {
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
  assert.equal(proven.status,'NOT_TESTED');
  assert.ok(proven.logicalApps[0].dimensions.every(d=>d.status==='BLOCKED'));
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

test('een app-signature hergebruikt de volledige APPWERKT-noemer zonder haar te kopieren', () => {
  const app={id:'app:test',function:'link:test',name:'Test',world:'LivingOS',persona:'lid',destination:'/apps/test.html',entry:'/apps/test.html',
    interactionInventory:{source:'APPWERKT.json',found:2,touched:['Opslaan','Open detail'],untouched:[]}};
  const signature={identity:'eigen identiteit',purpose:'testdoel',composition:'rustige taakcompositie',motion:'continu',
    interactionDensity:'quiet',interactions:{source:'APPWERKT'},humanTasks:['Rond de taak af']};
  const options={contract,signatures:{version:1,apps:{'app:test':signature},screens:{}},apps:[app],screens:[],sourceHash:'source',commit:'candidate'};
  const first=coverage.build(ROOT,options),resolved=first.logicalApps[0].signature;
  assert.equal(resolved.status,'DECLARED');
  assert.deepEqual(resolved.derivedFrom,['interactions:APPWERKT.json']);
  assert.deepEqual(resolved.value.interactions,[
    {id:'appwerkt-001',label:'Opslaan'},{id:'appwerkt-002',label:'Open detail'}
  ]);
  const before=first.logicalApps[0].dimensions.find(row=>row.id==='accessibility').requirementCount;
  app.interactionInventory={source:'APPWERKT.json',found:3,touched:['Opslaan','Open detail','Verwijderen'],untouched:[]};
  const second=coverage.build(ROOT,options);
  assert.equal(second.logicalApps[0].signature.status,'DECLARED');
  assert.equal(second.logicalApps[0].dimensions.find(row=>row.id==='accessibility').requirementCount,before+1,
    'nieuwe bediening vergroot automatisch de Experience-noemer');
  app.interactionInventory.untouched=['Niet aangeraakt'];
  assert.equal(coverage.build(ROOT,options).logicalApps[0].signature.status,'BLOCKED');
});

test('alleen een bestaande app mag doel en bediening uit bestaande bronnen afleiden', () => {
  const app={id:'app:map-instellingen:link:juridisch',function:'link:juridisch',name:'Juridisch',world:'Instellingen',persona:'lid',
    destination:'/apps/juridisch.html',entry:'/apps/juridisch.html',interactionInventory:{source:'APPWERKT.json',found:1,touched:['CONTROLEREN'],untouched:[]}};
  const signature={identity:'juridisch',purpose:{source:'appcontract'},composition:'rustig document',motion:'continu',
    interactionDensity:'quiet',interactions:{source:'APPWERKT'},humanTasks:['Lees een document']};
  const report=coverage.build(ROOT,{contract,signatures:{version:1,apps:{[app.id]:signature},screens:{}},apps:[app],screens:[],sourceHash:'source',commit:'candidate'});
  assert.equal(report.logicalApps[0].signature.status,'DECLARED');
  assert.equal(report.logicalApps[0].signature.value.purpose,
    'iedere bezoeker kan de juridische uitleg lezen zonder dat het scherm persoonlijke gegevens of een bevoegde handeling ontsluit');
  assert.deepEqual(report.logicalApps[0].signature.derivedFrom,['purpose:appcontract','interactions:APPWERKT.json']);
  const screen={id:'screen:/apps/test.html',route:'/apps/test.html',world:'living',profile:'interface'};
  const blocked=coverage.build(ROOT,{contract,signatures:{version:1,apps:{},screens:{'/apps/test.html':signature}},apps:[],screens:[screen],sourceHash:'source',commit:'candidate'});
  assert.equal(blocked.screens[0].signature.status,'BLOCKED','een scherm mag geen appcontract of APPWERKT-appnoemer lenen');
});

test('Experience telt navigatielinks naast knoppen, zonder kwalificatie te erven', () => {
  const observation={gevonden:1,aangeraakt:['Opslaan'],onaangeraakt:[],navigatie:{gevonden:2,geklikt:2,
    aangeraakt:[{naam:'Privacybeleid'},{naam:'Algemene voorwaarden'}],onbewezen:[],fouten:[]}};
  const before=JSON.stringify(observation),inventory=coverage.interactionInventory(observation);
  assert.equal(inventory.found,3);
  assert.deepEqual(inventory.touched,['Opslaan','Privacybeleid','Algemene voorwaarden']);
  assert.deepEqual(inventory.untouched,[]);
  const app={id:'app:test',function:'link:test',name:'Test',world:'LivingOS',destination:'/apps/test.html',interactionInventory:inventory};
  const signature={identity:'test',purpose:'documentkeuze',composition:'rustig',motion:'continu',interactionDensity:'quiet',
    interactions:[{id:'save',label:'Opslaan'}],humanTasks:['Lees het document']};
  const options={apps:[app],screens:[],contract,signatures:{apps:{'app:test':signature}},sourceHash:'source',commit:'candidate'};
  assert.equal(coverage.build(ROOT,options).logicalApps[0].signature.status,'BLOCKED','ontbrekende links mogen niet verdwijnen');
  signature.interactions.push({id:'privacy',label:'Privacybeleid'},{id:'terms',label:'Algemene voorwaarden'});
  const report=coverage.build(ROOT,options);
  assert.equal(report.logicalApps[0].signature.status,'DECLARED');
  assert.equal(report.summary.logicalApps.proven,0,'bediening is geen menselijke of volledige Experience-kwalificatie');
  assert.equal(JSON.stringify(observation),before,'bronregister wordt niet veranderd');
});

test('onvolledige, mislukte of ongeldige linkinventaris blijft open in Experience', () => {
  for(const navigatie of [null,{gevonden:1},
    {gevonden:2,geklikt:1,aangeraakt:[{naam:'Privacy'}],onbewezen:[],fouten:[]},
    {gevonden:1,geklikt:1,aangeraakt:[{naam:'Privacy'}],onbewezen:[],fouten:['HTTP 500']},
    {gevonden:1,geklikt:1,aangeraakt:[],onbewezen:[],fouten:[]}]) {
    assert.ok(coverage.interactionInventory({gevonden:0,aangeraakt:[],onaangeraakt:[],navigatie}).untouched.length>0);
  }
});
