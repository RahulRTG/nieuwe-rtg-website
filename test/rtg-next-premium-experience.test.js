'use strict';

// Deze positieve fixture toetst alleen de conjunctieve poortberekening op reeds
// gevalideerde dimensie-uitkomsten. Gesynthetiseerde PROVEN-waarden hieronder
// zijn geen uitvoerings-, browser-, provider- of menselijke productbewijzen.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const coverage = require('../scripts/lib/experience/coverage');
const planning = require('../scripts/lib/experience/qualification-planning');
const gates = require('../scripts/lib/experience/qualification-gates');
const contractSource = require('../experience-architecture/coverage-contract.json');
const ROOT = path.join(__dirname, '..');
const IDS = ['novice-task','expert-efficiency','informed-decision','safe-resumption','coherent-trust'];

function fixture({proven = true} = {}) {
  const contract = structuredClone(contractSource);
  const owner = {capability:'protocol.premium-experience',rol:'eigenaar',afbouw:{
    workPackages:['P0','P1','P4','P5','P6','P7'],workFunctions:['link:geldcommand'],
    sceneFamily:'Ledger',riskClass:'critical',scenarioFamilies:['transaction'],
    rationale:'Synthetische protocolfixture; geen echte kwalificatie.'
  }};
  const app = {id:'app:premium-experience-fixture',function:'link:geldcommand',name:'Protocolfixture',
    world:'LivingOS',persona:'lid',destination:'/apps/premium-experience-fixture.html',entry:'/apps/premium-experience-fixture.html'};
  const screen = {id:'screen:/apps/premium-experience-fixture.html',route:'/apps/premium-experience-fixture.html',
    world:'living',profile:'interface',owner};
  const signature = {identity:'protocolfixture',purpose:'De vijf vragen als conjunctie toetsen',composition:'Rustige protocolfixture',
    motion:'Geen beweging',interactionDensity:'quiet',interactions:[{id:'inspect',label:'Controleer'}],humanTasks:['Controleer de protocolfixture']};
  const signatures = {version:1,apps:{[app.id]:signature},screens:{[screen.route]:signature}};
  contract.inventoryBaselines = {logicalApps:1,screens:1};
  const report = coverage.build(ROOT,{contract,signatures,apps:[app],screens:[screen],
    sourceHash:'synthetic-premium-experience-protocol',commit:'synthetic-protocol-candidate'});
  const subjects = report.logicalApps.concat(report.screens);
  if (proven) for (const subject of subjects) for (const row of subject.dimensions) if (row.applicable) {
    row.status = 'PROVEN'; row.provenCount = row.requirementCount;
  }
  return {contract,owner,signature,signatures,report,subjects};
}

test('Premium Experience Gate bindt exact vijf vragen binnen de bestaande vier beslispoorten', () => {
  const gate = contractSource.qualificationPlanning.premiumExperienceGate;
  assert.equal(gate.version,1);
  assert.equal(gate.status,'CONTRACT_DEFINED');
  assert.equal(gate.aggregation.operator,'ALL');
  assert.deepEqual(gate.checks.map(check=>check.id).sort(),[...IDS].sort());
  for (const check of gate.checks) assert.ok(check.dimensions.includes('human-quality'),check.id+' vereist menselijk bewijs');
  assert.deepEqual(require('../docs/rtg-next/programma.json').gates.map(gate=>gate.id),['G1','G2','G3','G4']);
  assert.throws(()=>gates.assess(ROOT,{gate:'G5'}),/geen bewijs- of statusoverrides/);
});

test('alle vijf vragen vergroten de echte human-quality-requirements en ownerbinding', () => {
  const f = fixture({proven:false});
  for (const subject of f.subjects) {
    assert.deepEqual(subject.qualificationPlan.premiumExperienceChecks.sort(),[...IDS].sort());
    const requirements = coverage.requirements(f.contract,'interface','human-quality',subject.signature,subject);
    for (const id of IDS) assert.ok(requirements.includes('premium-experience:'+id));
    const row = subject.dimensions.find(row=>row.id==='human-quality');
    assert.equal(row.requirementCount,requirements.length);
    assert.equal(row.provenCount,0);
    assert.equal(row.status,'NOT_TESTED');
  }
});

