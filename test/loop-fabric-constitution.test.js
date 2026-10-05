'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const C=require('../server/kern/loop-fabric/constitution'),E=require('../server/kern/loop-fabric/learning-eligibility');
const {build,OUT}=require('../scripts/loop-fabric-constitution');
const ref=(domain,type,id,version=1)=>({domain,type,id,version});
const base=overrides=>E.issue({sourceRef:ref('service','lesson','l1'),purpose:'service-improvement',memoryClass:'ORGANIZATIONAL',
  audience:[{domain:'service',id:'org1'}],basis:{type:'ORGANIZATIONAL_PROCESS'},allowedFields:['kind'],
  uses:{decision:true,recall:true,'cross-domain':false,ai:false,aggregate:false,publish:false},issuedAt:'2026-10-05T00:00:00.000Z',
  validUntil:'2027-10-05T00:00:00.000Z',retention:{mode:'EXPIRY_OR_WITHDRAWAL',policyId:'service.lesson.v1'},
  epistemicType:'SYSTEM_OBSERVED',...overrides});

test('Constitution is versioned, machineleesbaar en gelijk aan runtimebron',()=>{
  const disk=JSON.parse(fs.readFileSync(OUT,'utf8'));assert.deepEqual(disk,build());assert.equal(disk.version,C.VERSION);
  assert.ok(disk.rules.length>=18);assert.ok(disk.resolvedDecisions.includes('D23_LIBRARY_EDUCATION_RELEASE'));
});

test('dienstgebruik, forever-retentie en stille persoonlijke promotie falen dicht',()=>{
  assert.throws(()=>base({basis:{type:'SERVICE_USE'}}),e=>e.code==='LEARNING_CONSENT_NOT_INFERRED');
  assert.throws(()=>base({retention:{mode:'FOREVER',policyId:'bad'}}),e=>e.code==='RETENTION_POLICY_REQUIRED');
  assert.throws(()=>base({promotionFrom:{sourceRef:ref('personal','observation','p1'),memoryClass:'PERSONAL'}}),e=>e.code==='MEMORY_PROMOTION_REQUIRED');
});

test('Commons en AI-doelen zijn versie- en scopegebonden',()=>{
  assert.throws(()=>C.validateEligibility({sourceRef:ref('saloon','release','r1',null),memoryClass:'COMMONS',basis:{type:'EXPLICIT_RELEASE'},
    uses:{ai:false},retention:{mode:'EXPIRY_OR_WITHDRAWAL'}}),e=>e.code==='COMMONS_VERSION_REQUIRED');
  assert.throws(()=>base({uses:{ai:true},basis:{type:'AI_EXPLICIT_SCOPE'}}),e=>e.code==='AI_SCOPE_REQUIRED');
  assert.throws(()=>base({uses:{ai:true},basis:{type:'AI_EXPLICIT_SCOPE'},aiScopes:['training']}),e=>e.code==='AI_TRAINING_SCOPE_REQUIRED');
  const assistance=base({uses:{ai:true},basis:{type:'AI_EXPLICIT_SCOPE'},aiScopes:['assistance']});
  assert.deepEqual(assistance.aiScopes,['assistance']);
});

test('Personal naar organizational maakt een nieuw unlinked artifact',()=>{
  const release=ref('personal','release','release1');
  const row=base({promotionFrom:{sourceRef:ref('personal','observation','p1'),memoryClass:'PERSONAL',releaseRef:release,
    unlinkedAt:'2026-10-05T00:00:00.000Z'}});assert.equal(row.memoryClass,'ORGANIZATIONAL');
  assert.throws(()=>base({promotionFrom:{sourceRef:ref('personal','observation','p1'),memoryClass:'PERSONAL',releaseRef:release}}),e=>e.code==='UNLINKING_REQUIRED');
});
