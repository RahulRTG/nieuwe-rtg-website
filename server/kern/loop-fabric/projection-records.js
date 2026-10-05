'use strict';

module.exports=function projectionRecords(P) {
  const relationId=(from,relation,to)=>'lin_'+P.hash([P.refKey(from),relation,P.refKey(to)]).slice(0,32);
  function lineage(state,from,relation,to,source) {
    const id=relationId(from,relation,to);
    state.lineage[id]={id,from:P.clone(from),relation,to:P.clone(to),originatingDomain:source.domain,
      eventRef:source.eventRef || null,receiptRef:source.receiptRef || null,assertedAt:source.at,
      visibility:source.visibility || 'restricted',provenance:P.clone(source.provenance || null),
      causalClaim:false,status:'asserted'};
  }
  function tombstone(state,ref,status,at) {
    const key=P.refKey(ref),tombstoneRef={domain:ref.domain,type:'tombstone',id:P.hash(key).slice(0,32),version:at};
    const old=state.observations[key] || state.observations[ref.id];
    delete state.observations[key]; delete state.observations[ref.id];
    state.observations[P.refKey(tombstoneRef)]={eventId:old && old.eventId || null,eventHash:old && old.eventHash || null,
      record:{objectRef:tombstoneRef,status,sharing:{visibility:'restricted',purpose:'unlinked',recipients:[]},
        recordedAt:at,sourceRefHash:P.hash(key)}};
    const rebuilt={};
    for (const row of Object.values(state.lineage)) {
      const next=P.clone(row);
      if (P.refKey(next.from)===key) next.from=tombstoneRef;
      if (P.refKey(next.to)===key) next.to=tombstoneRef;
      if (P.refKey(next.from)!==P.refKey(row.from) || P.refKey(next.to)!==P.refKey(row.to)) {
        next.status=status; next.visibility='restricted'; next.provenance={reason:'source-unlinked',status};
      }
      next.id=relationId(next.from,next.relation,next.to); rebuilt[next.id]=next;
    }
    state.lineage=rebuilt;
    for (const change of Object.values(state.changes)) if (P.refKey(change.receipt.observationRef)===key) {
      change.receipt.observationRef=tombstoneRef; change.sourceObservationStatus=status;
    }
    return tombstoneRef;
  }
  function minimalReceipt(value) {
    const r=P.clone(value),context=r.context || {};
    return P.clone({receiptId:r.receiptId,sourceDomain:r.sourceDomain,sourceObject:r.sourceObject,previousRef:r.previousRef,
      newRef:r.newRef,changeType:r.changeType,decisionRef:r.decisionRef,observationRef:r.observationRef,
      appliedAt:r.appliedAt,context:{workspaceCode:context.workspaceCode,organizationCode:context.organizationCode,
        consumer:context.consumer,scopeRefs:context.scopeRefs || [context.placeRef,context.blueprintRef].filter(Boolean),
        placeRef:context.placeRef,blueprintRef:context.blueprintRef,purpose:context.purpose},
      expectation:{contextHash:r.expectation && r.expectation.contextHash || null},integrityRef:r.integrityRef,
      serviceProof:r.serviceProof,protocolVersion:r.protocolVersion || 1});
  }
  return {lineage,tombstone,minimalReceipt};
};
