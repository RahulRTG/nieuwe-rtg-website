'use strict';

module.exports=function livingWorldLoopDelivery({M,protocol,delivery,read,mutate,time}) {
  async function deliver(consumer,handle,limit=100,options={}) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle !== 'function') throw new Error('Invalid Living World consumer');
    if (limit && typeof limit==='object') { options=limit; limit=100; }
    const start=delivery.checkpoint(read().delivery[consumer]),sourceThrough=read().history.length;
    if (start.sequence>sourceThrough) protocol.fail('CHECKPOINT_CORRUPT','Het Living World-checkpoint ligt voorbij het bronspoor.',503);
    const workerId=options.workerId ||
      'living-world-'+protocol.hash([process.pid,consumer,time(),Math.random()]).slice(0,16);
    let cursor=start.sequence,blocked=null;
    const events=read().history.map((event,index)=>({...event,sequence:event.sequence || index+1}))
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
  function livingWorldDeliveryStatus(consumer) {
    const s=read(),events=s.history.map((event,index)=>({...event,sequence:event.sequence || index+1}));
    return delivery.summary(s.delivery[consumer],Math.max(0,...events.map(x=>x.sequence)),time(),events);
  }
  function livingWorldDeliveryStatuses() {
    const s=read(); return Object.keys(s.delivery || {}).map(consumer=>({scopeHash:protocol.hash('living-world').slice(0,20),
      consumer,...livingWorldDeliveryStatus(consumer)}));
  }
  async function replayDeadLetter(consumer,eventId) {
    return mutate(current=>{
      const s=Object.assign(M.empty(),M.clone(current)),result=delivery.replay(s.delivery,consumer,eventId,time());
      Object.assign(current,s); return {ok:true,...result};
    });
  }
  return {deliver,deliveryStatus:livingWorldDeliveryStatus,deliveryStatuses:livingWorldDeliveryStatuses,replayDeadLetter};
};
