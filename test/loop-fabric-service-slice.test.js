'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./lib/loop-fabric-fixture');
const makeServiceSource=require('../server/kern/service/loop-source');

function serviceFixture(){
  const f=fixture(),save=()=>{},zaken=require('../server/kern/service/zaak')({db:f.db,save,crypto});
  const loop=require('../server/kern/service/loop')({zaken,save}),kwaliteit=require('../server/kern/service/kwaliteit')({zaken});
  const source=makeServiceSource({leesCollectie:name=>f.db.data[name],bewerkCollectie:f.bewerkCollectie,zaken,kwaliteit,now:f.time,
    authorize:actor=>actor==='user-1',authorizeRecipient:(actor,workspace)=>f.workSource.authorization(actor,workspace,['besluit'])});
  f.fabric.registerSource('service',source);return {...f,zaken,serviceLoop:loop,kwaliteit,serviceSource:source};
}
function caseWithHandoff(f,{repeat=true,index=1}={}){
  const opened=f.zaken.open({melder:'private-member-'+index,onderwerp:'app',titel:'Geheime persoonlijke vraag '+index,
    bron:'app'});assert.equal(opened.ok,true);
  const id=opened.zaak.id;f.serviceLoop.mensVraag(id,{tier:'rtg'});
  if(repeat)f.serviceLoop.bericht(id,{van:'melder',tekst:'Volledige gesprekstekst: ik moest mijn hele verhaal opnieuw vertellen.'});
  else f.serviceLoop.bericht(id,{van:'mens',tekst:'Wij pakken de overdracht op.',wie:'Nadia'});
  return id;
}
async function reviewed(f,caseId,operationId,verificationOf){
  const out=await f.serviceSource.reviewCase({actorRef:'user-1',operationId,caseId,workspaceCode:'WLOOP',
    processId:'human-handoff',purpose:'service-process-improvement',verificationOf:verificationOf||null});
  assert.equal(out.ok,true,JSON.stringify(out));await f.fabric.sync('WLOOP');return out;
}

test('Service Case wordt alleen als geminimaliseerde procesmetadata organizational learning',async()=>{
  const f=serviceFixture(),caseId=caseWithHandoff(f,{repeat:true});
  const observation=await reviewed(f,caseId,'service_review_operation_0001');
  const serialized=JSON.stringify({source:f.db.data.serviceLearning,fabric:f.db.data.loopFabric});
  assert.doesNotMatch(serialized,/private-member|Geheime persoonlijke|Volledige gesprekstekst|hele verhaal/);
  assert.equal(observation.observation.sourceActorRef,null);
  assert.equal(observation.observation.basis,'reviewed-minimal-process-metadata');
  assert.equal(observation.observation.eligibility.memoryClass,'ORGANIZATIONAL');
  assert.deepEqual(observation.observation.eligibility.allowedFields,['assessment','observedAt','status','text','title']);
  const inbox=f.fabric.inbox('user-1','WLOOP');assert.equal(inbox.ok,true);assert.equal(inbox.items.length,1);
  assert.equal(inbox.items[0].subjectRef.type,'process');assert.equal(inbox.items[0].sourceActorRef,null);
});

