'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./lib/loop-fabric-fixture');

async function changed(f,suffix='01') {
  const runbookRef=f.runbookRef();
  const observed=await f.workSource.observeIncident({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'lifecycle_observe_000'+suffix,incidentId:'incident_1',runbookRef,title:'Near miss',
    text:'De terugvalcontrole ontbrak.',occurredAt:f.time(),purpose:'runbook-near-miss-improvement'});
  assert.equal(observed.ok,true); await f.fabric.sync('WLOOP');
  const item=f.fabric.inbox('user-1','WLOOP').items[0];
  const decision=await f.decide({observationRef:item.observationRef,observationHash:item.observationHash,
    changeTargetRef:runbookRef,scopeRefs:item.scopeRefs,expectation:'De volgende uitvoering controleert beide routes.',
    successCriteria:['Beide routes zijn afgetekend.'],purpose:'runbook-near-miss-improvement'});
  const result=await f.workSource.apply({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'lifecycle_change_000'+suffix,decisionId:decision.id,changeTargetRef:runbookRef,
    data:{title:'Uitrol-runbook',text:'Controleer beide routes.',owner:'Olivia Organisator',validUntil:'2027-10-04'}});
  assert.equal(result.ok,true,JSON.stringify(result)); await f.fabric.sync('WLOOP');
  return {observation:observed.observation,change:result};
}

const recallContext=change=>({workspaceCode:'WLOOP',scopeRefs:[change.changeReceipt.newRef],
  action:'deployment.prepare',purpose:'runbook-near-miss-improvement'});

test('bronverwijdering anonimiseert Lineage en Recall verklaart source_missing zonder privacy-bypass',async()=>{
  const f=fixture(),setup=await changed(f,'11'),before=f.fabric.candidates('user-1',recallContext(setup.change));
  assert.equal(before.items.length,1);
  const removed=await f.workSource.lifecycleObservation({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'lifecycle_delete_operation_1',observationRef:setup.observation.objectRef,status:'deleted',
    reason:'Bewaartermijn en verwijderverzoek uitgevoerd.'});
  assert.equal(removed.ok,true); await f.fabric.sync('WLOOP');
  const after=f.fabric.candidates('user-1',recallContext(setup.change));
  assert.equal(after.items.length,0); assert.equal(after.outcomes.length,1);
  assert.equal(after.outcomes[0].status,'source_missing');
  const stored=JSON.stringify(f.db.data.loopFabric);
  assert.equal(stored.includes(setup.observation.objectRef.id),false,'de minimale index houdt alleen een niet-herleidbare tombstone');
  assert.equal(Object.values(f.fabric._read().lineage).some(row=>row.from.type==='tombstone' || row.to.type==='tombstone'),true);
  f.db.data.loopFabric.consumed={}; f.db.data.loopFabric.observations={}; f.db.data.loopFabric.changes={}; f.db.data.loopFabric.lineage={};
  const rebuilt=await f.fabric.rebuild(['WLOOP']);
  assert.equal(rebuilt.ok,true); assert.equal(JSON.stringify(f.db.data.loopFabric).includes(setup.observation.objectRef.id),false,
    'ook rebuild uit source-owned lifecycledata herintroduceert de verwijderde ref niet');
});

test('recall-retention verwijdert ontvangercontext en operation results replayveilig',async()=>{
  const f=fixture(),setup=await changed(f,'12');
  const shown=await f.fabric.present('user-1',{operationId:'retention_recall_present_1',context:recallContext(setup.change)});
  assert.equal(shown.ok,true); assert.equal(shown.recall.candidates.length,1);
  f.clock('2026-10-06T10:00:00.000Z');
  const input={operationId:'retention_sweep_operation_1',recallsBefore:'2026-10-05T00:00:00.000Z',
    observationsBefore:'2026-10-06T10:00:00.000Z'};
  const swept=await f.fabric.sweepRetention(input),again=await f.fabric.sweepRetention(input);
  assert.equal(swept.ok,true); assert.equal(swept.removedRecalls,1); assert.equal(again.replay,true);
  assert.equal(f.fabric.consumerForRecall(shown.recall.recallId),null);
  assert.equal(JSON.stringify(f.db.data.loopFabric).includes('user-1'),false,
    'na recall-retention blijft geen actoridentiteit in projectie, operatie-uitkomst of journaalenvelop achter');
  const conflict=await f.fabric.sweepRetention({...input,recallsBefore:'2026-10-04T00:00:00.000Z'});
  assert.equal(conflict.code,'REPLAY_CONFLICT');
});

test('superseded change blijft historisch maar wordt expliciet stale teruggebracht',async()=>{
  const f=fixture(),setup=await changed(f,'13'),ref=setup.change.changeReceipt.newRef;
  const row=f.workspace.kennis[ref.id]; row.vervallen=true; row.vervallenAt=f.time();
  row.opgevolgdDoorId='runbook_v3'; row.opgevolgdDoorVersie=3;
  f.workspace.kennis.runbook_v3={...row,id:'runbook_v3',versie:3,vorigeId:row.id,vervallen:false};
  const recall=f.fabric.candidates('user-1',recallContext(setup.change));
  assert.equal(recall.items.length,1); assert.equal(recall.items[0].status,'superseded-change');
  assert.equal(recall.items[0].source.changeRef.id,'runbook_v3');
});