test('novice en ervaren gebruikers hebben afzonderlijke cohorten en een onafhankelijke niet-gemiddelde rubric', () => {
  const gate = contractSource.qualificationPlanning.premiumExperienceGate;
  assert.deepEqual([...gate.cohortProtocol.cohorts].sort(),['experienced','novice']);
  assert.equal(gate.cohortProtocol.separateCohortResults,true);
  assert.equal(gate.cohortProtocol.novice.coachingAllowed,false);
  assert.equal(gate.cohortProtocol.independentReviewRequired,true);
  for (const key of ['compensationAllowed','crossCohortPoolingAllowed','crossRiskPoolingAllowed','crossDevicePoolingAllowed','crossTaskPoolingAllowed'])
    assert.equal(gate.aggregation[key],false,key);
  assert.equal(gate.aggregation.criticalFailuresAllowed,0);
  const acceptance = gate.checks.find(check=>check.id==='coherent-trust').measurableAcceptance;
  assert.equal(acceptance.rubric.everyObservedRatingMustMeetMinimum,true);
  assert.equal(acceptance.rubric.averagingAllowed,false);
  assert.equal(acceptance.rubric.independentHumanAssessmentRequired,true);
  assert.equal(acceptance.rubric.scaleMin,1);
  assert.equal(acceptance.rubric.scaleMax,5);
  assert.ok(acceptance.rubric.scoreMinPerCriterion>=4);
  assert.deepEqual(acceptance.rubric.criteria.map(item=>item.id).sort(),['consistency','craft','orientation','trust']);
});

test('versoepelen van cohortscheiding, menselijke rubric of compensatie sluit de poort', () => {
  const mutations = [
    gate=>{gate.cohortProtocol.cohorts=['experienced'];},
    gate=>{gate.cohortProtocol.separateCohortResults=false;},
    gate=>{gate.cohortProtocol.novice.coachingAllowed=true;},
    gate=>{gate.cohortProtocol.independentReviewRequired=false;},
    ...['compensationAllowed','crossCohortPoolingAllowed','crossRiskPoolingAllowed','crossDevicePoolingAllowed','crossTaskPoolingAllowed']
      .map(key=>gate=>{gate.aggregation[key]=true;}),
    gate=>{gate.checks.find(check=>check.id==='coherent-trust').measurableAcceptance.rubric.averagingAllowed=true;},
    gate=>{gate.checks.find(check=>check.id==='coherent-trust').measurableAcceptance.rubric.everyObservedRatingMustMeetMinimum=false;},
    gate=>{gate.checks.find(check=>check.id==='coherent-trust').measurableAcceptance.rubric.scoreMinPerCriterion=3;},
    gate=>{const rubric=gate.checks.find(check=>check.id==='coherent-trust').measurableAcceptance.rubric;rubric.criteria=Array.from({length:4},()=>structuredClone(rubric.criteria[0]));}
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f.contract.qualificationPlanning.premiumExperienceGate);
    assert.equal(planning.premiumExperienceAssessment(f.contract,f.subjects).status,'BLOCKED');
  }
});

test('vijf bewezen protocolvragen voor ieder onderwerp sluiten uitsluitend de pure projectie', () => {
  const f = fixture(), before = structuredClone(f.subjects);
  const result = planning.premiumExperienceAssessment(f.contract,f.subjects);
  assert.equal(result.status,'PROVEN');
  assert.equal(result.checks.length,5);
  for (const check of result.checks) {
    assert.equal(check.status,'PROVEN');
    assert.equal(check.requiredSubjects,2);
    assert.equal(check.provenSubjects,2);
  }
  assert.equal(result.releaseAuthorized,false);
  assert.deepEqual(result.excludedRedirects,[]);
  assert.deepEqual(f.subjects,before,'de projectie mag geen bestaand bewijs of status wijzigen');
});

test('vier geslaagde vragen kunnen de vijfde ontbrekende binding nooit compenseren', () => {
  for (const id of IDS) {
    const f = fixture();
    f.subjects[0].qualificationPlan.premiumExperienceChecks = IDS.filter(value=>value!==id);
    const result = planning.premiumExperienceAssessment(f.contract,f.subjects);
    assert.equal(result.status,'BLOCKED',id);
    assert.equal(result.checks.filter(check=>check.status==='PROVEN').length,4);
    const failed = result.checks.find(check=>check.id===id);
    assert.equal(failed.status,'BLOCKED');
    assert.equal(failed.requiredSubjects,2);
    assert.equal(failed.provenSubjects,1);
    assert.equal(result.releaseAuthorized,false);
  }
});

test('veel geslaagde onderwerpen middelen een ontbrekend menselijk oordeel niet weg', () => {
  const f = fixture();
  const subjects = Array.from({length:20},(_,index)=>({...structuredClone(f.subjects[0]),id:'protocol:'+index}));
  subjects[19].dimensions.find(row=>row.id==='human-quality').status = 'NOT_TESTED';
  const result = planning.premiumExperienceAssessment(f.contract,subjects);
  assert.equal(result.status,'BLOCKED');
  for (const check of result.checks) {
    assert.equal(check.status,'BLOCKED');
    assert.equal(check.requiredSubjects,20);
    assert.equal(check.provenSubjects,19);
  }
});

test('een contract of opgeslagen groen register produceert geen menselijk uitvoeringsbewijs', () => {
  const f = fixture({proven:false});
  f.report.status = 'PROVEN';
  f.report.summary.dimensions.proven = f.report.summary.dimensions.total;
  const result = planning.premiumExperienceAssessment(f.contract,f.subjects);
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.checks.every(check=>check.provenSubjects===0));
  assert.equal(result.releaseAuthorized,false);
});

