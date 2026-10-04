/* De federatieve Loop Fabric-slice bewijst observation, bevoegd WorkOS-besluit,
   source-issued change receipt, doelgebonden recall en niet-causale verificatie.
   De adversarial paden dekken intrekking, correctie, contest, uitval, rebuild en replay. */
'use strict';

const test=require('node:test'), assert=require('node:assert/strict');
const {fixture}=require('./lib/loop-fabric-fixture');
const protocol=require('../server/kern/loop-fabric/protocol');

const workspaceSharing={visibility:'workspace',purpose:'event-accessibility-improvement',
  recipients:[{domain:'workos',id:'WLOOP'}],consent:true,returnUpdates:true};

async function observed(f) {
  const event=await f.setupEvent(), firstPlan=await f.eventRun(event.blueprintId,'user-2');
  let observation=await f.command('user-2','contribution.create',{placeId:event.placeId,planId:firstPlan,kind:'observation',
    title:'Drempel blokkeerde toegang',text:'De hoofdingang was met een rolstoel niet zelfstandig toegankelijk.',
    observedAt:f.time(),sharing:workspaceSharing});
  observation=await f.command('user-1','contribution.review',{id:observation.id,revision:observation.revision,
    decision:'accepted',reason:'De melding is met de deelnemer en locatiebeheerder bekeken.'});
  await f.fabric.sync('WLOOP');
  const inbox=f.fabric.inbox('user-1','WLOOP');
  assert.equal(inbox.ok,true); assert.equal(inbox.items.length,1);
  return {...event,firstPlan,observationId:observation.id,inbox:inbox.items[0]};
}

async function changed(f) {
  const setup=await observed(f), procedureRef=f.procedureRef();
  const decision=await f.decide({observationRef:setup.inbox.observationRef,observationHash:setup.inbox.observationHash,
    procedureRef,placeRef:setup.inbox.placeRef,blueprintRef:setup.inbox.blueprintRef,
    expectation:'Met een helling, route-instructie en aankomstcheck is zelfstandige toegang bij de volgende uitvoering mogelijk.',
    successCriteria:['De toegangsroute is vóór opening geïnspecteerd.','Een rolstoelgebruiker kan de zaal zelfstandig bereiken.'],
    purpose:'event-accessibility-improvement'});
  const result=await f.workSource.apply({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'work_change_operation_0001',decisionId:decision.id,procedureRef,
    data:{title:'Event toegankelijkheidscheck',text:'Controleer hoofdingang, helling, route-instructie en aankomst vóór opening.',
      owner:'Olivia Organisator',validUntil:'2027-10-04'}});
  assert.equal(result.ok,true,JSON.stringify(result)); await f.fabric.sync('WLOOP');
  return {...setup,decision,change:result};
}

