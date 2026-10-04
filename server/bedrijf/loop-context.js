'use strict';

const P = require('../kern/loop-fabric/protocol');

function decisionContext(value, capturedAt) {
  P.fields(value,['observationRef','observationHash','procedureRef','placeRef','blueprintRef','expectation','successCriteria','purpose']);
  if (!/^[a-f0-9]{64}$/.test(String(value.observationHash || '')))
    P.fail('INVALID_INPUT','De besliscontext mist de hash van de bekeken observatie.');
  if (!Array.isArray(value.successCriteria) || !value.successCriteria.length || value.successCriteria.length>8)
    P.fail('INVALID_INPUT','Leg ten minste één controleerbaar succescriterium vast.');
  return {observationRef:P.objectRef(value.observationRef),observationHash:value.observationHash,
    procedureRef:P.objectRef(value.procedureRef),
    placeRef:P.objectRef(value.placeRef,{versioned:false}),
    blueprintRef:value.blueprintRef ? P.objectRef(value.blueprintRef,{versioned:false}) : null,
    expectation:P.text(value.expectation,1200),
    successCriteria:value.successCriteria.map(item=>P.text(item,300)),purpose:P.text(value.purpose,120),
    capturedAt:P.instant(capturedAt,'captured_at'),contextHash:null};
}

function freeze(value,capturedAt) {
  const out=decisionContext(value,capturedAt);
  out.contextHash=P.hash(out);
  return out;
}

module.exports={ freeze };
