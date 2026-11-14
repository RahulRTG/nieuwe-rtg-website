'use strict';

// Protocolproeven voor de koppeling van bestaande inventaris en bewijslast.
// Zij leveren geen browser-, provider- of menselijk kwalificatiebewijs.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const coverage=require('../scripts/lib/experience/coverage');
const planning=require('../scripts/lib/experience/qualification-planning');
const contract=require('../experience-architecture/coverage-contract.json');
const ROOT=path.join(__dirname,'..');

function fixture() {
  const owner={capability:'protocol.fixture',rol:'eigenaar',afbouw:{
    workPackages:['P0','P1','P4','P5','P6','P7'],workFunctions:['link:geldcommand'],
    sceneFamily:'Ledger',riskClass:'critical',scenarioFamilies:['transaction'],
    rationale:'Uitsluitend een synthetische bron om het kwalificatieprotocol te testen.'
  }};
  const app={id:'app:fixture',function:'link:geldcommand',name:'Protocolfixture',world:'LivingOS',persona:'lid',
    destination:'/apps/fixture.html?stand=controle#bewijs',entry:'/apps/fixture.html?stand=controle#bewijs'};
  const screen={id:'screen:/apps/fixture.html',route:'/apps/fixture.html',world:'living',profile:'interface',owner};
  const signature={identity:'protocolfixture',purpose:'Protocolbinding toetsen',composition:'Rustige fixture',
    motion:'Geen beweging',interactionDensity:'quiet',interactions:[{id:'inspect',label:'Controleer'}],humanTasks:['Controleer de fixture']};
  const signatures={version:1,apps:{[app.id]:signature},screens:{[screen.route]:signature}};
  const local=structuredClone(contract);
  local.inventoryBaselines={logicalApps:1,screens:1};
  const options={contract:local,signatures,apps:[app],screens:[screen],sourceHash:'protocol-source',commit:'protocol-candidate'};
  return {owner,app,screen,signature,signatures,contract:local,options,build:()=>coverage.build(ROOT,options)};
}

test('requirements behoudt de vierargument-API en voegt per onderwerp alleen eisen toe',()=>{
  const f=fixture(),signature={status:'DECLARED',value:f.signature};
  assert.deepEqual(coverage.requirements(f.contract,'interface','identity',signature),['signature']);
  for(const dimension of coverage.DIMENSION_ORDER) {
    const baseline=coverage.requirements(f.contract,'interface',dimension,signature);
    const actual=coverage.requirements(f.contract,'interface',dimension,signature,f.screen);
    const extra=planning.requirements(f.contract,dimension,f.screen,'interface');
    assert.deepEqual(actual,[...new Set(baseline.concat(extra))]);
    assert.ok(actual.length>baseline.length,dimension+' krijgt premiumvoorwaarden');
    assert.ok(baseline.every(id=>actual.includes(id)),dimension+' verliest geen bestaande eis');
  }
});

test('de app gebruikt uitsluitend de eigenaar van haar fysieke scherm en behoudt query en fragment',()=>{
  const f=fixture();
  f.app.owner={capability:'verzonnen',rol:'eigenaar',afbouw:{riskClass:'standard'}};
  const report=f.build(),app=report.logicalApps[0],screen=report.screens[0];
  assert.equal(app.owner,f.owner);
  assert.equal(app.destination,f.app.destination);
  assert.equal(app.entry,f.app.entry);
  assert.deepEqual(app.screenIds,[f.screen.id]);
  assert.deepEqual(app.qualificationPlan,planning.binding(f.contract,f.owner,'interface',planning.acceptanceSource(ROOT).entries));
  assert.deepEqual(screen.qualificationPlan,app.qualificationPlan);
  assert.deepEqual(coverage.validate(ROOT,report,f.contract,f.signatures),[]);
  assert.equal(report.summary.logicalApps.proven,0);
  assert.equal(report.summary.screens.proven,0);
});

test('premiumcriteria, scenariofamilie en alle risicobudgetten worden echte Experience-requirements',()=>{
  const f=fixture(),report=f.build();
  for(const subject of [report.logicalApps[0],report.screens[0]]) {
    const all=Object.fromEntries(subject.dimensions.map(d=>[d.id,coverage.requirements(f.contract,'interface',d.id,subject.signature,subject)]));
    assert.ok(all.continuity.includes('scenario:transaction-execute'));
    assert.ok(all.continuity.includes('scenario:transaction-negative'));
    assert.ok(all.continuity.includes('premium:truth'));
    for(const device of f.contract.devices) {
      assert.ok(all.fluidity.includes('budget:critical:'+device+':performance'));
      assert.ok(all.accessibility.includes('budget:critical:'+device+':accessibility'));
      assert.ok(all.continuity.includes('budget:critical:'+device+':interruption'));
      assert.ok(all.continuity.includes('budget:critical:'+device+':recovery'));
      assert.ok(all['human-quality'].includes('budget:critical:'+device+':humanComprehension'));
    }
    assert.ok(all.restraint.includes('task-budget:transaction'));
    for(const d of subject.dimensions) {
      assert.equal(d.requirementCount,all[d.id].length);
      assert.equal(d.provenCount,0);
      assert.equal(d.status,'NOT_TESTED','een contract zonder uitgevoerde producer blijft onbewezen');
    }
  }
});

