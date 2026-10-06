'use strict';

const P=require('./protocol'), M=require('./model'), envelope=require('../envelop');
const klok=require('../../lib/klok');

module.exports=function makeLoopFabric({db,bewerkCollectie,livingWorld,workSource,academySource,librarySource,now}) {
  const own=require('../eigencollectie')({db,domein:'kern/loop-fabric',bezit:{loopFabric:'kaart'}});
  const time=now || (()=>klok.datum().toISOString());
  const read=()=>M.state(own.kijk('loopFabric'));
  const tx=fn=>{
    if (typeof bewerkCollectie!=='function') P.fail('STORAGE_UNAVAILABLE','De Loop Fabric vereist duurzame collectietransacties.',503);
    return bewerkCollectie('loopFabric',fn);
  };
  const sourceAdapters={'living-world':livingWorld,workos:workSource};
  if (academySource) sourceAdapters.leerhuis=academySource;
  if (librarySource) sourceAdapters.library=librarySource;
  const projector=require('./projection')({read,tx,time,livingWorld,workSource,sourceAdapters});
  const operations=require('./operations')({read,sourceAdapters,time});
  const query=require('./recall-query')({read,sourceAdapters,time});
  const {target,consumerOf,authorityFor,inbox,inboxFor,candidates}=query;
  const validateDecisionContext=require('./decision-context')({read,workSource,sourceAdapters,time,target});
  function registerSource(domain,source) {
    const id=P.text(domain,60);
    if(sourceAdapters[id]&&sourceAdapters[id]!==source)
      P.fail('SOURCE_ALREADY_REGISTERED','Dit brondomein heeft al een Loop Fabric-adapter.',409);
    for(const method of ['deliver','protocolEvents','resolveObservation','learningEligibility'])
      if(!source||typeof source[method]!=='function')P.fail('SOURCE_ADAPTER_INVALID','De bronadapter mist '+method+'.');
    sourceAdapters[id]=source;return {ok:true,domain:id};
  }
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
    const additional={};
    if(workspaceCode)for(const [domain,source] of Object.entries(sourceAdapters)){
      if(['living-world','workos'].includes(domain)||source.consumerDomain!=='workos')continue;
      additional[domain]=await source.deliver(workspaceCode,'loop-fabric',async event=>{
        const result=await projector.ingest(event);if(!result.ok)throw Object.assign(new Error(result.error),result);
      });
    }
    return {ok:true,world,work,returned,additional};
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
  return {ingest:projector.ingest,sync,syncSource,registerSource,inbox,inboxFor,candidates,present,disposition,
    consumerForRecall,sweepRetention,rebuild:projector.rebuild,proof:projector.proof,proofFor,
    operations:operations.snapshot,validateDecisionContext,_read:read};
};
