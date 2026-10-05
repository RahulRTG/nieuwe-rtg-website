/* Gedeelde delivery-state machine. Zij bezit geen outbox en geen events: ieder
   brondomein houdt die zelf. Alleen checkpoint, lease, attempts en dead-letter
   hebben over domeinen heen exact dezelfde betekenis. */
'use strict';

const P=require('./protocol');

function checkpoint(value) {
  const empty=sequence=>({sequence,lease:null,attempts:{},deadLetters:{},updatedAt:null,lastCompleted:null,
    metrics:{completed:0,replays:0,replayConflicts:0,failures:0,processing:{count:0,totalMs:0,lastMs:null,maxMs:null}}});
  if (value==null) return empty(0);
  if (Number.isSafeInteger(value) && value>=0) return empty(value);
  if (!value || typeof value!=='object' || !Number.isSafeInteger(value.sequence) || value.sequence<0)
    P.fail('CHECKPOINT_CORRUPT','Het delivery-checkpoint is beschadigd.',503);
  const base=empty(value.sequence),metrics=value.metrics || {};
  return {...base,lease:value.lease || null,attempts:value.attempts || {},deadLetters:value.deadLetters || {},
    updatedAt:value.updatedAt || null,lastCompleted:value.lastCompleted || null,metrics:{...base.metrics,...metrics,
      processing:{...base.metrics.processing,...(metrics.processing || {})}}};
}

function eventMeta(event) {
  if (!event || !event.id || !Number.isSafeInteger(event.sequence) || event.sequence<1)
    P.fail('SOURCE_EVENT_INVALID','Een source event mist een geldige ID of sequence.',503);
  return {eventId:String(event.id),sequence:event.sequence,fingerprint:P.hash(event),
    family:String(event.type || event.action || 'unknown').slice(0,100)};
}

function claim(container,consumer,event,options={}) {
  const row=checkpoint(container[consumer]),meta=eventMeta(event),now=Date.parse(options.at),worker=String(options.workerId || 'worker');
  if (!Number.isFinite(now)) P.fail('INVALID_TIME','Delivery vereist een exacte klok.',503);
  if (row.sequence>=meta.sequence) {
    if (row.sequence===meta.sequence && row.lastCompleted && row.lastCompleted.fingerprint!==meta.fingerprint) {
      row.metrics.replayConflicts++; container[consumer]=row;
      return {claimed:false,conflict:true,code:'DELIVERY_REPLAY_CONFLICT',row:P.clone(row)};
    }
    row.metrics.replays++; container[consumer]=row; return {claimed:false,complete:true,row};
  }
  if (options.requireNext===true && meta.sequence!==row.sequence+1) {
    container[consumer]=row; return {claimed:false,outOfOrder:true,code:'DELIVERY_OUT_OF_ORDER',expected:row.sequence+1,
      actual:meta.sequence,row:P.clone(row)};
  }
  if (row.lease && Date.parse(row.lease.until)>now && row.lease.workerId!==worker) {
    container[consumer]=row; return {claimed:false,busy:true,row,lease:P.clone(row.lease)};
  }
  row.lease={workerId:worker,eventId:meta.eventId,sequence:meta.sequence,
    fingerprint:meta.fingerprint,claimedAt:options.at,until:new Date(now+(options.leaseMs || 30000)).toISOString()};
  container[consumer]=row; return {claimed:true,row:P.clone(row)};
}

function complete(container,consumer,event,options={}) {
  const row=checkpoint(container[consumer]),meta=eventMeta(event);
  if (row.sequence>=meta.sequence) { container[consumer]=row; return {replay:true,row}; }
  if (!row.lease || row.lease.workerId!==options.workerId || row.lease.eventId!==meta.eventId ||
      row.lease.fingerprint!==meta.fingerprint) P.fail('LEASE_LOST','Een andere worker bezit deze delivery.',409);
  const elapsed=Math.max(0,Date.parse(options.at)-Date.parse(row.lease.claimedAt));
  row.sequence=meta.sequence; row.updatedAt=options.at; row.lease=null; delete row.attempts[meta.eventId];
  row.lastCompleted={eventId:meta.eventId,sequence:meta.sequence,fingerprint:meta.fingerprint,completedAt:options.at};
  row.metrics.completed++; row.metrics.processing.count++; row.metrics.processing.totalMs+=elapsed;
  row.metrics.processing.lastMs=elapsed; row.metrics.processing.maxMs=Math.max(row.metrics.processing.maxMs || 0,elapsed);
  if (row.deadLetters[meta.eventId]) {
    row.deadLetters[meta.eventId].status='replayed'; row.deadLetters[meta.eventId].replayedAt=options.at;
  }
  container[consumer]=row; return {replay:false,row};
}

