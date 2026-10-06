/* Tweede bewijsslice: dezelfde federatieve contracten dragen een interne
   WorkOS near-miss en een versioned runbook, zonder Living World-semantiek. */
'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./lib/loop-fabric-fixture');
const P=require('../server/kern/loop-fabric/protocol');

test('WorkOS near-miss sluit via dezelfde Observation/Decision/Receipt/Recall/Verification-contracten',async()=>{
  const f=fixture(),runbookRef=f.runbookRef();
  const first=await f.workSource.observeIncident({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'workos_incident_observe_0001',incidentId:'incident_1',runbookRef,
    title:'Terugvalroute bijna overgeslagen',text:'De primaire controle slaagde, maar de terugvalroute stond niet in de uitvoercheck.',
    occurredAt:f.time(),purpose:'runbook-near-miss-improvement'});
  assert.equal(first.ok,true,JSON.stringify(first));
  await f.fabric.sync('WLOOP');
  const inbox=f.fabric.inbox('user-1','WLOOP');
  assert.equal(inbox.ok,true); assert.equal(inbox.items.length,1);
  assert.equal(inbox.items[0].observationRef.domain,'workos');

  const decision=await f.decide({observationRef:inbox.items[0].observationRef,
    observationHash:inbox.items[0].observationHash,changeTargetRef:runbookRef,
    scopeRefs:inbox.items[0].scopeRefs,
    expectation:'Een expliciete terugvalcontrole voorkomt dat dezelfde stap bij een volgende uitrol wordt overgeslagen.',
    successCriteria:['Primaire én terugvalroute zijn vóór uitvoering afgetekend.'],purpose:'runbook-near-miss-improvement'});
  const changed=await f.workSource.apply({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'workos_runbook_change_0001',decisionId:decision.id,changeTargetRef:runbookRef,
    data:{title:'Uitrol-runbook',text:'Controleer en teken primaire route én terugvalroute af.',
      owner:'Olivia Organisator',validUntil:'2027-10-04'}});
  assert.equal(changed.ok,true,JSON.stringify(changed));
  assert.equal(changed.changeReceipt.changeType,'runbook.version-created');
  assert.equal(f.workspace.kennis.runbook_v1.vervallen,true);
  assert.equal(changed.artifact.soort,'runbook');
  await f.fabric.sync('WLOOP');

  const currentRef=changed.changeReceipt.newRef;
  const recalled=await f.fabric.present('user-1',{operationId:'workos_runbook_recall_0001',context:{workspaceCode:'WLOOP',
    scopeRefs:[currentRef],action:'deployment.prepare',purpose:'runbook-near-miss-improvement'}});
  assert.equal(recalled.ok,true,JSON.stringify(recalled));
  assert.equal(recalled.recall.candidates.length,1);
  assert.equal(recalled.recall.candidates[0].source.changeRef.id,currentRef.id);
  assert.match(recalled.recall.candidates[0].reason,/brondomein bevestigde wijziging/i);

  f.workspace.storingen.incident_2={id:'incident_2',wat:'Volgende vergelijkbare uitrol gecontroleerd.',ernst:'controle',
    begonnenAt:f.time(),opgelostAt:null,tickets:[],evaluatie:null,at:f.time(),door:'Olivia Organisator'};
  const verification=await f.workSource.observeIncident({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'workos_incident_verify_0001',incidentId:'incident_2',runbookRef:currentRef,
    title:'Terugvalroute gecontroleerd',text:'Bij deze uitvoering zijn beide routes vóór de start afgetekend.',
    occurredAt:f.time(),purpose:'runbook-near-miss-improvement',
    verificationOf:{domain:'workos',type:'change-receipt',id:changed.changeReceipt.receiptId,version:1},assessment:'improved'});
  assert.equal(verification.ok,true,JSON.stringify(verification));
  await f.fabric.sync('WLOOP');
  const proof=f.fabric.proof('user-1','WLOOP');
  const relation=proof.lineage.find(row=>row.relation==='observed_after_change' &&
    row.to.id===verification.observation.objectRef.id);
  assert.ok(relation); assert.equal(relation.causalClaim,false);
  assert.equal(relation.provenance.note,'temporal-verification-not-causality');
  assert.equal(P.refKey(relation.from),P.refKey(verification.observation.verificationOf));
});

test('WorkOS-observation en runbookchange zijn replayveilig en blijven bron-eigendom',async()=>{
  const f=fixture(),input={actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'workos_incident_replay_0001',incidentId:'incident_1',runbookRef:f.runbookRef(),title:'Near miss',
    text:'De terugvalstap ontbrak.',occurredAt:f.time(),purpose:'runbook-near-miss-improvement'};
  const first=await f.workSource.observeIncident(input),again=await f.workSource.observeIncident(input);
  assert.equal(first.ok,true); assert.equal(again.replay,true);
  const conflict=await f.workSource.observeIncident({...input,text:'Andere inhoud.'});
  assert.equal(conflict.code,'REPLAY_CONFLICT');
  assert.equal(Object.keys(f.workspace.loopProtocol.observations).length,1);
  assert.equal(f.db.data.loopFabric,undefined,'de Fabric krijgt geen broninhoud voordat de bron levert');
  await f.fabric.sync('WLOOP');
  assert.equal(JSON.stringify(f.db.data.loopFabric).includes('De terugvalstap ontbrak'),false,
    'de minimale Lineage Index kopieert de meldingsinhoud niet');
});