test('volledige federatieve lus: observatie, WorkOS-besluit, bronwijziging, recall en niet-causale verificatie',async()=>{
  const f=fixture(), setup=await changed(f);
  assert.equal(f.workspace.kennis.procedure_v1.vervallen,true);
  assert.equal(setup.change.procedure.versie,2);
  assert.equal(setup.change.changeReceipt.sourceDomain,'workos');
  assert.equal(setup.change.changeReceipt.integrityRef.auditId.startsWith('geb_'),true);
  const receiptBody=protocol.clone(setup.change.changeReceipt); receiptBody.integrityRef=null;
  assert.equal(protocol.hash(receiptBody),setup.change.changeReceipt.integrityRef.hash);
  const observationEvent=f.db.data.livingWorld.history.find(x=>x.protocol && x.protocol.objectRef.id===setup.observationId);
  assert.equal(observationEvent.envelop.correlatie,observationEvent.operationId);
  assert.equal(observationEvent.envelop.oorzaak,null,'hashvolgorde van gebeurtenissen is geen causale relatie');
  const returned=f.row('user-2','contribution',setup.observationId).treatmentUpdates;
  assert.equal(returned.length,1); assert.equal(returned[0].status,'change-applied');
  assert.equal(returned[0].receiptRef.id,setup.change.changeReceipt.receiptId);

  const secondPlan=await f.eventRun(setup.blueprintId,'user-3');
  const presented=await f.fabric.present('user-1',{operationId:'recall_present_operation_01',context:{workspaceCode:'WLOOP',
    placeRef:{domain:'living-world',type:'place',id:setup.placeId,version:null},
    blueprintRef:{domain:'living-world',type:'blueprint',id:setup.blueprintId,version:null},action:'event.prepare',
    purpose:'event-accessibility-improvement'}});
  assert.equal(presented.ok,true,JSON.stringify(presented)); assert.equal(presented.recall.candidates.length,1);
  const candidate=presented.recall.candidates[0];
  assert.match(candidate.reason,/eerdere observatie/i); assert.equal(candidate.policy.decision,'allow');
  assert.equal(candidate.status,'current'); assert.equal(candidate.source.changeReceiptId,setup.change.changeReceipt.receiptId);
  const accepted=await f.fabric.disposition('user-1',{operationId:'recall_accept_operation_01',
    recallId:presented.recall.recallId,decision:'accepted',reason:'Procedure wordt voor de opening gebruikt.'});
  assert.equal(accepted.ok,true);

  let verification=await f.command('user-3','contribution.create',{placeId:setup.placeId,planId:secondPlan,kind:'observation',
    title:'Toegangsroute opnieuw bekeken',text:'De tijdelijke helling lag klaar; de zaal was zelfstandig bereikbaar.',
    observedAt:f.time(),sharing:workspaceSharing,
    verificationOf:{domain:'workos',type:'change-receipt',id:setup.change.changeReceipt.receiptId,version:1},assessment:'improved'});
  verification=await f.command('user-1','contribution.review',{id:verification.id,revision:verification.revision,
    decision:'accepted',reason:'Waarneming bij de tweede uitvoering gecontroleerd.'});
  await f.fabric.sync('WLOOP');
  const proof=f.fabric.proof('user-1','WLOOP');
  assert.equal(proof.ok,true); assert.equal(proof.integrity,true);
  const relation=proof.lineage.find(x=>x.relation==='observed_after_change');
  assert.ok(relation,'verification is aan de wijziging verbonden');
  assert.equal(relation.causalClaim,false,'na de wijziging waargenomen is geen causale claim');
  assert.equal(relation.provenance.note,'temporal-verification-not-causality');
  assert.equal(proof.lineage.every(x=>x.from.version!==null && x.to.version!==null),true,
    'lineage bindt beide zijden aan de exacte bronversie');
  assert.equal(proof.recalls[0].disposition.decision,'accepted');
  assert.equal(JSON.stringify(f.db.data.loopFabric).includes('De hoofdingang was met een rolstoel'),false,
    'de herbouwbare index kopieert de persoonlijke meldingstekst niet');
});

test('observatie blijft bij leveringsuitval bestaan en de duurzame bron-outbox herstelt',async()=>{
  const f=fixture(), event=await f.setupEvent(), plan=await f.eventRun(event.blueprintId,'user-2');
  let observation=await f.command('user-2','contribution.create',{placeId:event.placeId,planId:plan,kind:'observation',
    title:'Drempel',text:'De route was niet toegankelijk.',observedAt:f.time(),sharing:workspaceSharing});
  observation=await f.command('user-1','contribution.review',{id:observation.id,revision:observation.revision,
    decision:'accepted',reason:'Bekeken.'});
  await assert.rejects(f.world.deliver('loop-fabric',async()=>{throw new Error('consumer offline');}),/consumer offline/);
  assert.equal(f.row('user-2','contribution',observation.id).status,'accepted');
  await f.fabric.sync('WLOOP');
  assert.equal(f.fabric.inbox('user-1','WLOOP').items.length,1);
});

test('mislukte of onbevoegde change geeft geen succesreceipt en intrekking wordt bij commit gezien',async()=>{
  const f=fixture(), setup=await observed(f), procedureRef=f.procedureRef();
  const decision=await f.decide({observationRef:setup.inbox.observationRef,observationHash:setup.inbox.observationHash,
    procedureRef,placeRef:setup.inbox.placeRef,blueprintRef:setup.inbox.blueprintRef,expectation:'Verbeterde route.',
    successCriteria:['Route gecontroleerd.'],purpose:'event-accessibility-improvement'});
  f.workspace.leden.lead.rollen=[];
  const denied=await f.workSource.apply({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'revoked_change_operation_1',decisionId:decision.id,procedureRef,
    data:{title:'Nieuw',text:'Nieuwe procedure.',owner:'Olivia Organisator',validUntil:'2027-10-04'}});
  assert.equal(denied.code,'AUTHORITY_REVOKED');
  assert.equal(f.workspace.kennis.procedure_v1.vervallen,false);
  assert.equal(f.workspace.loopProtocol,undefined,'geen receipt of outbox bij geweigerde mutatie');
});

