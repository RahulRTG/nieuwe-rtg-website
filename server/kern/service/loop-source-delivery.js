'use strict';

/* Transport is los van de Service-betekenis. Het leest uitsluitend de
   source-owned outbox en gebruikt hetzelfde lease/checkpointcontract als de
   overige Loop Fabric-bronnen. */
const P=require('../loop-fabric/protocol');
const D=require('../loop-fabric/delivery');

module.exports=function makeServiceLoopDelivery({read,tx,time}){
  async function deliver(scopeId,consumer,handle,limit=100,options={}){
    if(typeof scopeId==='string'&&/^[a-z][a-z0-9.-]{1,79}$/.test(scopeId)&&typeof consumer==='function'){
      options=limit||{};limit=handle||100;handle=consumer;consumer=scopeId;scopeId=null;
    }
    if(!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer)||typeof handle!=='function')throw new Error('Invalid Service Loop consumer');
    if(limit&&typeof limit==='object'){options=limit;limit=100;}
    const s=read(),start=D.checkpoint(s.delivery[consumer]);
    if(start.sequence>s.outbox.length)P.fail('CHECKPOINT_CORRUPT','Het Service-checkpoint ligt voorbij de bron-outbox.',503);
    const workerId=options.workerId||'service-'+P.hash([process.pid,consumer,time(),Math.random()]).slice(0,16);
    let cursor=start.sequence,blocked=null;
    const events=s.outbox.filter(e=>e.sequence>cursor).sort((a,b)=>a.sequence-b.sequence)
      .slice(0,Math.max(1,Math.min(limit,100)));
    for(const event of events){
      const claimed=await tx(current=>D.claim(current.delivery,consumer,event,
        {at:time(),workerId,leaseMs:options.leaseMs,requireNext:true}));
      if(claimed.conflict)P.fail(claimed.code,'Dezelfde Service-delivery heeft andere inhoud.',409);
      if(claimed.outOfOrder)P.fail(claimed.code,'De Service-outbox heeft een volgordegat.',503);
      if(!claimed.claimed){if(claimed.complete){cursor=Math.max(cursor,event.sequence);continue;}blocked=claimed.lease;break;}
      try{await handle(P.clone(event));}
      catch(error){
        const failure=await tx(current=>D.failed(current.delivery,consumer,event,error,
          {at:time(),workerId,maxAttempts:options.maxAttempts}));
        if(failure.deadLettered)throw Object.assign(new Error('Delivery staat in de dead-letterwachtrij.'),
          {loopFabric:true,code:'DEAD_LETTERED',status:503,eventId:event.id});
        throw error;
      }
      await tx(current=>D.complete(current.delivery,consumer,event,{at:time(),workerId}));cursor=event.sequence;
    }
    return {deliveredThrough:cursor,blocked};
  }
  function serviceDeliveryStatus(consumer){const s=read();return D.summary(s.delivery[consumer],s.outbox.length,time(),s.outbox);}
  function serviceDeliveryStatuses(){const s=read();return Object.keys(s.delivery).map(consumer=>
    ({scopeHash:P.hash('service').slice(0,20),consumer,...serviceDeliveryStatus(consumer)}));}
  return {deliver,deliveryStatus:serviceDeliveryStatus,deliveryStatuses:serviceDeliveryStatuses};
};
