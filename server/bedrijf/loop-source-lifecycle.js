'use strict';

const P=require('../kern/loop-fabric/protocol');
const envelope=require('../kern/envelop');

module.exports=function makeWorkObservationLifecycle({tx,time,workspaceFrom,protocolState,member,refEqual,appendEvent}) {
  return async function lifecycleObservation(input) {
    try {
      P.fields(input,['actorRef','memberId','workspaceCode','operationId','observationRef','status','reason']);
      const operationId=P.operationId(input.operationId),actorRef=P.text(input.actorRef,160),memberId=P.text(input.memberId,100);
      if (!['deleted','anonymized','expired'].includes(input.status)) P.fail('INVALID_INPUT','Kies deleted, anonymized of expired.');
      const ref=P.objectRef(input.observationRef),fingerprint=P.hash(input),operationKey=P.hash([actorRef,operationId]);
      return await tx(map=>{
        const workspace=workspaceFrom(map,input.workspaceCode),at=time(); member(workspace,actorRef,memberId,['service'],at);
        const state=protocolState(workspace),previous=state.operations[operationKey];
        if (previous) {
          if (previous.fingerprint!==fingerprint) P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
          return {...P.clone(previous.result),replay:true};
        }
        const observation=state.observations[ref.id];
        if (!observation || !refEqual(observation.objectRef,ref)) P.fail('SOURCE_MISSING','Deze observatie bestaat niet meer.',404);
        const lifecycle={objectRef:P.clone(ref),subjectRef:P.clone(observation.subjectRef),scopeRefs:P.clone(observation.scopeRefs),
          title:'Niet meer beschikbaar',text:'',observedAt:observation.observedAt,recordedAt:at,sourceActorRef:null,
          status:input.status,sharing:{visibility:'restricted',purpose:'unlinked',recipients:[]},basis:'source-lifecycle',
          review:null,contests:[],verificationOf:null,assessment:null,reasonCode:P.text(input.reason,200)};
        delete state.observations[ref.id]; state.lifecycles[ref.id]=P.clone(lifecycle);
        const eventId='wll_'+operationKey.slice(0,28);
        appendEvent(state,{id:eventId,type:'workos.observation.'+input.status,protocol:P.clone(lifecycle),
          envelop:envelope.maak({id:eventId,at,kanaal:'workos',actor:actorRef,correlatie:operationId,oorzaak:null,classificatie:'intern'})});
        const result={ok:true,status:input.status,refHash:P.hash(P.refKey(ref)),replay:false};
        state.operations[operationKey]={fingerprint,result:P.clone(result)}; return result;
      });
    } catch(e) { return P.error(e); }
  };
};
