'use strict';

const P=require('./protocol');

module.exports=function decisionContext({read,livingWorld,workSource,time,target}) {
  const sources={'living-world':livingWorld,workos:workSource};
  return function validate(actorRef,workspaceCode,value) {
    try {
      P.fields(value,['observationRef','observationHash','procedureRef','changeTargetRef','placeRef','blueprintRef','scopeRefs','expectation','successCriteria','purpose']);
      const authority=workSource.authorization(actorRef,workspaceCode,['kennis','besluit']);
      if (!authority.ok) return authority;
      const observationRef=P.objectRef(value.observationRef),changeTargetRef=P.objectRef(value.changeTargetRef || value.procedureRef);
      const observations=read().observations,indexed=observations[P.refKey(observationRef)] || observations[observationRef.id];
      if (!indexed || P.refKey(indexed.record.objectRef)!==P.refKey(observationRef))
        P.fail('OBSERVATION_NOT_INDEXED','Open de actuele Observation-inbox voordat u hierover besluit.',409);
      const source=sources[observationRef.domain];
      if (!source || typeof source.resolveObservation!=='function')
        P.fail('SOURCE_UNAVAILABLE','Het observatiebrondomein is niet aangesloten.',503);
      const resolved=source.resolveObservation(observationRef,target(authority.workspaceCode));
      if (!resolved.ok) P.fail(resolved.code,resolved.error,resolved.status);
      const observation=resolved.observation;
      if (P.refKey(observation.objectRef)!==P.refKey(observationRef) || P.hash(observation)!==value.observationHash)
        P.fail('OBSERVATION_CHANGED','De bekeken observatie is gewijzigd; beoordeel de actuele bron opnieuw.',409);
      if (observation.sharing.visibility!=='workspace' || observation.sharing.purpose!==value.purpose ||
          !(observation.sharing.recipients||[]).some(r=>r.domain==='workos' && r.id===authority.workspaceCode))
        P.fail('PURPOSE_DENIED','Deze observatie is niet voor deze WorkOS-beslissing gedeeld.',403);
      const supplied=Array.isArray(value.scopeRefs) ? value.scopeRefs.map(ref=>P.objectRef(ref,{versioned:false}))
        : [value.placeRef && P.objectRef(value.placeRef,{versioned:false}),
          value.blueprintRef && P.objectRef(value.blueprintRef,{versioned:false})].filter(Boolean);
      const actual=(observation.scopeRefs || [observation.placeRef,observation.blueprintRef].filter(Boolean))
        .map(ref=>P.objectRef(ref,{versioned:false}));
      if (!supplied.length || supplied.some(ref=>!actual.some(row=>P.refKey(row)===P.refKey(ref))))
        P.fail('CONTEXT_CHANGED','De besliscontext hoort niet bij de gedeelde eventuitvoering.',409);
      const artifact=workSource.artifact(actorRef,authority.workspaceCode,changeTargetRef);
      if (!artifact.ok || !artifact.current)
        P.fail('SOURCE_CHANGED','Open de actuele WorkOS-bronversie voordat u hierover besluit.',409);
      return {ok:true,validation:{policyId:'loop-decision-source-context',version:1,validatedAt:time(),
        observationEventId:indexed.eventId,observationRef,changeTargetRef,purpose:value.purpose}};
    } catch(e) { return P.error(e); }
  };
};