function failed(container,consumer,event,error,options={}) {
  const row=checkpoint(container[consumer]),meta=eventMeta(event);
  if (!row.lease || row.lease.workerId!==options.workerId || row.lease.eventId!==meta.eventId)
    P.fail('LEASE_LOST','De mislukte delivery heeft haar lease verloren.',409);
  const prior=row.attempts[meta.eventId] || {count:0,firstAttemptAt:options.at};
  const attempt={count:prior.count+1,firstAttemptAt:prior.firstAttemptAt,lastAttemptAt:options.at,
    reasonCode:String(error && (error.code || error.name) || 'DELIVERY_FAILED').slice(0,80),fingerprint:meta.fingerprint};
  row.attempts[meta.eventId]=attempt; row.lease=null; row.updatedAt=options.at; row.metrics.failures++;
  const max=Math.max(1,Number(options.maxAttempts)||3),deadLettered=attempt.count>=max;
  if (deadLettered) {
    row.deadLetters[meta.eventId]={...meta,attempts:attempt.count,firstAttemptAt:attempt.firstAttemptAt,
      lastAttemptAt:attempt.lastAttemptAt,reasonCode:attempt.reasonCode,replaySafe:true,humanIntervention:true,status:'open'};
    row.sequence=meta.sequence; delete row.attempts[meta.eventId];
  }
  container[consumer]=row; return {deadLettered,attempt:P.clone(attempt),row:P.clone(row)};
}

function replay(container,consumer,eventId,at) {
  const row=checkpoint(container[consumer]),dead=row.deadLetters[eventId];
  if (!dead) P.fail('NOT_FOUND','Deze dead letter bestaat niet.',404);
  if (dead.status==='replayed') return {replay:true,row};
  dead.status='replay-requested'; dead.replayRequestedAt=at;
  row.sequence=Math.min(row.sequence,dead.sequence-1); row.lease=null; row.updatedAt=at;
  container[consumer]=row; return {replay:false,row};
}

function summary(value,sourceThrough,now,events=[]) {
  const row=checkpoint(value),dead=Object.values(row.deadLetters),pending=events.filter(event=>event.sequence>row.sequence)
    .sort((a,b)=>a.sequence-b.sequence),processing=row.metrics.processing;
  return {checkpoint:row.sequence,sourceThrough,lag:Math.max(0,sourceThrough-row.sequence),lease:row.lease ?
    {workerId:row.lease.workerId,sequence:row.lease.sequence,until:row.lease.until,expired:Date.parse(row.lease.until)<=Date.parse(now)}:null,
    attempts:Object.keys(row.attempts).length,deadLetters:dead.length,openDeadLetters:dead.filter(x=>x.status!=='replayed').length,
    oldestDeadLetterAt:dead.map(x=>x.firstAttemptAt).sort()[0] || null,
    oldestUnprocessedAt:pending.length ? (pending[0].at || pending[0].envelop && pending[0].envelop.at || null) : null,
    completed:row.metrics.completed,replays:row.metrics.replays,replayConflicts:row.metrics.replayConflicts,
    failures:row.metrics.failures,processingLatencyMs:{last:processing.lastMs,max:processing.maxMs,
      average:processing.count ? Number((processing.totalMs/processing.count).toFixed(3)) : null,count:processing.count},
    updatedAt:row.updatedAt};
}

module.exports={checkpoint,eventMeta,claim,complete,failed,replay,summary};
