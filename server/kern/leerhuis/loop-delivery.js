'use strict';

module.exports=function academyLoopDelivery({P,D,readDelivery,tx,state,leerhuis,protocolEvents,time}) {
  async function deliver(org,consumer,handle,limit=100,options={}) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle!=='function') throw new Error('Invalid Leerhuis Loop consumer');
    if (limit && typeof limit==='object') { options=limit; limit=100; }
    const events=protocolEvents(org),maxSource=Math.max(0,...leerhuis.spoor(org).map(row=>Number(row.nr)||0));
    const raw=readDelivery() || {},delivery=state(raw),cursor=Number(delivery.organizations[org] &&
      delivery.organizations[org].consumers && D.checkpoint(delivery.organizations[org].consumers[consumer]).sequence || 0);
    if (!Number.isSafeInteger(cursor) || cursor<0 || cursor>maxSource) P.fail('CHECKPOINT_CORRUPT','Het Leerhuis-checkpoint valt buiten het bronspoor.',503);
    const workerId=options.workerId || 'leerhuis-'+P.hash([process.pid,consumer,time(),Math.random()]).slice(0,16);
    let current=cursor,blocked=null;
    for (const event of events.filter(x=>x.sequence>cursor).sort((a,b)=>a.sequence-b.sequence)
      .slice(0,Math.max(1,Math.min(Number(limit)||100,1000)))) {
      const claimed=await tx(map=>{
        const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
        if (!row.consumers) row.consumers={};
        const result=D.claim(row.consumers,consumer,event,{at:time(),workerId,leaseMs:options.leaseMs}); Object.assign(map,s); return result;
      });
      if (claimed.conflict) P.fail(claimed.code,'Dezelfde delivery-sequence heeft andere inhoud.',409);
      if (!claimed.claimed) { if (claimed.complete) { current=Math.max(current,event.sequence); continue; } blocked=claimed.lease; break; }
      try { await handle(P.clone(event)); }
      catch(error) {
        const failure=await tx(map=>{
          const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
          const result=D.failed(row.consumers,consumer,event,error,{at:time(),workerId,maxAttempts:options.maxAttempts}); Object.assign(map,s); return result;
        });
        if (failure.deadLettered) throw Object.assign(new Error('Delivery staat in de dead-letterwachtrij.'),
          {loopFabric:true,code:'DEAD_LETTERED',status:503,eventId:event.id});
        throw error;
      }
      await tx(map=>{
        const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
        if (!row.consumers) row.consumers={};
        D.complete(row.consumers,consumer,event,{at:time(),workerId}); Object.assign(map,s);
      });
      current=event.sequence;
    }
    return {deliveredThrough:current,sourceThrough:maxSource,blocked};
  }
  function academyDeliveryStatus(org,consumer) {
    const delivery=state(readDelivery() || {}),row=delivery.organizations[org],events=protocolEvents(org);
    return D.summary(row && row.consumers && row.consumers[consumer],Math.max(0,...events.map(x=>x.sequence)),time(),events);
  }
  function academyDeliveryStatuses() {
    const s=state(readDelivery() || {}),rows=[];
    for (const [org,row] of Object.entries(s.organizations)) for (const consumer of Object.keys(row.consumers || {}))
      rows.push({scopeHash:P.hash(org).slice(0,20),consumer,...academyDeliveryStatus(org,consumer)});
    return rows;
  }
  async function replayDeadLetter(org,consumer,eventId) {
    return tx(map=>{
      const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
      if (!row.consumers) row.consumers={};
      const result=D.replay(row.consumers,consumer,eventId,time()); Object.assign(map,s); return {ok:true,...result};
    });
  }
  return {deliver,deliveryStatus:academyDeliveryStatus,deliveryStatuses:academyDeliveryStatuses,replayDeadLetter};
};
