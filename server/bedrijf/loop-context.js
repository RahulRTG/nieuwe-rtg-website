'use strict';

const P = require('../kern/loop-fabric/protocol');

function decisionContext(value, capturedAt) {
  P.fields(value,['observationRef','observationHash','procedureRef','changeTargetRef','placeRef','blueprintRef','scopeRefs','expectation','successCriteria','purpose']);
  if (!/^[a-f0-9]{64}$/.test(String(value.observationHash || '')))
    P.fail('INVALID_INPUT','De besliscontext mist de hash van de bekeken observatie.');
  if (!Array.isArray(value.successCriteria) || !value.successCriteria.length || value.successCriteria.length>8)
    P.fail('INVALID_INPUT','Leg ten minste één controleerbaar succescriterium vast.');
  const target=P.objectRef(value.changeTargetRef || value.procedureRef);
  const scopes=Array.isArray(value.scopeRefs) ? value.scopeRefs.map(ref=>P.objectRef(ref,{versioned:false}))
    : [value.placeRef && P.objectRef(value.placeRef,{versioned:false}),
      value.blueprintRef && P.objectRef(value.blueprintRef,{versioned:false})].filter(Boolean);
  if (!scopes.length) P.fail('INVALID_INPUT','De besliscontext mist een brongebonden scope.');
  const out={observationRef:P.objectRef(value.observationRef),observationHash:value.observationHash,
    changeTargetRef:target,scopeRefs:scopes,
    expectation:P.text(value.expectation,1200),
    successCriteria:value.successCriteria.map(item=>P.text(item,300)),purpose:P.text(value.purpose,120),
    capturedAt:P.instant(capturedAt,'captured_at'),contextHash:null};
  if (value.procedureRef) out.procedureRef=target;
  if (value.placeRef) out.placeRef=P.objectRef(value.placeRef,{versioned:false});
  if (value.blueprintRef) out.blueprintRef=P.objectRef(value.blueprintRef,{versioned:false});
  return out;
}

function freeze(value,capturedAt) {
  const out=decisionContext(value,capturedAt);
  out.contextHash=P.hash(out);
  return out;
}

module.exports={ freeze };
