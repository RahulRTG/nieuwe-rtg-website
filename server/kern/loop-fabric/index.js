'use strict';

const P=require('./protocol'), M=require('./model'), envelope=require('../envelop');
const klok=require('../../lib/klok');

module.exports=function makeLoopFabric({db,bewerkCollectie,livingWorld,workSource,academySource,now}) {
  const own=require('../eigencollectie')({db,domein:'kern/loop-fabric',bezit:{loopFabric:'kaart'}});
  const time=now || (()=>klok.datum().toISOString());
  const read=()=>M.state(own.kijk('loopFabric'));
  const tx=fn=>{
    if (typeof bewerkCollectie!=='function') P.fail('STORAGE_UNAVAILABLE','De Loop Fabric vereist duurzame collectietransacties.',503);
    return bewerkCollectie('loopFabric',fn);
  };
  const sourceAdapters={'living-world':livingWorld,workos:workSource};
  if (academySource) sourceAdapters.leerhuis=academySource;
  const projector=require('./projection')({read,tx,time,livingWorld,workSource,sourceAdapters});
  const operations=require('./operations')({read,sourceAdapters,time});
  const validateDecisionContext=require('./decision-context')({read,livingWorld,workSource,time,target});
  const observationSources=sourceAdapters;
  async function sync(workspaceCode) {
    const world=await livingWorld.deliver('loop-fabric',async event=>{
      const result=await projector.ingest(event); if (!result.ok) throw Object.assign(new Error(result.error),result);
    });
    const work=workspaceCode ? await workSource.deliver(workspaceCode,'loop-fabric',async event=>{
      const result=await projector.ingest(event); if (!result.ok) throw Object.assign(new Error(result.error),result);
    }) : {deliveredThrough:0};
    const returned=workspaceCode ? await workSource.deliver(workspaceCode,'living-world-return',async event=>{
      if (!event.receipt || !event.receipt.observationRef || event.receipt.observationRef.domain!=='living-world') return;
      const result=await livingWorld.returnChangeReceipt(event.receipt);
      if (!result.ok) throw Object.assign(new Error(result.error),result);
    }) : {deliveredThrough:0};
    return {ok:true,world,work,returned};
  }
  async function syncSource(domain,scopeId) {
    const source=sourceAdapters[domain];
    if (!source || typeof source.deliver!=='function') return P.error(Object.assign(new Error('Onbekend brondomein.'),
      {loopFabric:true,code:'SOURCE_UNAVAILABLE',status:503}));
    const delivered=await source.deliver(scopeId,'loop-fabric',async event=>{
      const result=await projector.ingest(event); if (!result.ok) throw Object.assign(new Error(result.error),result);
    });
    return {ok:true,domain,scopeId,delivered};
  }
  function target(workspaceCode) { return {domain:'workos',id:String(workspaceCode||'').trim().toUpperCase()}; }
  function consumerOf(context) {
    if (context && context.consumer) return {domain:P.text(context.consumer.domain,60),id:P.text(context.consumer.id,160)};
    return {domain:'workos',id:String(context && context.workspaceCode || '').trim().toUpperCase()};
  }
  function authorityFor(actorRef,consumer,required,context) {
    const adapter=sourceAdapters[consumer.domain];
    if (!adapter || typeof adapter.authorization!=='function')
      return {ok:false,error:'Het ontvangende domein heeft geen authority-adapter.',status:503,code:'AUTHORITY_UNAVAILABLE'};
    return adapter.authorization(actorRef,consumer.id,required,context);
  }
  function inboxFor(actorRef,consumer) {
    const authority=authorityFor(actorRef,consumer,['besluit'],{action:'observation.review'});
    if (!authority.ok) return authority;
    const state=read(), items=[],seen=new Set();
    for (const indexed of Object.values(state.observations)) {
      const record=indexed.record, shares=(record.sharing.recipients || []).some(r=>r.domain===consumer.domain && r.id===consumer.id);
      if (!shares || ['withdrawn','deleted','expired','rejected'].includes(record.status)) continue;
      const source=observationSources[record.objectRef.domain];
      if (!source || typeof source.resolveObservation!=='function') continue;
      const resolved=source.resolveObservation(record.objectRef,consumer);
      if (!resolved.ok || ['withdrawn','deleted','expired','rejected'].includes(resolved.observation.status)) continue;
      const observation=resolved.observation;
      const currentKey=P.refKey(observation.objectRef); if (seen.has(currentKey)) continue; seen.add(currentKey);
      items.push({observationRef:observation.objectRef,observationHash:P.hash(observation),title:observation.title,
        text:observation.text,occurredAt:observation.observedAt,recordedAt:observation.recordedAt,
        sourceActorRef:observation.sourceActorRef,visibility:observation.sharing.visibility,
        purpose:observation.sharing.purpose,subjectRef:observation.subjectRef || observation.placeRef,
        scopeRefs:P.clone(observation.scopeRefs || [observation.placeRef,observation.blueprintRef].filter(Boolean)),
        placeRef:observation.placeRef,blueprintRef:observation.blueprintRef,
        status:observation.contests.length ? 'contested' : resolved.corrected ? 'corrected' : 'current',
        contests:observation.contests,provenance:{basis:observation.basis,review:observation.review},
        why:'Deze brongebonden observatie is voor dit doel gericht aan '+consumer.domain+' '+consumer.id+'.'});
    }
    items.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));
    return {ok:true,consumer,items};
  }
  function inbox(actorRef,workspaceCode) {
    const result=inboxFor(actorRef,target(workspaceCode));
    return result.ok ? {...result,workspaceCode:result.consumer.id} : result;
  }
  function contextScopes(context) {
    const rows=Array.isArray(context.scopeRefs) ? context.scopeRefs
      : [context.placeRef,context.blueprintRef,context.subjectRef].filter(Boolean);
    if (!rows.length) P.fail('INVALID_INPUT','Recall vereist ten minste één brongebonden scope.');
    return rows.map(ref=>P.objectRef(ref,{versioned:false}));
  }
  const sameScope=(left,right)=>left.domain===right.domain && left.type===right.type && left.id===right.id;
  function unavailable(receipt,code,detail) {
    const status={SOURCE_DENIED:'denied',PURPOSE_DENIED:'denied',AUTHORITY_REVOKED:'denied',SOURCE_MISSING:'source_missing',
      NOT_FOUND:'source_missing',SOURCE_EXPIRED:'stale',SOURCE_WITHDRAWN:'unavailable',SOURCE_NOT_AVAILABLE:'unavailable',
      SOURCE_CHANGED:'stale',CHECK_NOT_RUN:'not_checked'}[code] || 'unavailable';
    return {changeReceiptId:receipt.receiptId,status,reasonCode:code || 'SOURCE_UNAVAILABLE',
      source:{domain:receipt.observationRef.domain,refHash:P.hash(P.refKey(receipt.observationRef))},
      why:detail || 'De actuele bron kon deze context niet beschikbaar stellen.'};
  }
  function candidates(actorRef,context) {
    P.fields(context,['workspaceCode','consumer','placeRef','blueprintRef','subjectRef','scopeRefs','action','purpose']);
    const consumer=consumerOf(context),authority=authorityFor(actorRef,consumer,['kennis'],context);
    if (!authority.ok) return authority;
    const scopes=contextScopes(context);
    const action=P.text(context.action,100),purpose=P.text(context.purpose,120), state=read(), items=[],outcomes=[];
    for (const entry of Object.values(state.changes)) {
      const receipt=entry.receipt, rc=receipt.context || {};
      const receiptScopes=[...(rc.scopeRefs || [rc.placeRef,rc.blueprintRef].filter(Boolean)),receipt.previousRef,receipt.newRef]
        .filter(Boolean);
      const receiptConsumer=rc.consumer || (rc.workspaceCode ? {domain:'workos',id:rc.workspaceCode}
        : rc.organizationCode ? {domain:'leerhuis',id:rc.organizationCode} : null);
      if (!receiptConsumer || receiptConsumer.domain!==consumer.domain || receiptConsumer.id!==consumer.id || rc.purpose!==purpose ||
          !scopes.every(scope=>receiptScopes.some(row=>sameScope(scope,row)))) continue;
      const source=observationSources[receipt.observationRef.domain];
      if (!source || typeof source.resolveObservation!=='function') { outcomes.push(unavailable(receipt,'SOURCE_UNAVAILABLE')); continue; }
      const observationResult=source.resolveObservation(receipt.observationRef,consumer);
      if (!observationResult.ok) { outcomes.push(unavailable(receipt,observationResult.code,observationResult.error)); continue; }
      const changeSource=sourceAdapters[receipt.sourceDomain];
      if (!changeSource || typeof changeSource.artifact!=='function') { outcomes.push(unavailable(receipt,'SOURCE_UNAVAILABLE')); continue; }
      const artifactResult=changeSource.artifact(actorRef,consumer.id,receipt.newRef);
      if (!artifactResult.ok) { outcomes.push(unavailable(receipt,artifactResult.code,artifactResult.error)); continue; }
      const observation=observationResult.observation, contested=observation.contests.length>0;
      if (observation.sharing.purpose!==purpose) { outcomes.push(unavailable(receipt,'PURPOSE_DENIED')); continue; }
      if (observation.validUntil && observation.validUntil<=time()) { outcomes.push(unavailable(receipt,'SOURCE_EXPIRED')); continue; }
      const status=!artifactResult.current ? 'superseded-change' : contested ? 'contested'
        : observationResult.corrected ? 'corrected' : 'current';
      const candidateId='recall_'+P.hash([receipt.receiptId,P.refKey(observation.objectRef),scopes.map(P.refKey),action]).slice(0,28);
      items.push({candidateId,reason:'Een eerdere observatie binnen deze context was input voor een door het brondomein bevestigde wijziging.',
        action,status,source:{observationRef:observation.objectRef,changeReceiptId:receipt.receiptId,
          changeRef:artifactResult.currentRef,procedureRef:receipt.newRef.type==='procedure' ? artifactResult.currentRef : undefined},
        ageSeconds:Math.max(0,Math.floor((Date.parse(time())-Date.parse(observation.observedAt))/1000)),
        observedAt:observation.observedAt,appliedAt:receipt.appliedAt,contests:P.clone(observation.contests),
        correction:observationResult.corrected ? {requested:receipt.observationRef,current:observation.objectRef} : null,
        expectation:P.clone(receipt.expectation),policy:{decision:'allow',policyId:'loop-recall-workspace-visibility',
          version:1,reasonCodes:['current-workspace-authority','purpose-exactly-matched','source-sharing-allows-purpose','source-resolved-live']},
        visibility:observation.sharing.visibility,purpose:observation.sharing.purpose});
    }
    items.sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt));
    return {ok:true,consumer,asOf:time(),items,outcomes};
  }
  async function present(actorRef,input) {
    try {
      P.fields(input,['operationId','context']); P.operationId(input.operationId);
      const result=candidates(actorRef,input.context); if (!result.ok) return result;
      const fingerprint=P.hash({actorRef,input}), key=P.hash([actorRef,input.operationId]);
      return await tx(raw=>{
        const state=M.state(raw), old=state.operations[key];
        if (old) {
          if (old.fingerprint!==fingerprint) P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
          return {...P.clone(old.result),replay:true};
        }
        const at=time(), recallId='rr_'+key.slice(0,30), recall={recallId,actorRef,context:P.clone(input.context),
          candidates:P.clone(result.items),omissions:P.clone(result.outcomes || []),recalledAt:at,disposition:null};
        state.recalls[recallId]=recall;
        const env=envelope.maak({id:'lfr_'+key.slice(0,28),at,kanaal:'loop-fabric',actor:'systeem',
          correlatie:recallId,oorzaak:null,classificatie:'persoonsgegeven'});
        M.append(state,'recall.presented',{recallId,candidates:result.items.map(x=>x.candidateId)},at,env);
        const out={ok:true,recall:P.clone(recall),replay:false}; state.operations[key]={fingerprint,result:P.clone(out)};
        Object.assign(raw,state); return out;
      });
    } catch(e) { return P.error(e); }
  }
  async function disposition(actorRef,input) {
    try {
      P.fields(input,['operationId','recallId','decision','reason']); P.operationId(input.operationId);
      if (!['accepted','ignored','contested'].includes(input.decision)) P.fail('INVALID_INPUT','Kies accepteren, negeren of betwisten.');
      const fingerprint=P.hash({actorRef,input}), key=P.hash([actorRef,input.operationId]);
      return await tx(raw=>{
        const state=M.state(raw), old=state.operations[key];
        if (old) {
          if (old.fingerprint!==fingerprint) P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
          return {...P.clone(old.result),replay:true};
        }
        const recall=state.recalls[input.recallId];
        if (!recall || recall.actorRef!==actorRef) P.fail('NOT_FOUND','Deze recall is niet beschikbaar.',404);
        const consumer=consumerOf(recall.context),authority=authorityFor(actorRef,consumer,['kennis'],recall.context);
        if (!authority.ok) P.fail(authority.code,authority.error,authority.status);
        if (recall.disposition) P.fail('ALREADY_DECIDED','Deze recall is al behandeld.',409);
        recall.disposition={decision:input.decision,reason:P.text(input.reason || '',500,false),at:time()};
        const out={ok:true,recallId:recall.recallId,disposition:P.clone(recall.disposition),replay:false};
        state.operations[key]={fingerprint,result:P.clone(out)}; Object.assign(raw,state); return out;
      });
    } catch(e) { return P.error(e); }
  }
  function consumerForRecall(recallId) {
    const recall=read().recalls[String(recallId || '')];
    return recall ? consumerOf(recall.context) : null;
  }
  async function sweepRetention(input) {
    try {
      P.fields(input,['operationId','recallsBefore','observationsBefore']);
      const operationId=P.operationId(input.operationId),recallsBefore=P.instant(input.recallsBefore,'recalls_before');
      const observationsBefore=P.instant(input.observationsBefore || time(),'observations_before');
      const expired=await projector.expireObservations(observationsBefore);
      const fingerprint=P.hash(input),key=P.hash(['retention',operationId]);
      return await tx(raw=>{
        const state=M.state(raw),old=state.operations[key];
        if (old) {
          if (old.fingerprint!==fingerprint) P.fail('REPLAY_CONFLICT','Deze retention-operatie hoort bij andere invoer.',409);
          return {...P.clone(old.result),replay:true};
        }
        const removed=[];
        for (const [id,recall] of Object.entries(state.recalls)) if (recall.recalledAt<recallsBefore) {
          removed.push(id); delete state.recalls[id];
        }
        for (const [id,operation] of Object.entries(state.operations)) {
          const recallId=operation.result && (operation.result.recall && operation.result.recall.recallId || operation.result.recallId);
          if (recallId && removed.includes(recallId)) delete state.operations[id];
        }
        const result={ok:true,expiredObservations:expired.expired,removedRecalls:removed.length,replay:false};
        state.operations[key]={fingerprint,result:P.clone(result)}; Object.assign(raw,state); return result;
      });
    } catch(e) { return P.error(e); }
  }
  const proofFor=(actorRef,consumer)=>projector.proofFor(actorRef,consumer);
  return {ingest:projector.ingest,sync,syncSource,inbox,inboxFor,candidates,present,disposition,
    consumerForRecall,sweepRetention,rebuild:projector.rebuild,proof:projector.proof,proofFor,
    operations:operations.snapshot,validateDecisionContext,_read:read};
};