test('een nieuw familiescenario vergroot de app- en schermnoemer zonder bewijs over te nemen',()=>{
  const f=fixture(),before=f.build();
  f.contract.qualificationPlanning.scenarioFamilies.transaction.push({id:'transaction-extra-fixture',given:'Fixture',when:'Controle',then:'Uitkomst',evidenceRequirements:['domain-state-readback'],instrumentRefs:[]});
  const after=f.build();
  for(const key of ['logicalApps','screens']) {
    const previous=before[key][0].dimensions.find(d=>d.id==='continuity');
    const current=after[key][0].dimensions.find(d=>d.id==='continuity');
    assert.equal(current.requirementCount,previous.requirementCount+1);
    assert.equal(current.provenCount,0);
    assert.ok(after[key][0].qualificationPlan.scenarios.includes('transaction-extra-fixture'));
  }
  assert.notEqual(after.status,'PROVEN');
});

test('ontbrekend planningcontract faalt validatie en kwalificeert een synthetische proef niet',()=>{
  const f=fixture();delete f.contract.qualificationPlanning;
  const report=f.build(),errors=coverage.validate(ROOT,report,f.contract,f.signatures);
  assert.ok(errors.includes('QUALIFICATION_PLANNING_MISSING'));
  assert.ok(errors.includes('QUALIFICATION_BINDING_MISSING:'+f.screen.id));
  assert.equal(report.screens[0].qualificationPlan.status,'NOT_DEFINED');
  assert.equal(report.summary.logicalApps.proven,0);
  assert.equal(report.summary.screens.proven,0);
  assert.notEqual(report.status,'PROVEN');
});

test('een scherm zonder afbouwbinding krijgt geen impliciet generiek groen contract',()=>{
  const f=fixture();delete f.owner.afbouw;
  const report=f.build(),errors=coverage.validate(ROOT,report,f.contract,f.signatures);
  for(const subject of report.logicalApps.concat(report.screens)) {
    assert.equal(subject.qualificationPlan.status,'NOT_DEFINED');
    assert.ok(errors.includes('QUALIFICATION_BINDING_MISSING:'+subject.id));
  }
  assert.notEqual(report.status,'PROVEN');
});

test('een ontbrekend fysiek scherm mag de los meegegeven app-owner niet lenen',()=>{
  const f=fixture();f.app.owner=f.owner;f.options.screens=[];
  const report=f.build(),app=report.logicalApps[0];
  assert.equal(app.owner,null);
  assert.equal(app.qualificationPlan.status,'NOT_DEFINED');
  assert.ok(coverage.validate(ROOT,report,f.contract,f.signatures).includes('APP_WITHOUT_SCREEN:'+f.app.id));
  assert.equal(report.summary.logicalApps.proven,0);
});

test('een verkleinde of vervalst groene planningprojectie wordt geweigerd',()=>{
  const f=fixture();
  for(const mutate of [plan=>plan.scenarios.pop(),plan=>plan.status='PROVEN',plan=>plan.qualification='PROVEN',plan=>plan.budgets=[]]) {
    const report=f.build();mutate(report.screens[0].qualificationPlan);
    assert.ok(coverage.validate(ROOT,report,f.contract,f.signatures).includes('QUALIFICATION_BINDING_MISMATCH:'+f.screen.id));
  }
});

test('een ontbrekend risicobudget of onbekende scenariofamilie blijft een onvolledige binding',()=>{
  for(const change of [f=>f.contract.qualificationPlanning.budgetMatrix.splice(f.contract.qualificationPlanning.budgetMatrix.findIndex(b=>b.id==='critical:tablet'),1),
    f=>f.owner.afbouw.scenarioFamilies=['onbekend']]) {
    const f=fixture();change(f);
    assert.ok(coverage.validate(ROOT,f.build(),f.contract,f.signatures).includes('QUALIFICATION_BINDING_MISSING:'+f.screen.id));
  }
});

test('een gereduceerde requirementtelling kan de nieuwe bewijslast niet verbergen',()=>{
  const f=fixture(),report=f.build();
  const dimension=report.screens[0].dimensions.find(d=>d.id==='continuity');
  dimension.requirementCount=coverage.requirements(f.contract,'interface','continuity',report.screens[0].signature).length;
  assert.ok(coverage.validate(ROOT,report,f.contract,f.signatures).includes('QUALIFICATION_REQUIREMENT_COUNT_MISMATCH:'+f.screen.id+':continuity'));
});

test('redirects behouden het gemotiveerde toepasselijkheidsprofiel en hun eigen overdrachtsbewijzen',()=>{
  const f=fixture();f.screen.profile='redirect';f.screen.world='redirect';
  f.owner.afbouw.scenarioFamilies=['redirect'];
  const report=f.build(),screen=report.screens[0];
  for(const dimension of ['composition','restraint','adaptability','human-quality']) {
    const row=screen.dimensions.find(d=>d.id===dimension);
    assert.equal(row.status,'NOT_APPLICABLE');
    assert.equal(row.decision,'EXP-REDIRECT-001');
    assert.equal(row.requirementCount,0);
  }
  const continuity=coverage.requirements(f.contract,'redirect','continuity',screen.signature,screen);
  assert.ok(continuity.includes('scenario:redirect-recover'));
  assert.ok(continuity.includes('budget:critical:desktop:recovery'));
  assert.equal(screen.qualificationPlan.qualification,'NOT_TESTED');
  assert.notEqual(report.status,'PROVEN');
});
