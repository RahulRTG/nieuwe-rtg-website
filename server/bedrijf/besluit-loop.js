'use strict';

const loopContext=require('./loop-context');
const DECISION_TYPES=['product','investering','prijs','lancering','beveiliging','personeel','contract','overig'];
const countVotes=decision=>({
  voor:decision.stemmen.filter(row=>row.stem==='voor').length,
  tegen:decision.stemmen.filter(row=>row.stem==='tegen').length,
  onthouding:decision.stemmen.filter(row=>row.stem==='onthouding').length
});

function decisionContext(sctx,gate,value,at){
  if(value===undefined)return {ok:true,context:null};
  if(!sctx.loopFabric)return {ok:false,status:503,body:{error:'De broncontext kan nu niet worden bevestigd.',code:'LOOP_FABRIC_UNAVAILABLE'}};
  try{
    const actorRef=gate.l.rtgKey||'work-member:'+gate.l.id;
    const checked=sctx.loopFabric.validateDecisionContext(actorRef,gate.w.code,value);
    if(!checked.ok)return {ok:false,status:checked.status,body:{error:checked.error,code:checked.code}};
    const context=loopContext.freeze(value,at);context.validation=checked.validation;
    return {ok:true,context};
  }catch(error){
    if(error.loopFabric)return {ok:false,status:error.status,body:{error:error.message,code:error.code}};
    throw error;
  }
}

module.exports={decisionContext,DECISION_TYPES,countVotes};
