'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {build,OUT}=require('../scripts/loop-fabric-source-flows');

test('bronflows hebben een volledige stoppoort en reproduceerbaar register',()=>{
  const registry=build(),disk=JSON.parse(fs.readFileSync(OUT,'utf8'));assert.deepEqual(disk,registry);
  assert.deepEqual(registry.summary,{GO:8,PHASE:8,STOP:8});
  assert.equal(registry.scope,'SOURCE_OWNED_FLOWS');
  assert.deepEqual(registry.originalBatchCapabilities,['bedrijf','dom-library','dom-livinglab','experience-platform','leerhuis']);
  assert.deepEqual(registry.capabilities,['bedrijf','dom-doos','dom-foutmelder','dom-library','dom-livinglab','experience-platform','leerhuis','service']);
  for(const row of registry.flows){
    for(const key of ['semanticOwner','canonicalState','mutationPoint','authority','occurrence','observationOpportunity',
      'expectationDecision','claimContest','changeTarget','sourceIssuedReceipt','verificationPath','memoryClass','retention',
      'recallContext','recoveryReplay','prerequisite']) assert.ok(row[key],row.id+' mist '+key);
    assert.ok(['GO','PHASE','STOP'].includes(row.status));assert.ok(Array.isArray(row.tests));
  }
});

test('bestaande bewijsslices en D23 zijn GO terwijl persoonlijke state dicht blijft',()=>{
  const rows=Object.fromEntries(build().flows.map(x=>[x.id,x]));
  assert.deepEqual(Object.values(rows).filter(x=>x.status==='GO').map(x=>x.id).sort(),[
    'academy.practice-to-knowledge','experience.living-world-contribution','experience.living-world-commons-release',
    'library.feedback-to-edition','library-edition-to-academy',
    'service.process-improvement','workos.accessibility-procedure','workos.near-miss-runbook'].sort());
  assert.equal(rows['library.personal-reader-state'].status,'STOP');
  assert.equal(rows['experience.resume-attention'].status,'STOP');
  assert.match(rows['livinglab.participant-observation'].prerequisite,/governancebesluit/);
  assert.equal(rows['service.browser-failure-review'].status,'PHASE');
  assert.match(rows['zaakdoos.device-update-learning'].prerequisite,/misclassificatie/);
});
