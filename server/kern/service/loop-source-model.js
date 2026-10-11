'use strict';

const P=require('../loop-fabric/protocol');
const eligibility=require('../loop-fabric/learning-eligibility');

module.exports=function makeServiceLoopModel(time){
  const empty=()=>({schemaVersion:1,operations:{},observations:{},lifecycles:{},outbox:[],delivery:{}});
  const state=value=>Object.assign(empty(),value||{});
  const processRef=id=>({domain:'service',type:'process',id,version:1});
  const addDays=(iso,days)=>new Date(Date.parse(iso)+days*86400000).toISOString();
  function appendServiceEvent(s,event){
    const prior=s.outbox.at(-1);event.sequence=s.outbox.length+1;event.previousHash=prior&&prior.hash||null;
    event.hash=P.hash(event);s.outbox.push(event);return event;
  }
  function issueServiceEligibility(observation){
    return eligibility.issue({sourceRef:observation.objectRef,purpose:observation.sharing.purpose,memoryClass:'ORGANIZATIONAL',
      audience:observation.sharing.recipients,basis:{type:'ORGANIZATIONAL_PROCESS_METADATA'},
      allowedFields:['title','text','observedAt','status','assessment'],uses:{decision:true,recall:true,'cross-domain':true,
        ai:false,aggregate:false,publish:false},issuedAt:observation.recordedAt,validUntil:observation.validUntil,
      retention:{mode:'EXPIRY',policyId:'service.process-observation.180d.v1'},epistemicType:'SYSTEM_OBSERVED',capabilityId:'service'});
  }
  const publicObservation=row=>P.clone(row.observation);
  return {state,processRef,addDays,appendServiceEvent,issueServiceEligibility,publicObservation};
};
