'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {build,OUT}=require('../scripts/loop-fabric-source-flows');

test('B01 is opgesplitst in bronflows met volledige stoppoort en reproduceerbaar register',()=>{
  const registry=build(),disk=JSON.parse(fs.readFileSync(OUT,'utf8'));assert.deepEqual(disk,registry);
  assert.deepEqual(registry.summary,{GO:5,PHASE:6,STOP:9});
  assert.deepEqual(registry.capabilities,['bedrijf','dom-library','dom-livinglab','experience-platform','leerhuis']);
  for(const row of registry.flows){
    for(const key of ['semanticOwner','canonicalState','mutationPoint','authority','occurrence','observationOpportunity',
      'expectationDecision','claimContest','changeTarget','sourceIssuedReceipt','verificationPath','memoryClass','retention',
      'recallContext','recoveryReplay','prerequisite']) assert.ok(row[key],row.id+' mist '+key);
    assert.ok(['GO','PHASE','STOP'].includes(row.status));assert.ok(Array.isArray(row.tests));
  }
});

test('alleen sourceflows uit de vier bestaande bewijsslices zijn GO en persoonlijke state blijft dicht',()=>{
  const rows=Object.fromEntries(build().flows.map(x=>[x.id,x]));
  assert.deepEqual(Object.values(rows).filter(x=>x.status==='GO').map(x=>x.id).sort(),[
    'academy.practice-to-knowledge','experience.living-world-contribution','library.feedback-to-edition',
    'workos.accessibility-procedure','workos.near-miss-runbook'].sort());
  assert.equal(rows['library.personal-reader-state'].status,'STOP');
  assert.equal(rows['experience.resume-attention'].status,'STOP');
  assert.match(rows['livinglab.participant-observation'].prerequisite,/governancebesluit/);
});