test('WorkOS bevriest geen verzonnen of gewijzigde Observation als beslisgrond',async()=>{
  const f=fixture(),setup=await observed(f),procedureRef=f.procedureRef();
  const proposed=await f.propose({observationRef:setup.inbox.observationRef,observationHash:'0'.repeat(64),
    procedureRef,placeRef:setup.inbox.placeRef,blueprintRef:setup.inbox.blueprintRef,
    expectation:'Verbeterde route.',successCriteria:['Route gecontroleerd.'],purpose:'event-accessibility-improvement'});
  assert.equal(proposed.status,409); assert.equal(proposed.body.code,'OBSERVATION_CHANGED');
  assert.equal(Object.keys(f.workspace.besluiten).length,0);
});

test('change-commit overleeft receiptleveringsuitval; replay en changed replay blijven veilig',async()=>{
  const f=fixture(), setup=await changed(f), before=Object.keys(f.workspace.kennis).length;
  await assert.rejects(f.workSource.deliver('WLOOP','offline-test',async()=>{throw new Error('offline');}),/offline/);
  assert.equal(Object.keys(f.workspace.loopProtocol.receipts).length,1);
  const replay=await f.workSource.apply({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'work_change_operation_0001',decisionId:setup.decision.id,procedureRef:f.procedureRef(),
    data:{title:'Event toegankelijkheidscheck',text:'Controleer hoofdingang, helling, route-instructie en aankomst vóór opening.',
      owner:'Olivia Organisator',validUntil:'2027-10-04'}});
  assert.equal(replay.replay,true); assert.equal(Object.keys(f.workspace.kennis).length,before);
  const conflict=await f.workSource.apply({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'work_change_operation_0001',decisionId:setup.decision.id,procedureRef:f.procedureRef(),
    data:{title:'Anders',text:'Andere invoer.',owner:'Olivia Organisator',validUntil:'2027-10-04'}});
  assert.equal(conflict.code,'REPLAY_CONFLICT');
  await f.fabric.sync('WLOOP'); assert.equal(Object.keys(f.fabric._read().changes).length,1);
});

test('verloren Lineage Index herbouwt uit bronuitgegeven records',async()=>{
  const f=fixture(); await changed(f);
  f.db.data.loopFabric.consumed={}; f.db.data.loopFabric.observations={};
  f.db.data.loopFabric.changes={}; f.db.data.loopFabric.lineage={};
  const rebuilt=await f.fabric.rebuild(['WLOOP']);
  assert.equal(rebuilt.ok,true); assert.equal(rebuilt.observations,1); assert.equal(rebuilt.changes,1);
  assert.ok(rebuilt.lineage>=4); assert.equal(f.fabric.inbox('user-1','WLOOP').items.length,1);
  f.db.data.livingWorld.delivery['loop-fabric']=0;
  f.workspace.loopProtocol.delivery['loop-fabric']=0;
  const redelivered=await f.fabric.sync('WLOOP');
  assert.ok(redelivered.world.deliveredThrough>0); assert.ok(redelivered.work.deliveredThrough>0);
  assert.equal(Object.keys(f.fabric._read().changes).length,1,'bronredelivery na rebuild dupliceert geen change');
});

test('correctie wordt live bij de bron opgelost en niet als oude actuele context gepresenteerd',async()=>{
  const f=fixture(), setup=await changed(f);
  let correction=await f.command('user-2','contribution.create',{placeId:setup.placeId,planId:setup.firstPlan,kind:'observation',
    title:'Correctie toegangsroute',text:'De zijingang was wel bereikbaar; alleen de hoofdingang blokkeerde.',
    observedAt:f.time(),sharing:workspaceSharing,supersedes:setup.observationId});
  correction=await f.command('user-1','contribution.review',{id:correction.id,revision:correction.revision,
    decision:'accepted',reason:'Correctie samen gecontroleerd.'});
  await f.fabric.sync('WLOOP');
  assert.equal(f.fabric.inbox('user-1','WLOOP').items.length,1,'correctie verschijnt eenmaal via de actuele bronref');
  const recall=f.fabric.candidates('user-1',{workspaceCode:'WLOOP',placeRef:{domain:'living-world',type:'place',id:setup.placeId,version:null},
    blueprintRef:{domain:'living-world',type:'blueprint',id:setup.blueprintId,version:null},action:'event.prepare',
    purpose:'event-accessibility-improvement'});
  assert.equal(recall.items.length,1); assert.equal(recall.items[0].status,'corrected');
  assert.equal(recall.items[0].source.observationRef.id,correction.id);
  assert.equal(recall.items[0].correction.requested.id,setup.observationId);
});

