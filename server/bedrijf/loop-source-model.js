'use strict';

const P=require('../kern/loop-fabric/protocol');
const roles=require('./rollen-beleid');
const eligibility=require('../kern/loop-fabric/learning-eligibility');

module.exports=function makeWorkLoopModel(time){
  function protocolState(workspace){
    if(!workspace.loopProtocol||workspace.loopProtocol.schemaVersion!==1)
      workspace.loopProtocol={schemaVersion:1,operations:{},observations:{},lifecycles:{},receipts:{},outbox:[],delivery:{}};
    if(!workspace.loopProtocol.observations)workspace.loopProtocol.observations={};
    if(!workspace.loopProtocol.lifecycles)workspace.loopProtocol.lifecycles={};
    return workspace.loopProtocol;
  }
  function member(workspace,actorRef,memberId,required=['kennis','besluit'],at=time()){
    const row=workspace&&workspace.leden&&workspace.leden[memberId];
    const expected=row&&(row.rtgKey||'work-member:'+row.id);
    if(!row||row.status!=='actief'||expected!==actorRef)
      P.fail('AUTHORITY_REVOKED','Uw WorkOS-bevoegdheid is niet meer geldig.',403);
    const current=roles.rechtenVan(row,at.slice(0,10)),missing=required.filter(right=>!current.includes(right));
    if(missing.length)P.fail('AUTHORITY_REVOKED','De vereiste WorkOS-bevoegdheid is ingetrokken.',403);
    return {row,rights:required.slice(),policy:{id:'workos.roles',version:1}};
  }
  function workspaceFrom(map,code){
    const workspace=map[String(code||'').trim().toUpperCase()];
    if(!workspace)P.fail('NOT_FOUND','Deze werkruimte is niet beschikbaar.',404);
    return workspace;
  }
  function refEqual(left,right){return P.refKey(P.objectRef(left))===P.refKey(P.objectRef(right));}
  function appendEvent(state,event){
    const prior=state.outbox.at(-1);event.sequence=state.outbox.length+1;event.previousHash=prior?prior.hash:null;
    event.hash=P.hash(event);state.outbox.push(event);return event;
  }
  function observationEligibility(observation){
    return eligibility.issue({sourceRef:observation.objectRef,purpose:observation.sharing.purpose,
      memoryClass:'ORGANIZATIONAL',audience:observation.sharing.recipients,
      basis:{type:'VOLUNTARY_WORKPLACE_SAFETY_REPORT'},allowedFields:['title','text','observedAt','status','assessment'],
      uses:{decision:true,recall:true,'cross-domain':false,ai:false,aggregate:false,publish:false},issuedAt:observation.recordedAt,
      validUntil:null,retention:{mode:'SOURCE_LIFECYCLE',policyId:'workos.incident-observation.lifecycle.v1'},
      epistemicType:'HUMAN_STATED',capabilityId:'bedrijf'});
  }
  return {protocolState,member,workspaceFrom,refEqual,appendEvent,observationEligibility};
};
