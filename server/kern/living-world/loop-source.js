'use strict';

const M = require('./model');
const envelope = require('../envelop');
const protocol = require('../loop-fabric/protocol');
const delivery = require('../loop-fabric/delivery');
const eligibility = require('../loop-fabric/learning-eligibility');

module.exports = function makeLivingWorldLoopSource({read,mutate,time}) {
  function learningEligibility(row) {
    const share=row.sharing || {visibility:'community',purpose:'world-memory',recipients:[],consent:{basis:'voluntary-contribution'}};
    const audience=share.visibility==='community'?[{domain:'living-world',id:'commons'}]:(share.recipients||[]);
    return eligibility.issue({sourceRef:{domain:'living-world',type:'observation',id:row.id,version:row.revision},
      purpose:share.purpose,memoryClass:share.visibility==='community'?'COMMONS':'RELATIONSHIP_SHARED',audience,
      basis:{type:share.consent&&share.consent.basis==='explicit'?'EXPLICIT_CONSENT':'VOLUNTARY_EXPLICIT_CONTRIBUTION'},
      allowedFields:['title','text','observedAt','status','contests','assessment'],uses:{decision:true,recall:true,'cross-domain':audience.some(x=>x.domain!=='living-world'),
        ai:false,aggregate:false,publish:false},issuedAt:row.recordedAt||row.createdAt,validUntil:row.validUntil||null,
      retention:{mode:'SOURCE_LIFECYCLE',policyId:'living-world.contribution.lifecycle.v1'},epistemicType:'HUMAN_STATED'});
  }
  function observationRecord(row) {
    if (!row) return null;
    return {objectRef:{domain:'living-world',type:'observation',id:row.id,version:row.revision},
      placeRef:{domain:'living-world',type:'place',id:row.placeId,version:row.placeVersion || null},
      planRef:row.planId ? {domain:'living-world',type:'plan',id:row.planId,version:row.planVersion || null} : null,
      blueprintRef:row.blueprintId ? {domain:'living-world',type:'blueprint',id:row.blueprintId,version:row.blueprintVersion || null} : null,
      sourceActorRef:row.owner,kind:row.kind,title:row.title,text:row.text,status:row.status,
      observedAt:row.observedAt,recordedAt:row.recordedAt || row.createdAt,validUntil:row.validUntil || null,
      basis:row.basis,sharing:M.clone(row.sharing || {visibility:'community',purpose:'world-memory',recipients:[]}),
      review:M.clone(row.review || null),contests:M.clone(row.contests || []),
      supersedes:row.supersedes || null,supersededBy:row.supersededBy || null,
      verificationOf:M.clone(row.verificationOf || null),assessment:row.assessment || null,
      eligibility:learningEligibility(row)};
  }

  function resolveObservation(ref,target) {
    try {
      const r = protocol.objectRef(ref), s = read();
      if (r.domain !== 'living-world' || r.type !== 'observation') protocol.fail('INVALID_REF','Dit is geen Living World-observatie.');
      let row = s.contributions && s.contributions[r.id], corrected = false;
      if (!row) protocol.fail('SOURCE_MISSING','De observatie bestaat niet meer bij de bron.',404);
      while (row.supersededBy && s.contributions[row.supersededBy]) { row = s.contributions[row.supersededBy]; corrected = true; }
      const share = row.sharing || {visibility:'community',purpose:'world-memory',recipients:[]};
      const allowed = share.visibility === 'community' || target && (share.recipients || [])
        .some(x=>x.domain === target.domain && x.id === target.id);
      if (!allowed) protocol.fail('SOURCE_DENIED','De actuele bronpolicy staat deze ontvanger niet toe.',403);
      if (row.status === 'withdrawn') protocol.fail('SOURCE_WITHDRAWN','Deze observatie is door de bron ingetrokken.',410);
      if (row.status === 'rejected') protocol.fail('SOURCE_NOT_AVAILABLE','Deze observatie is door de bron afgewezen.',404);
      if (row.validUntil && row.validUntil<=time()) protocol.fail('SOURCE_EXPIRED','Deze observatie is verlopen.',410);
      return {ok:true,observation:observationRecord(row),corrected,
        requestedRef:r,sourceCurrentVersion:row.revision};
    } catch(e) { return protocol.error(e); }
  }
  function evaluateEligibility(ref,target,request={}) {
    try {
      const r=protocol.objectRef(ref),s=read();let row=s.contributions&&s.contributions[r.id];
      if (!row) protocol.fail('SOURCE_MISSING','De eligibility-bron bestaat niet meer.',404);
      while(row.supersededBy&&s.contributions[row.supersededBy])row=s.contributions[row.supersededBy];
      const current={domain:'living-world',type:'observation',id:row.id,version:row.revision};
      return eligibility.evaluate(learningEligibility(row),{sourceRef:current,purpose:request.purpose,
        recipient:target,use:request.use||'recall'},time());
    } catch(error) { return protocol.error(error); }
  }

  function protocolEvents() {
    const s = read(), byId = new Map(s.history.filter(e=>e.protocol).map(e=>[e.protocol.objectRef.id,e]));
    return Object.values(s.contributions).map(row=>{
      const old = byId.get(row.id);
      return {id:'lw-snapshot-'+protocol.hash([row.id,row.revision]).slice(0,28),sequence:null,
        at:row.updatedAt,action:'contribution.snapshot',objectRef:M.ref('contribution',row.id),
        protocol:observationRecord(row),envelop:old ? old.envelop : null};
    });
  }

  async function returnChangeReceipt(receipt) {
    try {
      if (!receipt || receipt.sourceDomain!=='workos' || !receipt.receiptId || !receipt.observationRef || !receipt.newRef)
        protocol.fail('INVALID_RECEIPT','De bronwijziging heeft geen geldig WorkOS-receipt.');
      const fingerprint=protocol.hash(receipt);
      return await mutate(current=>{
        const s=Object.assign(M.empty(),M.clone(current)),prior=s.returnOperations[receipt.receiptId];
        if (prior) {
          if (prior.fingerprint!==fingerprint) protocol.fail('SOURCE_EVENT_CONFLICT','Hetzelfde change receipt heeft andere inhoud.',409);
          return {...M.clone(prior.result),replay:true};
        }
        const row=s.contributions[receipt.observationRef.id],share=row && row.sharing;
        const allowed=!!(row && share && share.returnUpdates===true && receipt.context &&
          share.purpose===receipt.context.purpose && (share.recipients||[])
            .some(x=>x.domain==='workos' && x.id===receipt.context.workspaceCode));
        const result={ok:true,delivered:allowed,receiptId:receipt.receiptId,replay:false};
        if (allowed) {
          const receiptRef={domain:'workos',type:'change-receipt',id:receipt.receiptId,version:1};
          s.returns[receipt.receiptId]={owner:row.owner,observationId:row.id,receiptRef,
            changeRef:M.clone(receipt.newRef),status:'change-applied',appliedAt:receipt.appliedAt,
            recordedAt:time(),purpose:share.purpose};
          const priorEvent=s.history.at(-1),eventId='lwr_'+protocol.hash(receipt.receiptId).slice(0,24);
          const event={id:eventId,sequence:s.history.length+1,actor:'systeem',action:'contribution.return',
            objectRef:M.ref('contribution',row.id),revision:row.revision,at:time(),operationId:receipt.operationId,
            previousHash:priorEvent ? priorEvent.hash : null,
            envelop:envelope.maak({id:eventId,at:time(),kanaal:'living-world',actor:'systeem',
              correlatie:receipt.correlationId,oorzaak:receipt.integrityRef && receipt.integrityRef.auditId,classificatie:'persoonsgegeven'})};
          event.hash=M.hash(event); s.history.push(event);
        }
        s.returnOperations[receipt.receiptId]={fingerprint,result:M.clone(result)};
        Object.assign(current,s); return result;
      });
    } catch(e) { return protocol.error(e); }
  }

  async function deliver(consumer,handle,limit=100,options={}) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle !== 'function') throw new Error('Invalid Living World consumer');
    if (limit && typeof limit==='object') { options=limit; limit=100; }
    const start=delivery.checkpoint(read().delivery[consumer]),sourceThrough=read().history.length;
    if (start.sequence>sourceThrough) protocol.fail('CHECKPOINT_CORRUPT','Het Living World-checkpoint ligt voorbij het bronspoor.',503);
    const workerId=options.workerId ||
      'living-world-'+protocol.hash([process.pid,consumer,time(),Math.random()]).slice(0,16);
    let cursor=start.sequence,blocked=null;
    const events = read().history.map((event,index)=>({...event,sequence:event.sequence || index+1}))
      .filter(event=>event.sequence>cursor).sort((a,b)=>a.sequence-b.sequence).slice(0,Math.max(1,Math.min(limit,100)));
    for (const event of events) {
      const claimed=await mutate(current=>{
        const s=Object.assign(M.empty(),M.clone(current)),result=delivery.claim(s.delivery,consumer,event,
          {at:time(),workerId,leaseMs:options.leaseMs,requireNext:true}); Object.assign(current,s); return result;
      });
      if (claimed.conflict) protocol.fail(claimed.code,'Dezelfde delivery-sequence heeft andere inhoud.',409);
      if (claimed.outOfOrder) protocol.fail(claimed.code,'De delivery-outbox heeft een volgordegat.',503);
      if (!claimed.claimed) { if (claimed.complete) { cursor=Math.max(cursor,event.sequence); continue; } blocked=claimed.lease; break; }
      try { await handle(M.clone(event)); }
      catch(error) {
        const failure=await mutate(current=>{
          const s=Object.assign(M.empty(),M.clone(current)),result=delivery.failed(s.delivery,consumer,event,error,
            {at:time(),workerId,maxAttempts:options.maxAttempts}); Object.assign(current,s); return result;
        });
        if (failure.deadLettered) throw Object.assign(new Error('Delivery staat in de dead-letterwachtrij.'),
          {loopFabric:true,code:'DEAD_LETTERED',status:503,eventId:event.id});
        throw error;
      }
      await mutate(current=>{
        const s=Object.assign(M.empty(),M.clone(current));
        delivery.complete(s.delivery,consumer,event,{at:time(),workerId});
        Object.assign(current,s);
      });
      cursor=event.sequence;
    }
    return {deliveredThrough:cursor,blocked};
  }
  function deliveryStatus(consumer) {
    const s=read(),events=s.history.map((event,index)=>({...event,sequence:event.sequence || index+1}));
    return delivery.summary(s.delivery[consumer],Math.max(0,...events.map(x=>x.sequence)),time(),events);
  }
  function deliveryStatuses() {
    const s=read(); return Object.keys(s.delivery || {}).map(consumer=>({scopeHash:protocol.hash('living-world').slice(0,20),
      consumer,...deliveryStatus(consumer)}));
  }
  async function replayDeadLetter(consumer,eventId) {
    return mutate(current=>{
      const s=Object.assign(M.empty(),M.clone(current)),result=delivery.replay(s.delivery,consumer,eventId,time());
      Object.assign(current,s); return {ok:true,...result};
    });
  }

  return {observationRecord,resolveObservation,learningEligibility:evaluateEligibility,protocolEvents,returnChangeReceipt,
    deliver,deliveryStatus,deliveryStatuses,replayDeadLetter};
};