test('service process change, recall en nieuwe waarneming vormen een niet-causale slice',async()=>{
  const f=serviceFixture(),first=await reviewed(f,caseWithHandoff(f,{repeat:true,index:1}),'service_review_operation_0002');
  const item=f.fabric.inbox('user-1','WLOOP').items[0],procedureRef=f.procedureRef();
  const decision=await f.decide({observationRef:item.observationRef,observationHash:item.observationHash,
    changeTargetRef:procedureRef,scopeRefs:item.scopeRefs,expectation:'De overdracht start voortaan bij RTG, zonder herhaling door de melder.',
    successCriteria:['RTG reageert als eerste na menselijke overdracht.'],purpose:'service-process-improvement'});
  const changed=await f.workSource.apply({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'service_change_operation_001',decisionId:decision.id,changeTargetRef:procedureRef,
    data:{title:'Serviceoverdrachtprocedure',text:'Lees de zaakcontext en neem zelf als eerste contact op.',owner:'Olivia Organisator',validUntil:'2027-10-04'}});
  assert.equal(changed.ok,true);await f.fabric.sync('WLOOP');
  const recalled=await f.fabric.present('user-1',{operationId:'service_recall_operation_001',context:{workspaceCode:'WLOOP',
    scopeRefs:[{domain:'service',type:'process',id:'human-handoff',version:1}],action:'service.handoff.prepare',
    purpose:'service-process-improvement'}});
  assert.equal(recalled.ok,true);assert.equal(recalled.recall.candidates.length,1);
  const second=caseWithHandoff(f,{repeat:false,index:2});
  const verification=await reviewed(f,second,'service_verify_operation_001',{domain:'workos',type:'change-receipt',
    id:changed.changeReceipt.receiptId,version:1});
  assert.equal(verification.observation.assessment,'improved');
  const proof=f.fabric.proof('user-1','WLOOP');assert.equal(proof.ok,true);
  const relation=proof.lineage.find(x=>x.relation==='observed_after_change');assert.ok(relation);
  assert.equal(relation.causalClaim,false);assert.equal(relation.provenance.note,'temporal-verification-not-causality');
});

test('service authority, replay, withdrawal en gespreksscheiding falen dicht',async()=>{
  const f=serviceFixture(),caseId=caseWithHandoff(f,{repeat:true,index:3}),input={actorRef:'user-2',
    operationId:'service_denied_operation_01',caseId,workspaceCode:'WLOOP',processId:'human-handoff',
    purpose:'service-process-improvement',verificationOf:null};
  assert.equal((await f.serviceSource.reviewCase(input)).code,'AUTHORITY_REVOKED');
  assert.equal((await f.serviceSource.reviewCase({...input,actorRef:'user-1',operationId:'service_cross_tenant_01',
    workspaceCode:'OTHER'})).code,'NOT_FOUND');
  const one=await reviewed(f,caseId,'service_replay_operation_01');
  assert.equal((await f.serviceSource.reviewCase({...input,actorRef:'user-1',operationId:'service_replay_operation_01'})).replay,true);
  assert.equal((await f.serviceSource.reviewCase({...input,actorRef:'user-1',operationId:'service_replay_operation_01',purpose:'ander-doel'})).code,'REPLAY_CONFLICT');
  const withdrawn=await f.serviceSource.withdraw({actorRef:'user-1',operationId:'service_withdraw_operation_1',
    observationRef:one.observation.objectRef,workspaceCode:'WLOOP',reason:'Procesartifact niet langer gebruiken.'});
  assert.equal(withdrawn.ok,true);await f.fabric.sync('WLOOP');
  const eligibility=f.serviceSource.learningEligibility(one.observation.objectRef,{domain:'workos',id:'WLOOP'},
    {purpose:'service-process-improvement',use:'recall'});assert.equal(eligibility.code,'SOURCE_WITHDRAWN');
});

test('service outbox herstelt na consumeruitval zonder tweede bronartifact',async()=>{
  const f=serviceFixture(),caseId=caseWithHandoff(f,{repeat:true,index:4});
  const made=await f.serviceSource.reviewCase({actorRef:'user-1',operationId:'service_delivery_source_01',caseId,
    workspaceCode:'WLOOP',processId:'human-handoff',purpose:'service-process-improvement',verificationOf:null});
  assert.equal(made.ok,true);let attempts=0;
  await assert.rejects(f.serviceSource.deliver('WLOOP','failure-probe',()=>{attempts++;throw new Error('consumer offline');}));
  const recovered=await f.serviceSource.deliver('WLOOP','failure-probe',()=>{attempts++;});
  assert.equal(recovered.deliveredThrough,1);assert.equal(attempts,2);
  assert.equal(Object.keys(f.db.data.serviceLearning.observations).length,1);
});
