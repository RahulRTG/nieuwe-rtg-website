'use strict';
const P=require('../loop-fabric/protocol'),E=require('../loop-fabric/learning-eligibility');
const serviceReceipt=require('../loop-fabric/service-receipt'),policy=require('./policy'),M=require('./model');

module.exports=function makeLibraryLoopSource({read,deliver,identities,time,serviceProof}) {
  const workRef=work=>({domain:'library',type:'work',id:work.id,version:null});
  const observationRef=feedback=>({domain:'library',type:'feedback-observation',id:feedback.id,version:feedback.createdAt});
  const editionRef=(work,edition)=>({domain:'library',type:'edition',id:work.id+':'+edition.id,version:edition.snapshotHash});
  function work(id){const row=read().works[String(id||'')];if(!row)P.fail('SOURCE_MISSING','Dit Library Work bestaat niet meer.',404);return row;}
  function libraryContext(actor,row){return {actor,identities,w:row};}
  function authorization(actorRef,workId,required=['kennis']) {
    try {const row=work(workId),ctx=libraryContext(actorRef,row);if(!identities.exists(actorRef)||!policy.member(ctx))
      P.fail('AUTHORITY_REVOKED','De actuele Library-relatie geeft geen toegang.',403);
      if(required.includes('besluit'))policy.editor(ctx);
      return {ok:true,workId:row.id,actorRef,rights:required.slice(),policy:{id:'library.kernel',version:1}};
    } catch(error){return P.error(error);}
  }
  function eligibility(feedback,row) {
    return E.issue({sourceRef:observationRef(feedback),purpose:'library-content-improvement',memoryClass:'RELATIONSHIP_SHARED',
      audience:[{domain:'library',id:row.id}],basis:{type:'VOLUNTARY_CONTENT_FEEDBACK'},
      allowedFields:['kind','message','evidenceRefs','status','decision','resolution'],uses:{decision:true,recall:true,
        'cross-domain':false,ai:false,aggregate:false,publish:false},issuedAt:feedback.createdAt,validUntil:null,
      retention:{mode:'SOURCE_LIFECYCLE',policyId:'library.feedback.lifecycle.v1'},epistemicType:'HUMAN_STATED',
      capabilityId:'dom-library'});
  }
  function observation(row,feedback) {
    const subject={domain:'library',type:'edition',id:row.id+':'+feedback.editionId,version:feedback.revisionHash};
    return {objectRef:observationRef(feedback),subjectRef:subject,scopeRefs:[workRef(row),subject,
      {domain:'library',type:'content-node',id:row.id+':'+feedback.nodeId,version:feedback.revisionHash}],
      title:'Inhoudelijke feedback: '+feedback.kind,text:feedback.message,observedAt:feedback.createdAt,
      recordedAt:feedback.createdAt,sourceActorRef:feedback.createdBy,status:feedback.status,
      sharing:{visibility:'work',purpose:'library-content-improvement',recipients:[{domain:'library',id:row.id}],
        consent:true,returnUpdates:true},basis:'voluntary-content-feedback',review:feedback.decision,
      contests:feedback.status==='rejected'?[{status:'contested',reason:feedback.decision.reason,
        assertedBy:feedback.decision.actor,at:feedback.decision.at}]:[],verificationOf:feedback.verificationOf||null,
      assessment:feedback.assessment||null,
      eligibility:eligibility(feedback,row)};
  }
  function receipt(row,feedback,edition,event) {
    const previous=row.editions[feedback.editionId],value={receiptId:'libcr_'+P.hash([row.id,feedback.id,edition.id,event.hash]).slice(0,28),
      sourceDomain:'library',sourceObject:{domain:'library',type:'work',id:row.id,version:null},
      previousRef:editionRef(row,previous),newRef:editionRef(row,edition),changeType:'edition.feedback-published',
      decisionRef:{domain:'library',type:'feedback-decision',id:feedback.id,version:feedback.decision.at},
      observationRef:observationRef(feedback),appliedAt:edition.releasedAt,
      context:{consumer:{domain:'library',id:row.id},scopeRefs:[workRef(row)],purpose:'library-content-improvement'},
      expectation:{contextHash:null},operationId:event.operationId,correlationId:event.envelop.correlatie,
      integrityRef:{auditId:event.envelop.id,hash:event.hash},protocolVersion:1};
    if(serviceProof&&typeof serviceProof.tekenBericht==='function')
      value.serviceProof=serviceProof.tekenBericht('rtg.service.library',value,{issuedAt:value.appliedAt});
    return value;
  }
  function mapped(event,workId) {
    if(event.workId!==workId)return [];
    const row=work(workId);
    if(event.action==='feedback.create') {const feedback=row.feedback[event.result.id];return feedback?[{id:'libloop_'+event.envelop.id,
      sequence:event.sequence,at:feedback.createdAt,type:'library.feedback.observed',protocol:observation(row,feedback),envelop:event.envelop}]:[];}
    if(event.action!=='publication.confirm')return [];
    const edition=row.editions[event.result.editionId];if(!edition||edition.status!=='released')return [];
    return Object.values(row.feedback).filter(f=>f.status==='resolved'&&f.editionId===edition.predecessorId&&
      edition.snapshot.content.some(node=>node.nodeId===f.nodeId&&node.revision.id===f.resolution.revisionId))
      .map(f=>({id:'libloop_'+P.hash([event.envelop.id,f.id]).slice(0,28),sequence:event.sequence,at:edition.releasedAt,
        type:'library.change.applied',receipt:receipt(row,f,edition,event),envelop:event.envelop}));
  }
  function libraryProtocolEvents(workId){return read().journal.flatMap(event=>mapped(event,workId));}
  function hasReceipt(workId,ref) {try {const r=P.objectRef(ref);return r.domain==='library'&&r.type==='change-receipt'&&
    libraryProtocolEvents(workId).some(event=>event.receipt&&event.receipt.receiptId===r.id&&r.version===1);}catch{return false;}}
  async function deliverScope(workId,consumer,handle,limit=100){
    const scoped=consumer+'.'+P.hash(workId).slice(0,16);
    return deliver(scoped,async event=>{for(const row of mapped(event,workId))await handle(row);},limit);
  }
  function resolveLibraryObservation(ref,recipient) {
    try {const r=P.objectRef(ref),row=work(recipient&&recipient.id),feedback=row.feedback[r.id];
      if(r.domain!=='library'||r.type!=='feedback-observation'||!feedback||feedback.createdAt!==r.version)
        P.fail('SOURCE_MISSING','Deze Library-feedback bestaat niet meer.',404);
      return {ok:true,observation:observation(row,feedback),corrected:false};
    } catch(error){return P.error(error);}
  }
  function evaluateLibraryEligibility(ref,recipient,request={}) {const resolved=resolveLibraryObservation(ref,recipient);if(!resolved.ok)return resolved;
    return E.evaluate(resolved.observation.eligibility,{sourceRef:ref,purpose:request.purpose,recipient,use:request.use||'recall'},time());}
  function artifact(actorRef,workId,ref) {const allowed=authorization(actorRef,workId,['kennis']);if(!allowed.ok)return allowed;
    try {const r=P.objectRef(ref),row=work(workId),prefix=row.id+':';if(r.domain!=='library'||r.type!=='edition'||!r.id.startsWith(prefix))
      P.fail('NOT_FOUND','Deze Library Edition bestaat niet.',404);const edition=row.editions[r.id.slice(prefix.length)];
      if(!edition||edition.snapshotHash!==r.version||edition.status!=='released')P.fail('NOT_FOUND','Deze Edition is niet vrijgegeven.',404);
      const released=Object.values(row.editions).filter(x=>x.status==='released').sort((a,b)=>a.releasedAt.localeCompare(b.releasedAt));
      const current=released.at(-1).id===edition.id;return {ok:true,artifact:{id:edition.id,contentHash:edition.contentHash},current,
        currentRef:editionRef(row,released.at(-1))};}catch(error){return P.error(error);}}
  function verifyReceipt(value){return serviceReceipt.verify(serviceProof,value,{domain:'library',issuer:'rtg.service.library',label:'Library'});}
  return {authorization,artifact,resolveObservation:resolveLibraryObservation,learningEligibility:evaluateLibraryEligibility,
    protocolEvents:libraryProtocolEvents,deliver:deliverScope,verifyReceipt,hasReceipt};
};