test('een broncontest blijft zichtbaar bij recall en verandert niet stilzwijgend in waarheid',async()=>{
  const f=fixture(), setup=await changed(f);
  const current=f.row('user-2','contribution',setup.observationId);
  await f.command('user-2','contribution.contest',{id:current.id,revision:current.revision,
    reason:'De observatie beschrijft alleen de hoofdingang; de zijingang moet apart worden vermeld.'});
  await f.fabric.sync('WLOOP');
  const recall=f.fabric.candidates('user-1',{workspaceCode:'WLOOP',
    placeRef:{domain:'living-world',type:'place',id:setup.placeId,version:null},action:'event.prepare',
    purpose:'event-accessibility-improvement'});
  assert.equal(recall.ok,true); assert.equal(recall.items.length,1);
  assert.equal(recall.items[0].status,'contested'); assert.equal(recall.items[0].contests.length,1);
  assert.match(recall.items[0].contests[0].reason,/zijingang/);
});

test('intrekking stopt persoonlijke recall terwijl de zelfstandig gerechtvaardigde WorkOS-wijziging blijft bestaan',async()=>{
  const f=fixture(),setup=await changed(f),row=f.row('user-2','contribution',setup.observationId);
  await f.command('user-2','contribution.withdraw',{id:row.id,revision:row.revision,
    reason:'Ik trek mijn gedeelde observatie in.'});
  await f.fabric.sync('WLOOP');
  const recall=f.fabric.candidates('user-1',{workspaceCode:'WLOOP',
    placeRef:{domain:'living-world',type:'place',id:setup.placeId,version:null},action:'event.prepare',
    purpose:'event-accessibility-improvement'});
  assert.equal(recall.ok,true); assert.equal(recall.items.length,0);
  assert.equal(f.workSource.procedure('user-1','WLOOP',setup.change.changeReceipt.newRef).current,true,
    'de aangenomen organisatieprocedure is geen persoonlijk profiel van de melder');
  assert.equal(f.fabric.proof('user-1','WLOOP').changes.length,1,'historisch changebewijs blijft als restricted reference bestaan');
});

test('recall-presentatie en menselijke disposition zijn replayveilig en weigeren gewijzigde replay',async()=>{
  const f=fixture(), setup=await changed(f);
  const input={operationId:'recall_replay_operation_01',context:{workspaceCode:'WLOOP',
    placeRef:{domain:'living-world',type:'place',id:setup.placeId,version:null},action:'event.prepare',
    purpose:'event-accessibility-improvement'}};
  const first=await f.fabric.present('user-1',input), replay=await f.fabric.present('user-1',input);
  assert.equal(first.ok,true); assert.equal(replay.replay,true); assert.equal(replay.recall.recallId,first.recall.recallId);
  const changedReplay=await f.fabric.present('user-1',{...input,context:{...input.context,action:'event.execute'}});
  assert.equal(changedReplay.code,'REPLAY_CONFLICT');
  const disposition={operationId:'recall_disposition_replay_1',recallId:first.recall.recallId,
    decision:'ignored',reason:'Vandaag niet relevant voor deze taak.'};
  const ignored=await f.fabric.disposition('user-1',disposition), ignoredReplay=await f.fabric.disposition('user-1',disposition);
  assert.equal(ignored.disposition.decision,'ignored'); assert.equal(ignoredReplay.replay,true);
  const dispositionConflict=await f.fabric.disposition('user-1',{...disposition,decision:'contested'});
  assert.equal(dispositionConflict.code,'REPLAY_CONFLICT');
});

test('visibility en huidige WorkOS-bevoegdheid begrenzen inbox en recall zonder AI',async()=>{
  const f=fixture(), setup=await changed(f);
  assert.equal(f.fabric.inbox('user-9','WLOOP').code,'AUTHORITY_REVOKED');
  const other=f.fabric.inbox('user-1','WOTHER'); assert.equal(other.code,'NOT_FOUND');
  const wrongPurpose=f.fabric.candidates('user-1',{workspaceCode:'WLOOP',
    placeRef:{domain:'living-world',type:'place',id:setup.placeId,version:null},action:'event.prepare',purpose:'marketing'});
  assert.equal(wrongPurpose.ok,true); assert.equal(wrongPurpose.items.length,0,'doelbinding wordt bij recall opnieuw afgedwongen');
  f.workspace.leden.lead.rollen=[];
  const recall=await f.fabric.present('user-1',{operationId:'recall_after_revoke_001',context:{workspaceCode:'WLOOP',
    placeRef:{domain:'living-world',type:'place',id:setup.placeId,version:null},action:'event.prepare',
    purpose:'event-accessibility-improvement'}});
  assert.equal(recall.code,'AUTHORITY_REVOKED');
  assert.equal(f.fabric._read().recalls && Object.keys(f.fabric._read().recalls).length,0);
});
