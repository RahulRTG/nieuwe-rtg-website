'use strict';

const P=require('./protocol'),M=require('./model'),envelope=require('../envelop');

module.exports=function projection({read,tx,time,livingWorld,workSource}) {
  const relationId=(from,relation,to)=>'lin_'+P.hash([P.refKey(from),relation,P.refKey(to)]).slice(0,32);
  function lineage(state,from,relation,to,source) {
    const id=relationId(from,relation,to);
    state.lineage[id]={id,from:P.clone(from),relation,to:P.clone(to),originatingDomain:source.domain,
      eventRef:source.eventRef || null,receiptRef:source.receiptRef || null,assertedAt:source.at,
      visibility:source.visibility || 'restricted',provenance:P.clone(source.provenance || null),
      causalClaim:false,status:'asserted'};
  }
  function project(state,event) {
    if (event.protocol) {
      const observation=P.clone(event.protocol),id=observation.objectRef.id;
      state.observations[id]={eventId:event.id,eventHash:P.hash(event),record:{objectRef:observation.objectRef,
        placeRef:observation.placeRef,planRef:observation.planRef,blueprintRef:observation.blueprintRef,
        status:observation.status,sharing:observation.sharing,recordedAt:observation.recordedAt,
        verificationOf:observation.verificationOf,assessment:observation.assessment}};
      lineage(state,observation.objectRef,'observed_at',observation.placeRef,{domain:'living-world',eventRef:event.id,
        at:observation.recordedAt,visibility:observation.sharing.visibility,provenance:{basis:observation.basis}});
      if (observation.planRef) lineage(state,observation.planRef,'produced_observation',observation.objectRef,
        {domain:'living-world',eventRef:event.id,at:observation.recordedAt,visibility:observation.sharing.visibility});
      if (observation.verificationOf) lineage(state,observation.verificationOf,'observed_after_change',observation.objectRef,
        {domain:'living-world',eventRef:event.id,at:observation.observedAt,visibility:observation.sharing.visibility,
          provenance:{assessment:observation.assessment,note:'temporal-verification-not-causality'}});
    }
    if (event.receipt) {
      const receipt=P.clone(event.receipt),receiptRef={domain:'workos',type:'change-receipt',id:receipt.receiptId,version:1};
      state.changes[receipt.receiptId]={eventId:event.id,eventHash:P.hash(event),receipt};
      lineage(state,receipt.observationRef,'informed_decision',receipt.decisionRef,{domain:'workos',eventRef:event.id,
        receiptRef:receipt.receiptId,at:receipt.appliedAt,visibility:'workspace',provenance:{contextHash:receipt.expectation.contextHash}});
      lineage(state,receipt.decisionRef,'authorized_change',receipt.newRef,{domain:'workos',eventRef:event.id,
        receiptRef:receipt.receiptId,at:receipt.appliedAt,visibility:'workspace'});
      lineage(state,receipt.newRef,'confirmed_by',receiptRef,{domain:'workos',eventRef:event.id,
        receiptRef:receipt.receiptId,at:receipt.appliedAt,visibility:'workspace'});
    }
  }
  async function ingest(event) {
    try {
      if (!event || typeof event!=='object' || !event.id) P.fail('INVALID_EVENT','Een bron-event mist een ID.');
      const fingerprint=P.hash(event);
      return await tx(raw=>{
        const state=M.state(raw),previous=state.consumed[event.id];
        if (previous) {
          if (previous!==fingerprint) P.fail('SOURCE_EVENT_CONFLICT','Een bron-event met dezelfde ID heeft andere inhoud.',409);
          return {ok:true,replay:true,eventId:event.id};
        }
        project(state,event); state.consumed[event.id]=fingerprint;
        const at=time(),env=envelope.maak({id:'lfa_'+P.hash(event.id).slice(0,28),at,kanaal:'loop-fabric',actor:'systeem',
          correlatie:event.envelop && event.envelop.correlatie || event.id,
          oorzaak:event.envelop && event.envelop.id || event.id,classificatie:'intern'});
        M.append(state,'source.ingested',{eventId:event.id},at,env);
        if (Buffer.byteLength(P.canonical(state))>25*1024*1024)
          P.fail('CAPACITY','De Loop Fabric-projectie vraagt onderhoud; er is niets verwijderd.',503);
        Object.assign(raw,state); return {ok:true,replay:false,eventId:event.id};
      });
    } catch(e) { return P.error(e); }
  }
  async function rebuild(workspaceCodes=[]) {
    try {
      const events=[...livingWorld.protocolEvents(),...workspaceCodes.flatMap(code=>workSource.protocolEvents(code))];
      return await tx(raw=>{
        const state=M.state(raw); state.consumed={}; state.observations={}; state.changes={}; state.lineage={};
        for (const event of events) { project(state,event); state.consumed[event.id]=P.hash(event); }
        const at=time(),env=envelope.maak({id:'lfb_'+P.hash([at,events.map(e=>e.id)]).slice(0,28),at,kanaal:'loop-fabric',
          actor:'systeem',correlatie:null,oorzaak:null,classificatie:'intern'});
        M.append(state,'index.rebuilt',{events:events.length},at,env); Object.assign(raw,state);
        return {ok:true,events:events.length,observations:Object.keys(state.observations).length,
          changes:Object.keys(state.changes).length,lineage:Object.keys(state.lineage).length};
      });
    } catch(e) { return P.error(e); }
  }
  function proof(actorRef,workspaceCode) {
    const authority=workSource.authorization(actorRef,workspaceCode,['kennis']); if (!authority.ok) return authority;
    const state=read(),changeIds=new Set(Object.values(state.changes).filter(x=>x.receipt.context.workspaceCode===authority.workspaceCode)
      .map(x=>x.receipt.receiptId));
    const changes=Object.values(state.changes).filter(x=>changeIds.has(x.receipt.receiptId));
    const refs=new Set(changes.flatMap(x=>[P.refKey(x.receipt.observationRef),P.refKey(x.receipt.decisionRef),
      P.refKey(x.receipt.newRef),P.refKey({domain:'workos',type:'change-receipt',id:x.receipt.receiptId,version:1})]));
    const lineageRows=Object.values(state.lineage).filter(x=>refs.has(P.refKey(x.from)) || refs.has(P.refKey(x.to)) || changeIds.has(x.receiptRef));
    const recalls=Object.values(state.recalls).filter(x=>x.actorRef===actorRef && x.context.workspaceCode===authority.workspaceCode);
    return {ok:true,changes:P.clone(changes),lineage:P.clone(lineageRows),recalls:P.clone(recalls),
      integrity:M.verify(state.journal),scope:'projection-integrity-not-source-truth-or-causality'};
  }
  return {ingest,rebuild,proof};
};
