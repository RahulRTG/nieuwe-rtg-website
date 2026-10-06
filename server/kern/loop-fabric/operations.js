/* Operationeel beeld zonder broninhoud of persoonsidentiteit. Brondomeinen
   leveren uitsluitend hun eigen deliverytellers; de Fabric telt projecties. */
'use strict';

const P=require('./protocol'),M=require('./model');

module.exports=function makeOperations({read,sourceAdapters,time}) {
  const oldest=values=>values.filter(Boolean).sort()[0] || null;
  function snapshot() {
    const state=read(),deliveries=[];
    for (const [domain,source] of Object.entries(sourceAdapters || {})) {
      if (typeof source.deliveryStatuses!=='function') continue;
      for (const row of source.deliveryStatuses()) deliveries.push({domain,...P.clone(row)});
    }
    const recalls=Object.values(state.recalls),omissions=recalls.flatMap(row=>row.omissions || []);
    const verifications=Object.values(state.observations).filter(row=>row.record.verificationOf);
    const unlinked=Object.values(state.lineage).filter(row=>row.from.type==='tombstone' || row.to.type==='tombstone');
    const latencies=deliveries.map(row=>row.processingLatencyMs).filter(Boolean);
    return {asOf:time(),delivery:{streams:deliveries.length,outboxBacklog:deliveries.reduce((n,row)=>n+(row.lag||0),0),
      oldestUnprocessedEvent:oldest(deliveries.map(row=>row.oldestUnprocessedAt)),
      checkpointLag:deliveries.map(row=>({domain:row.domain,scopeHash:row.scopeHash,consumer:row.consumer,lag:row.lag})),
      deadLetters:deliveries.reduce((n,row)=>n+(row.openDeadLetters||0),0),
      replayConflicts:deliveries.reduce((n,row)=>n+(row.replayConflicts||0),0),
      processingLatencyMs:{last:latencies.map(x=>x.last).filter(Number.isFinite),
        max:latencies.length ? Math.max(0,...latencies.map(x=>x.max||0)) : null},
      workers:deliveries.map(row=>({domain:row.domain,scopeHash:row.scopeHash,consumer:row.consumer,
        status:row.lease ? row.lease.expired ? 'lease_expired':'active' : 'idle'}))},
    index:{relations:Object.keys(state.lineage).length,observations:Object.keys(state.observations).length,
      changes:Object.keys(state.changes).length,bytes:Buffer.byteLength(P.canonical({observations:state.observations,
        changes:state.changes,lineage:state.lineage})),staleLineage:Object.values(state.lineage).filter(row=>row.status!=='asserted').length,
      unlinkedReferences:unlinked.length,orphanedObjectRefs:{status:'not_checked',reason:'bronresolutie vereist actuele domeinpolicy'},
      journalIntegrity:M.verify(state.journal),journalEntries:state.journal.length},
    recall:{presentations:recalls.length,denied:omissions.filter(x=>x.status==='denied').length,
      unresolved:omissions.filter(x=>['source_missing','unavailable','not_checked'].includes(x.status)).length},
    verification:{unknown:verifications.filter(row=>['unknown','unavailable','not_checked',null].includes(row.record.assessment)).length,
      observed:verifications.length,causalClaims:0},
    privacy:{sourceContentCopied:false,actorIdentifiersExposed:false,scopeIdentifiersExposed:false}};
  }
  return {snapshot};
};
