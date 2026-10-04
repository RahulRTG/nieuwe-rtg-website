'use strict';

const M = require('./model');
const envelope = require('../envelop');
const protocol = require('../loop-fabric/protocol');

module.exports = function makeLivingWorldLoopSource({read,mutate,time}) {
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
      verificationOf:M.clone(row.verificationOf || null),assessment:row.assessment || null};
  }

  function resolveObservation(ref,target) {
    try {
      const r = protocol.objectRef(ref), s = read();
      if (r.domain !== 'living-world' || r.type !== 'observation') protocol.fail('INVALID_REF','Dit is geen Living World-observatie.');
      let row = M.get(s,'contributions',r.id), corrected = false;
      while (row.supersededBy && s.contributions[row.supersededBy]) { row = s.contributions[row.supersededBy]; corrected = true; }
      const share = row.sharing || {visibility:'community',purpose:'world-memory',recipients:[]};
      const allowed = share.visibility === 'community' || target && (share.recipients || [])
        .some(x=>x.domain === target.domain && x.id === target.id);
      if (!allowed || row.status === 'withdrawn' || row.status === 'rejected')
        protocol.fail('SOURCE_NOT_AVAILABLE','Deze observatie is niet voor dit doel beschikbaar.',404);
      return {ok:true,observation:observationRecord(row),corrected,
        requestedRef:r,sourceCurrentVersion:row.revision};
    } catch(e) { return protocol.error(e); }
  }

  function protocolEvents() {
    const s = read(), byId = new Map(s.history.filter(e=>e.protocol).map(e=>[e.protocol.objectRef.id,e]));
    return Object.values(s.contributions).map(row=>{
      const old = byId.get(row.id);
      return {id:'lw-snapshot-'+row.id+'-'+row.revision,sequence:null,
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

  async function deliver(consumer,handle,limit=100) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle !== 'function') throw new Error('Invalid Living World consumer');
    const start = read().delivery[consumer] || 0;
    let cursor = start;
    const events = read().history.map((event,index)=>({...event,sequence:event.sequence || index+1}))
      .filter(event=>event.sequence>start).slice(0,Math.max(1,Math.min(limit,100)));
    for (const event of events) {
      await handle(M.clone(event));
      await mutate(current=>{
        const s = Object.assign(M.empty(),M.clone(current)), seen = s.delivery[consumer] || 0;
        if (seen < cursor) protocol.fail('CURSOR_CONFLICT','Herhaal de overdracht vanaf het duurzame checkpoint.',409);
        if (seen === cursor) s.delivery[consumer]=event.sequence;
        Object.assign(current,s);
      });
      cursor=event.sequence;
    }
    return {deliveredThrough:cursor};
  }

  return {observationRecord,resolveObservation,protocolEvents,returnChangeReceipt,deliver};
};
