'use strict';

const P=require('./protocol');

module.exports=function decisionContext({read,livingWorld,workSource,time,target}) {
  return function validate(actorRef,workspaceCode,value) {
    try {
      P.fields(value,['observationRef','observationHash','procedureRef','placeRef','blueprintRef','expectation','successCriteria','purpose']);
      const authority=workSource.authorization(actorRef,workspaceCode,['kennis','besluit']);
      if (!authority.ok) return authority;
      const observationRef=P.objectRef(value.observationRef),procedureRef=P.objectRef(value.procedureRef);
      const indexed=read().observations[observationRef.id];
      if (!indexed || P.refKey(indexed.record.objectRef)!==P.refKey(observationRef))
        P.fail('OBSERVATION_NOT_INDEXED','Open de actuele Observation-inbox voordat u hierover besluit.',409);
      const resolved=livingWorld.resolveObservation(observationRef,target(authority.workspaceCode));
      if (!resolved.ok) P.fail(resolved.code,resolved.error,resolved.status);
      const observation=resolved.observation;
      if (P.refKey(observation.objectRef)!==P.refKey(observationRef) || P.hash(observation)!==value.observationHash)
        P.fail('OBSERVATION_CHANGED','De bekeken observatie is gewijzigd; beoordeel de actuele bron opnieuw.',409);
      if (observation.sharing.visibility!=='workspace' || observation.sharing.purpose!==value.purpose ||
          !(observation.sharing.recipients||[]).some(r=>r.domain==='workos' && r.id===authority.workspaceCode))
        P.fail('PURPOSE_DENIED','Deze observatie is niet voor deze WorkOS-beslissing gedeeld.',403);
      if (P.refKey(P.objectRef(value.placeRef,{versioned:false}))!==P.refKey(observation.placeRef) ||
          P.refKey(P.objectRef(value.blueprintRef,{versioned:false}))!==P.refKey(observation.blueprintRef))
        P.fail('CONTEXT_CHANGED','De besliscontext hoort niet bij de gedeelde eventuitvoering.',409);
      const procedure=workSource.procedure(actorRef,authority.workspaceCode,procedureRef);
      if (!procedure.ok || !procedure.current)
        P.fail('SOURCE_CHANGED','Open de actuele WorkOS-procedure voordat u hierover besluit.',409);
      return {ok:true,validation:{policyId:'loop-decision-source-context',version:1,validatedAt:time(),
        observationEventId:indexed.eventId,observationRef,procedureRef,purpose:value.purpose}};
    } catch(e) { return P.error(e); }
  };
};
