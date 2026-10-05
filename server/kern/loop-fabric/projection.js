'use strict';

const P=require('./protocol'),M=require('./model'),envelope=require('../envelop'),invariants=require('./invariants');
const eligibility=require('./learning-eligibility');

module.exports=function projection({read,tx,time,livingWorld,workSource,sourceAdapters}) {
  const proof=require('./proof')({read,workSource,sourceAdapters});
  const {lineage,tombstone,minimalReceipt}=require('./projection-records')(P);
  function project(state,event) {
    if (event.protocol) {
      const observation=P.clone(event.protocol),id=P.refKey(observation.objectRef);
      const unavailable=['withdrawn','deleted','expired','anonymized'].includes(observation.status) ||
        (observation.validUntil && observation.validUntil<=time());
      if (unavailable) {
        tombstone(state,observation.objectRef,observation.status==='accepted' ? 'expired' : observation.status,
          observation.recordedAt || event.at || time());
        return;
      }
      const eligible=eligibility.issue(observation.eligibility);
      if (P.refKey(eligible.sourceRef)!==id||eligible.purpose!==observation.sharing.purpose)
        P.fail('ELIGIBILITY_MISMATCH','Source-issued eligibility hoort niet bij deze Observation of purpose.',403);
      state.observations[id]={eventId:event.id,eventHash:P.hash(event),record:{objectRef:observation.objectRef,
        subjectRef:observation.subjectRef || observation.placeRef,scopeRefs:observation.scopeRefs ||
          [observation.placeRef,observation.blueprintRef].filter(Boolean),placeRef:observation.placeRef,
        planRef:observation.planRef,blueprintRef:observation.blueprintRef,
        status:observation.status,sharing:observation.sharing,recordedAt:observation.recordedAt,
        validUntil:observation.validUntil || null,verificationOf:observation.verificationOf,assessment:observation.assessment,
        eligibility:eligibility.minimal(eligible)}};
      const subject=observation.subjectRef || observation.placeRef;
      lineage(state,observation.objectRef,'observed_at',subject,{domain:observation.objectRef.domain,eventRef:event.id,
        at:observation.recordedAt,visibility:observation.sharing.visibility,provenance:{basis:observation.basis}});
      if (observation.planRef) lineage(state,observation.planRef,'produced_observation',observation.objectRef,
        {domain:observation.objectRef.domain,eventRef:event.id,at:observation.recordedAt,visibility:observation.sharing.visibility});
      if (observation.verificationOf) lineage(state,observation.verificationOf,'observed_after_change',observation.objectRef,
        {domain:observation.objectRef.domain,eventRef:event.id,at:observation.observedAt,visibility:observation.sharing.visibility,
          provenance:{assessment:observation.assessment,note:'temporal-verification-not-causality'}});
    }
    if (event.receipt) {
      const verifier=sourceAdapters && sourceAdapters[event.receipt.sourceDomain];
      const verified=verifier && typeof verifier.verifyReceipt==='function' ? verifier.verifyReceipt(event.receipt)
        : {ok:true,mode:'same-process-unverified'};
      if (!verified.ok) P.fail(verified.code || 'SERVICE_PROOF_INVALID',verified.error || 'Servicebewijs ongeldig.',403);
      const receipt=minimalReceipt(event.receipt),receiptRef={domain:receipt.sourceDomain,type:'change-receipt',id:receipt.receiptId,version:1};
      state.changes[receipt.receiptId]={eventId:event.id,eventHash:P.hash(event),receipt,serviceVerification:verified.mode};
      lineage(state,receipt.observationRef,'informed_decision',receipt.decisionRef,{domain:receipt.sourceDomain,eventRef:event.id,
        receiptRef:receipt.receiptId,at:receipt.appliedAt,visibility:'workspace',provenance:{contextHash:receipt.expectation.contextHash}});
      lineage(state,receipt.decisionRef,'authorized_change',receipt.newRef,{domain:receipt.sourceDomain,eventRef:event.id,
        receiptRef:receipt.receiptId,at:receipt.appliedAt,visibility:'workspace'});
      lineage(state,receipt.newRef,'confirmed_by',receiptRef,{domain:receipt.sourceDomain,eventRef:event.id,
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
        invariants.projection(state);
        if (Buffer.byteLength(P.canonical(state))>25*1024*1024)
          P.fail('CAPACITY','De Loop Fabric-projectie vraagt onderhoud; er is niets verwijderd.',503);
        Object.assign(raw,state); return {ok:true,replay:false,eventId:event.id};
      });
    } catch(e) { return P.error(e); }
  }
  async function rebuild(workspaceCodes=[],sourceScopes={}) {
    try {
      const events=[...livingWorld.protocolEvents(),...workspaceCodes.flatMap(code=>workSource.protocolEvents(code))];
      for (const [domain,scopes] of Object.entries(sourceScopes || {})) {
        const source=sourceAdapters && sourceAdapters[domain];
        if (!source || source===livingWorld || source===workSource || typeof source.protocolEvents!=='function') continue;
        for (const scope of scopes || []) events.push(...source.protocolEvents(scope));
      }
      const rank=event=>event.protocol && ['withdrawn','deleted','expired','anonymized'].includes(event.protocol.status) ? 2
        : event.receipt ? 1 : 0;
      events.sort((a,b)=>String(a.at || a.protocol && a.protocol.recordedAt || a.receipt && a.receipt.appliedAt || '')
        .localeCompare(String(b.at || b.protocol && b.protocol.recordedAt || b.receipt && b.receipt.appliedAt || '')) ||
        rank(a)-rank(b) || String(a.id).localeCompare(String(b.id)));
      return await tx(raw=>{
        const state=M.state(raw); state.consumed={}; state.observations={}; state.changes={}; state.lineage={};
        for (const event of events) { project(state,event); state.consumed[event.id]=P.hash(event); }
        const at=time(),env=envelope.maak({id:'lfb_'+P.hash([at,events.map(e=>e.id)]).slice(0,28),at,kanaal:'loop-fabric',
          actor:'systeem',correlatie:null,oorzaak:null,classificatie:'intern'});
        M.append(state,'index.rebuilt',{events:events.length},at,env); invariants.projection(state); Object.assign(raw,state);
        return {ok:true,events:events.length,observations:Object.keys(state.observations).length,
          changes:Object.keys(state.changes).length,lineage:Object.keys(state.lineage).length};
      });
    } catch(e) { return P.error(e); }
  }
  async function expireObservations(before=time()) {
    P.instant(before,'retention_before');
    return tx(raw=>{
      const state=M.state(raw),expired=[];
      for (const row of Object.values(state.observations)) if (row.record.validUntil && row.record.validUntil<=before &&
          row.record.objectRef.type!=='tombstone') {
        expired.push(P.clone(row.record.objectRef)); tombstone(state,row.record.objectRef,'expired',before);
      }
      invariants.projection(state); Object.assign(raw,state); return {ok:true,expired:expired.length};
    });
  }
  return {ingest,rebuild,expireObservations,proof:proof.proof,proofFor:proof.proofFor};
};
