/* Gedeelde delivery-state machine. Zij bezit geen outbox en geen events: ieder
   brondomein houdt die zelf. Alleen checkpoint, lease, attempts en dead-letter
   hebben over domeinen heen exact dezelfde betekenis. */
'use strict';

const P=require('./protocol');

function checkpoint(value) {
  if (value==null) return {sequence:0,lease:null,attempts:{},deadLetters:{},updatedAt:null};
  if (Number.isSafeInteger(value) && value>=0) return {sequence:value,lease:null,attempts:{},deadLetters:{},updatedAt:null};
  if (!value || typeof value!=='object' || !Number.isSafeInteger(value.sequence) || value.sequence<0)
    P.fail('CHECKPOINT_CORRUPT','Het delivery-checkpoint is beschadigd.',503);
  return {sequence:value.sequence,lease:value.lease || null,attempts:value.attempts || {},
    deadLetters:value.deadLetters || {},updatedAt:value.updatedAt || null};
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
  if (row.sequence>=meta.sequence) { container[consumer]=row; return {claimed:false,complete:true,row}; }
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
  row.sequence=meta.sequence; row.updatedAt=options.at; row.lease=null; delete row.attempts[meta.eventId];
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
  row.attempts[meta.eventId]=attempt; row.lease=null; row.updatedAt=options.at;
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

function summary(value,sourceThrough,now) {
  const row=checkpoint(value),dead=Object.values(row.deadLetters);
  return {checkpoint:row.sequence,sourceThrough,lag:Math.max(0,sourceThrough-row.sequence),lease:row.lease ?
    {workerId:row.lease.workerId,sequence:row.lease.sequence,until:row.lease.until,expired:Date.parse(row.lease.until)<=Date.parse(now)}:null,
    attempts:Object.keys(row.attempts).length,deadLetters:dead.length,openDeadLetters:dead.filter(x=>x.status!=='replayed').length,
    oldestDeadLetterAt:dead.map(x=>x.firstAttemptAt).sort()[0] || null,updatedAt:row.updatedAt};
}

module.exports={checkpoint,eventMeta,claim,complete,failed,replay,summary};
