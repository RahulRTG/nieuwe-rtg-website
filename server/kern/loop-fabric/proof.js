'use strict';
const P=require('./protocol'),M=require('./model');
module.exports=({read,workSource,sourceAdapters})=>{
  const result=(state,actorRef,consumer,changes)=>{
    const changeIds=new Set(changes.map(x=>x.receipt.receiptId)),refs=new Set(changes.flatMap(x=>[
      P.refKey(x.receipt.observationRef),P.refKey(x.receipt.decisionRef),P.refKey(x.receipt.newRef),
      P.refKey({domain:x.receipt.sourceDomain,type:'change-receipt',id:x.receipt.receiptId,version:1})]));
    const lineage=Object.values(state.lineage).filter(x=>refs.has(P.refKey(x.from)) || refs.has(P.refKey(x.to)) || changeIds.has(x.receiptRef));
    const recalls=Object.values(state.recalls).filter(x=>x.actorRef===actorRef && (()=>{
      const c=x.context.consumer || {domain:'workos',id:x.context.workspaceCode};return c.domain===consumer.domain&&c.id===consumer.id;
    })());
    return {ok:true,consumer:P.clone(consumer),changes:P.clone(changes),lineage:P.clone(lineage),recalls:P.clone(recalls),
      integrity:M.verify(state.journal),scope:'projection-integrity-not-source-truth-or-causality'};
  };
  function proofFor(actorRef,consumer) {
    const source=sourceAdapters && sourceAdapters[consumer.domain];
    if (!source || typeof source.authorization!=='function') return {ok:false,status:503,code:'AUTHORITY_UNAVAILABLE',error:'Geen authority-adapter.'};
    const authority=source.authorization(actorRef,consumer.id,['kennis']);if (!authority.ok) return authority;
    const state=read(),changes=Object.values(state.changes).filter(x=>{
      const c=x.receipt.context||{},target=c.consumer||(c.workspaceCode?{domain:'workos',id:c.workspaceCode}:
        c.organizationCode?{domain:'leerhuis',id:c.organizationCode}:null);
      return target&&target.domain===consumer.domain&&target.id===consumer.id;
    });
    return result(state,actorRef,consumer,changes);
  }
  function proof(actorRef,workspaceCode) {
    const authority=workSource.authorization(actorRef,workspaceCode,['kennis']);if (!authority.ok)return authority;
    const out=proofFor(actorRef,{domain:'workos',id:authority.workspaceCode});
    if (out.ok) delete out.consumer;return out;
  }
  return {proof,proofFor};
};
