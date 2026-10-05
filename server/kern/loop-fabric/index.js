'use strict';

const P=require('./protocol'), M=require('./model'), envelope=require('../envelop');
const klok=require('../../lib/klok');

module.exports=function makeLoopFabric({db,bewerkCollectie,livingWorld,workSource,now}) {
  const own=require('../eigencollectie')({db,domein:'kern/loop-fabric',bezit:{loopFabric:'kaart'}});
  const time=now || (()=>klok.datum().toISOString());
  const read=()=>M.state(own.kijk('loopFabric'));
  const tx=fn=>{
    if (typeof bewerkCollectie!=='function') P.fail('STORAGE_UNAVAILABLE','De Loop Fabric vereist duurzame collectietransacties.',503);
    return bewerkCollectie('loopFabric',fn);
  };
  const projector=require('./projection')({read,tx,time,livingWorld,workSource});
  const validateDecisionContext=require('./decision-context')({read,livingWorld,workSource,time,target});
  const observationSources={'living-world':livingWorld,workos:workSource};
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
  function target(workspaceCode) { return {domain:'workos',id:String(workspaceCode||'').trim().toUpperCase()}; }
  function inbox(actorRef,workspaceCode) {
    const authority=workSource.authorization(actorRef,workspaceCode,['besluit']);
    if (!authority.ok) return authority;
    const state=read(), items=[],seen=new Set();
    for (const indexed of Object.values(state.observations)) {
      const record=indexed.record, shares=(record.sharing.recipients || []).some(r=>r.domain==='workos' && r.id===authority.workspaceCode);
      if (!shares || !['accepted','superseded'].includes(record.status)) continue;
      const source=observationSources[record.objectRef.domain];
      if (!source || typeof source.resolveObservation!=='function') continue;
      const resolved=source.resolveObservation(record.objectRef,target(authority.workspaceCode));
      if (!resolved.ok || resolved.observation.status!=='accepted') continue;
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
        why:'Deze vrijwillig gedeelde observatie is gericht aan werkruimte '+authority.workspaceCode+'.'});
    }
    items.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));
    return {ok:true,workspaceCode:authority.workspaceCode,items};
  }
  function contextScopes(context) {
    const rows=Array.isArray(context.scopeRefs) ? context.scopeRefs
      : [context.placeRef,context.blueprintRef,context.subjectRef].filter(Boolean);
    if (!rows.length) P.fail('INVALID_INPUT','Recall vereist ten minste één brongebonden scope.');
    return rows.map(ref=>P.objectRef(ref,{versioned:false}));
  }
  const sameScope=(left,right)=>left.domain===right.domain && left.type===right.type && left.id===right.id;
  function candidates(actorRef,context) {
    P.fields(context,['workspaceCode','placeRef','blueprintRef','subjectRef','scopeRefs','action','purpose']);
    const authority=workSource.authorization(actorRef,context.workspaceCode,['kennis']);
    if (!authority.ok) return authority;
    const scopes=contextScopes(context);
    const action=P.text(context.action,100),purpose=P.text(context.purpose,120), state=read(), items=[];
    for (const entry of Object.values(state.changes)) {
      const receipt=entry.receipt, rc=receipt.context || {};
      const receiptScopes=[...(rc.scopeRefs || [rc.placeRef,rc.blueprintRef].filter(Boolean)),receipt.previousRef,receipt.newRef]
        .filter(Boolean);
      if (rc.workspaceCode!==authority.workspaceCode || rc.purpose!==purpose ||
          !scopes.every(scope=>receiptScopes.some(row=>sameScope(scope,row)))) continue;
      const source=observationSources[receipt.observationRef.domain];
      if (!source || typeof source.resolveObservation!=='function') continue;
      const observationResult=source.resolveObservation(receipt.observationRef,target(authority.workspaceCode));
      if (!observationResult.ok) continue;
      const artifactResult=workSource.artifact(actorRef,authority.workspaceCode,receipt.newRef);
      if (!artifactResult.ok) continue;
      const observation=observationResult.observation, contested=observation.contests.length>0;
      if (observation.sharing.purpose!==purpose) continue;
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
    return {ok:true,workspaceCode:authority.workspaceCode,asOf:time(),items};
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
          candidates:P.clone(result.items),recalledAt:at,disposition:null};
        state.recalls[recallId]=recall;
        const env=envelope.maak({id:'lfr_'+key.slice(0,28),at,kanaal:'loop-fabric',actor:actorRef,
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
        const authority=workSource.authorization(actorRef,recall.context.workspaceCode,['kennis']);
        if (!authority.ok) P.fail(authority.code,authority.error,authority.status);
        if (recall.disposition) P.fail('ALREADY_DECIDED','Deze recall is al behandeld.',409);
        recall.disposition={decision:input.decision,reason:P.text(input.reason || '',500,false),at:time()};
        const out={ok:true,recallId:recall.recallId,disposition:P.clone(recall.disposition),replay:false};
        state.operations[key]={fingerprint,result:P.clone(out)}; Object.assign(raw,state); return out;
      });
    } catch(e) { return P.error(e); }
  }
  return {ingest:projector.ingest,sync,inbox,candidates,present,disposition,
    rebuild:projector.rebuild,proof:projector.proof,validateDecisionContext,_read:read};
};