test('ontbrekende, stale, failed of niet-toepasselijk gemaakte mensendimensie blokkeert', () => {
  for (const mutation of [
    subject=>{subject.dimensions=subject.dimensions.filter(row=>row.id!=='human-quality');},
    subject=>{subject.dimensions.find(row=>row.id==='human-quality').status='NOT_TESTED';},
    subject=>{subject.dimensions.find(row=>row.id==='human-quality').status='STALE';},
    subject=>{subject.dimensions.find(row=>row.id==='human-quality').status='FAILED';},
    subject=>{subject.dimensions.find(row=>row.id==='human-quality').applicable=false;}
  ]) {
    const f = fixture(); mutation(f.subjects[0]);
    assert.equal(planning.premiumExperienceAssessment(f.contract,f.subjects).status,'BLOCKED');
  }
});

test('een vervalst groene dimensie met verkleinde of opgeblazen telling blijft geblokkeerd', () => {
  for (const mutation of [
    row=>{row.requirementCount--;row.provenCount=row.requirementCount;},
    row=>{row.provenCount--;},
    row=>{row.provenCount++;},
    row=>{row.requirementCount=0;row.provenCount=0;}
  ]) {
    const f = fixture(); mutation(f.subjects[0].dimensions.find(row=>row.id==='human-quality'));
    assert.equal(planning.premiumExperienceAssessment(f.contract,f.subjects).status,'BLOCKED');
  }
});

test('ontbrekende vijfde vraag, dubbel id of ANY-aggregatie kan geen poort openen', () => {
  for (const mutation of [
    contract=>{delete contract.qualificationPlanning.premiumExperienceGate;},
    contract=>{contract.qualificationPlanning.premiumExperienceGate.checks.pop();},
    contract=>{const checks=contract.qualificationPlanning.premiumExperienceGate.checks;checks[4]=structuredClone(checks[0]);},
    contract=>{contract.qualificationPlanning.premiumExperienceGate.aggregation.operator='ANY';},
    contract=>{contract.qualificationPlanning.premiumExperienceGate.status='PROVEN';}
  ]) {
    const f = fixture(); mutation(f.contract);
    assert.equal(planning.premiumExperienceAssessment(f.contract,f.subjects).status,'BLOCKED');
  }
});

test('een vraag zonder mensendimensie en een ontbrekende signature of binding falen dicht', () => {
  const f = fixture();
  f.contract.qualificationPlanning.premiumExperienceGate.checks[0].dimensions = ['continuity'];
  assert.equal(planning.premiumExperienceAssessment(f.contract,f.subjects).status,'BLOCKED');
  for (const mutation of [
    subject=>{subject.signature.status='NOT_TESTED';},
    subject=>{delete subject.qualificationPlan;},
    subject=>{subject.qualificationPlan.status='PROVEN';},
    subject=>{subject.qualificationPlan.premiumExperienceChecks=[];}
  ]) {
    const x = fixture(); mutation(x.subjects[0]);
    assert.equal(planning.premiumExperienceAssessment(x.contract,x.subjects).status,'BLOCKED');
  }
});

test('redirects behouden hun bestaande vrijstelling zonder interfaceonderwerpen te vervangen', () => {
  const f = fixture();
  const redirect = {...structuredClone(f.subjects[1]),id:'screen:/apps/redirect-fixture.html',profile:'redirect'};
  redirect.qualificationPlan = planning.binding(f.contract,f.owner,'redirect');
  for (const id of IDS) {
    assert.ok(!redirect.qualificationPlan.premiumExperienceChecks.includes(id));
    assert.ok(!planning.requirements(f.contract,'human-quality',redirect,'redirect').includes('premium-experience:'+id));
  }
  const mixed = planning.premiumExperienceAssessment(f.contract,f.subjects.concat(redirect));
  assert.equal(mixed.status,'PROVEN');
  assert.deepEqual(mixed.excludedRedirects,[redirect.id]);
  assert.ok(mixed.checks.every(check=>check.requiredSubjects===2));
  assert.equal(planning.premiumExperienceAssessment(f.contract,[redirect]).status,'BLOCKED');
  assert.equal(planning.premiumExperienceAssessment(f.contract,[]).status,'BLOCKED');
});

test('onbekend profiel en een requirementuitbreiding na bewijs sluiten een eerdere protocoluitslag', () => {
  const f = fixture();
  const unknown = {...structuredClone(f.subjects[1]),id:'protocol:unknown-profile',profile:'custom-safe'};
  assert.equal(planning.premiumExperienceAssessment(f.contract,f.subjects.concat(unknown)).status,'BLOCKED');
  f.contract.qualificationPlanning.premiumCriteria.push({id:'new-human-requirement',dimensions:['human-quality'],evidenceRequirements:['human-observation']});
  assert.equal(planning.premiumExperienceAssessment(f.contract,f.subjects).status,'BLOCKED');
});
