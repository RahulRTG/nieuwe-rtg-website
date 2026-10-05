'use strict';
const P=require('./protocol');
module.exports=({read,sourceAdapters,time})=>{
  const target=code=>({domain:'workos',id:String(code||'').trim().toUpperCase()});
  const consumerOf=context=>context&&context.consumer?{domain:P.text(context.consumer.domain,60),id:P.text(context.consumer.id,160)}:
    target(context&&context.workspaceCode);
  const authorityFor=(actor,consumer,required,context)=>{
    const adapter=sourceAdapters[consumer.domain];
    return !adapter||typeof adapter.authorization!=='function'?{ok:false,error:'Het ontvangende domein heeft geen authority-adapter.',
      status:503,code:'AUTHORITY_UNAVAILABLE'}:adapter.authorization(actor,consumer.id,required,context);
  };
  function inboxFor(actorRef,consumer) {
    const authority=authorityFor(actorRef,consumer,['besluit'],{action:'observation.review'});if(!authority.ok)return authority;
    const items=[],seen=new Set();
    for(const indexed of Object.values(read().observations)) {
      const record=indexed.record,shares=(record.sharing.recipients||[]).some(r=>r.domain===consumer.domain&&r.id===consumer.id);
      if(!shares||['withdrawn','deleted','expired','rejected'].includes(record.status))continue;
      const source=sourceAdapters[record.objectRef.domain];if(!source||typeof source.resolveObservation!=='function'||
        typeof source.learningEligibility!=='function')continue;
      const eligible=source.learningEligibility(record.objectRef,consumer,{purpose:record.sharing.purpose,use:'decision'});
      if(!eligible.ok)continue;
      const resolved=source.resolveObservation(record.objectRef,consumer);
      if(!resolved.ok||['withdrawn','deleted','expired','rejected'].includes(resolved.observation.status))continue;
      const observation=resolved.observation,key=P.refKey(observation.objectRef);if(seen.has(key))continue;seen.add(key);
      items.push({observationRef:observation.objectRef,observationHash:P.hash(observation),title:observation.title,text:observation.text,
        occurredAt:observation.observedAt,recordedAt:observation.recordedAt,sourceActorRef:observation.sourceActorRef,
        visibility:observation.sharing.visibility,purpose:observation.sharing.purpose,subjectRef:observation.subjectRef||observation.placeRef,
        scopeRefs:P.clone(observation.scopeRefs||[observation.placeRef,observation.blueprintRef].filter(Boolean)),
        placeRef:observation.placeRef,blueprintRef:observation.blueprintRef,status:observation.contests.length?'contested':
          resolved.corrected?'corrected':'current',contests:observation.contests,provenance:{basis:observation.basis,review:observation.review},
        why:'Deze brongebonden observatie is voor dit doel gericht aan '+consumer.domain+' '+consumer.id+'.'});
    }
    items.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));return {ok:true,consumer,items};
  }
  const inbox=(actor,code)=>{const out=inboxFor(actor,target(code));return out.ok?{...out,workspaceCode:out.consumer.id}:out;};
  const scopes=context=>{
    const rows=Array.isArray(context.scopeRefs)?context.scopeRefs:[context.placeRef,context.blueprintRef,context.subjectRef].filter(Boolean);
    if(!rows.length)P.fail('INVALID_INPUT','Recall vereist ten minste één brongebonden scope.');
    return rows.map(ref=>P.objectRef(ref,{versioned:false}));
  };
  const same=(a,b)=>a.domain===b.domain&&a.type===b.type&&a.id===b.id;
  const unavailable=(receipt,code,detail)=>({changeReceiptId:receipt.receiptId,
    status:({SOURCE_DENIED:'denied',PURPOSE_DENIED:'denied',AUTHORITY_REVOKED:'denied',SOURCE_MISSING:'source_missing',
      NOT_FOUND:'source_missing',SOURCE_EXPIRED:'stale',SOURCE_WITHDRAWN:'unavailable',SOURCE_NOT_AVAILABLE:'unavailable',
      SOURCE_CHANGED:'stale',CHECK_NOT_RUN:'not_checked'}[code]||'unavailable'),reasonCode:code||'SOURCE_UNAVAILABLE',
    source:{domain:receipt.observationRef.domain,refHash:P.hash(P.refKey(receipt.observationRef))},
    why:detail||'De actuele bron kon deze context niet beschikbaar stellen.'});
  function candidates(actorRef,context) {
    P.fields(context,['workspaceCode','consumer','placeRef','blueprintRef','subjectRef','scopeRefs','action','purpose']);
    const consumer=consumerOf(context),authority=authorityFor(actorRef,consumer,['kennis'],context);if(!authority.ok)return authority;
    const wanted=scopes(context),action=P.text(context.action,100),purpose=P.text(context.purpose,120),items=[],outcomes=[];
    for(const entry of Object.values(read().changes)) {
      const receipt=entry.receipt,rc=receipt.context||{},available=[...(rc.scopeRefs||[rc.placeRef,rc.blueprintRef].filter(Boolean)),
        receipt.previousRef,receipt.newRef].filter(Boolean),recipient=rc.consumer||(rc.workspaceCode?{domain:'workos',id:rc.workspaceCode}:
          rc.organizationCode?{domain:'leerhuis',id:rc.organizationCode}:null);
      if(!recipient||recipient.domain!==consumer.domain||recipient.id!==consumer.id||rc.purpose!==purpose||
          !wanted.every(scope=>available.some(row=>same(scope,row))))continue;
      const source=sourceAdapters[receipt.observationRef.domain],changeSource=sourceAdapters[receipt.sourceDomain];
      if(!source||typeof source.resolveObservation!=='function'||typeof source.learningEligibility!=='function'){
        outcomes.push(unavailable(receipt,'ELIGIBILITY_UNAVAILABLE'));continue;}
      const eligible=source.learningEligibility(receipt.observationRef,consumer,{purpose,use:'recall'});
      if(!eligible.ok){outcomes.push(unavailable(receipt,eligible.code,eligible.error));continue;}
      const observed=source.resolveObservation(receipt.observationRef,consumer);
      if(!observed.ok){outcomes.push(unavailable(receipt,observed.code,observed.error));continue;}
      if(!changeSource||typeof changeSource.artifact!=='function'){outcomes.push(unavailable(receipt,'SOURCE_UNAVAILABLE'));continue;}
      const artifact=changeSource.artifact(actorRef,consumer.id,receipt.newRef);
      if(!artifact.ok){outcomes.push(unavailable(receipt,artifact.code,artifact.error));continue;}
      const observation=observed.observation,contested=observation.contests.length>0;
      if(observation.sharing.purpose!==purpose){outcomes.push(unavailable(receipt,'PURPOSE_DENIED'));continue;}
      if(observation.validUntil&&observation.validUntil<=time()){outcomes.push(unavailable(receipt,'SOURCE_EXPIRED'));continue;}
      const status=!artifact.current?'superseded-change':contested?'contested':observed.corrected?'corrected':'current';
      items.push({candidateId:'recall_'+P.hash([receipt.receiptId,P.refKey(observation.objectRef),wanted.map(P.refKey),action]).slice(0,28),
        reason:'Een eerdere observatie binnen deze context was input voor een door het brondomein bevestigde wijziging.',action,status,
        source:{observationRef:observation.objectRef,changeReceiptId:receipt.receiptId,changeRef:artifact.currentRef,
          procedureRef:receipt.newRef.type==='procedure'?artifact.currentRef:undefined},
        ageSeconds:Math.max(0,Math.floor((Date.parse(time())-Date.parse(observation.observedAt))/1000)),observedAt:observation.observedAt,
        appliedAt:receipt.appliedAt,contests:P.clone(observation.contests),correction:observed.corrected?
          {requested:receipt.observationRef,current:observation.objectRef}:null,expectation:P.clone(receipt.expectation),
        policy:{decision:'allow',policyId:'loop-recall-workspace-visibility',version:1,reasonCodes:['current-workspace-authority',
          'purpose-exactly-matched','source-sharing-allows-purpose','source-resolved-live']},visibility:observation.sharing.visibility,
        purpose:observation.sharing.purpose});
    }
    items.sort((a,b)=>b.appliedAt.localeCompare(a.appliedAt));return {ok:true,consumer,asOf:time(),items,outcomes};
  }
  return {target,consumerOf,authorityFor,inbox,inboxFor,candidates};
};
