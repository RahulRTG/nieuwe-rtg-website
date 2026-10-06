'use strict';

const P=require('../kern/loop-fabric/protocol');
const D=require('../kern/loop-fabric/delivery');
const serviceReceipt=require('../kern/loop-fabric/service-receipt');

module.exports=function makeWorkLoopTransport({read,tx,time,workspaceFrom,protocolState,serviceProof}) {
  function protocolEvents(workspaceCode) {
    const spaces=read(),selected=workspaceCode ? [workspaceFrom(spaces,workspaceCode)] : Object.values(spaces);
    return selected.flatMap(workspace=>[
      ...Object.values(workspace.loopProtocol && workspace.loopProtocol.observations || {})
        .map(observation=>({id:'snapshot-work-observation-'+P.hash(P.refKey(observation.objectRef)).slice(0,24),type:'workos.incident.observed',protocol:P.clone(observation)})),
      ...Object.values(workspace.loopProtocol && workspace.loopProtocol.lifecycles || {})
        .map(observation=>({id:'snapshot-work-lifecycle-'+P.hash(P.refKey(observation.objectRef)).slice(0,24),type:'workos.observation.'+observation.status,protocol:P.clone(observation)})),
      ...Object.values(workspace.loopProtocol && workspace.loopProtocol.receipts || {})
        .map(receipt=>({id:'snapshot-work-receipt-'+P.hash(receipt.receiptId).slice(0,24),type:'workos.change.applied',receipt:P.clone(receipt)}))]);
  }
  async function deliver(workspaceCode,consumer,handle,limit=100,options={}) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle!=='function') throw new Error('Invalid WorkOS Loop consumer');
    if (limit && typeof limit==='object') { options=limit; limit=100; }
    const workspace=workspaceFrom(read(),workspaceCode),start=D.checkpoint(workspace.loopProtocol && workspace.loopProtocol.delivery[consumer]);
    const sourceThrough=workspace.loopProtocol && workspace.loopProtocol.outbox && workspace.loopProtocol.outbox.length || 0;
    if (start.sequence>sourceThrough) P.fail('CHECKPOINT_CORRUPT','Het WorkOS-checkpoint ligt voorbij de bron-outbox.',503);
    const workerId=options.workerId || 'workos-'+P.hash([process.pid,consumer,time(),Math.random()]).slice(0,16);
    let cursor=start.sequence,blocked=null;
    const events=(workspace.loopProtocol && workspace.loopProtocol.outbox || []).filter(e=>e.sequence>cursor)
      .sort((a,b)=>a.sequence-b.sequence).slice(0,Math.max(1,Math.min(limit,100)));
    for (const event of events) {
      const claimed=await tx(map=>D.claim(protocolState(workspaceFrom(map,workspaceCode)).delivery,consumer,event,
        {at:time(),workerId,leaseMs:options.leaseMs,requireNext:true}));
      if (claimed.conflict) P.fail(claimed.code,'Dezelfde delivery-sequence heeft andere inhoud.',409);
      if (claimed.outOfOrder) P.fail(claimed.code,'De delivery-outbox heeft een volgordegat.',503);
      if (!claimed.claimed) { if (claimed.complete) { cursor=Math.max(cursor,event.sequence); continue; } blocked=claimed.lease; break; }
      try { await handle(P.clone(event)); }
      catch(error) {
        const failure=await tx(map=>D.failed(protocolState(workspaceFrom(map,workspaceCode)).delivery,consumer,event,error,
          {at:time(),workerId,maxAttempts:options.maxAttempts}));
        if (failure.deadLettered) throw Object.assign(new Error('Delivery staat in de dead-letterwachtrij.'),
          {loopFabric:true,code:'DEAD_LETTERED',status:503,eventId:event.id});
        throw error;
      }
      await tx(map=>D.complete(protocolState(workspaceFrom(map,workspaceCode)).delivery,consumer,event,{at:time(),workerId}));
      cursor=event.sequence;
    }
    return {deliveredThrough:cursor,blocked};
  }
  function deliveryStatus(workspaceCode,consumer) {
    const workspace=workspaceFrom(read(),workspaceCode),state=workspace.loopProtocol || {outbox:[],delivery:{}};
    const events=state.outbox || [];
    return D.summary(state.delivery && state.delivery[consumer],events.length,time(),events);
  }
  function deliveryStatuses() {
    const rows=[];
    for (const workspace of Object.values(read())) {
      const state=workspace.loopProtocol;if (!state || !state.delivery) continue;
      for (const consumer of Object.keys(state.delivery)) rows.push({scopeHash:P.hash(workspace.code).slice(0,20),consumer,
        ...deliveryStatus(workspace.code,consumer)});
    }
    return rows;
  }
  async function replayDeadLetter(workspaceCode,consumer,eventId) {
    return tx(map=>({ok:true,...D.replay(protocolState(workspaceFrom(map,workspaceCode)).delivery,consumer,eventId,time())}));
  }
  function verifyReceipt(receipt) {
    return serviceReceipt.verify(serviceProof,receipt,{domain:'workos',issuer:'rtg.service.workos',label:'WorkOS'});
  }
  return {protocolEvents,deliver,deliveryStatus,deliveryStatuses,replayDeadLetter,verifyReceipt};
};
