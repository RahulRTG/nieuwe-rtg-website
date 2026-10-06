'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../server/kern/loop-fabric/learning-eligibility');

const at='2026-10-05T10:00:00.000Z',ref={domain:'travelos',type:'experience',id:'trip-1',version:3};
function artifact(overrides={}) { return E.issue({sourceRef:ref,purpose:'future-trip-preparation',memoryClass:'PERSONAL',
  audience:[{domain:'travelos',id:'member-1'}],basis:{type:'EXPLICIT_CONSENT'},allowedFields:['accessibilityNeed','observedAt'],
  uses:{decision:false,recall:true,'cross-domain':false,ai:false,aggregate:false,publish:false},issuedAt:at,
  validUntil:'2027-10-05T10:00:00.000Z',retention:{mode:'EXPIRY_OR_WITHDRAWAL',policyId:'travel.experience.personal.v1'},
  epistemicType:'HUMAN_STATED',capabilityId:'dom-reisbureau',...overrides}); }

test('source-issued eligibility bindt doel, bronversie, publiek, gebruik en retentie',()=>{
  const row=artifact();assert.ok(row.eligibilityId);assert.equal(row.memoryClass,'PERSONAL');
  assert.equal(E.evaluate(row,{sourceRef:ref,purpose:'future-trip-preparation',recipient:{domain:'travelos',id:'member-1'},
    use:'recall'},'2026-11-01T00:00:00.000Z').ok,true);
  assert.equal(E.evaluate(row,{sourceRef:ref,purpose:'organization-analytics',recipient:{domain:'travelos',id:'member-1'},
    use:'recall'},'2026-11-01T00:00:00.000Z').code,'PURPOSE_DENIED');
  assert.equal(E.evaluate(row,{sourceRef:ref,purpose:'future-trip-preparation',recipient:{domain:'workos',id:'ORG'},
    use:'recall'},'2026-11-01T00:00:00.000Z').code,'AUDIENCE_DENIED');
  assert.equal(E.evaluate(row,{sourceRef:ref,purpose:'future-trip-preparation',recipient:{domain:'travelos',id:'member-1'},
    use:'ai'},'2026-11-01T00:00:00.000Z').code,'USE_DENIED');
});

test('personal memory promoveert niet stil naar organization of commons',()=>{
  const row=artifact();
  assert.equal(row.memoryClass,'PERSONAL');assert.equal(row.uses['cross-domain'],false);assert.equal(row.uses.publish,false);
  assert.equal(E.evaluate(row,{sourceRef:ref,purpose:row.purpose,recipient:{domain:'travelos',id:'member-1'},
    use:'cross-domain'},'2026-11-01T00:00:00.000Z').code,'USE_DENIED');
});

test('expiry blijft unknown/denied en wordt niet als false of verified weergegeven',()=>{
  const out=E.evaluate(artifact(),{sourceRef:ref,purpose:'future-trip-preparation',
    recipient:{domain:'travelos',id:'member-1'},use:'recall'},'2028-01-01T00:00:00.000Z');
  assert.equal(out.code,'ELIGIBILITY_EXPIRED');assert.equal(out.ok,undefined);
});

test('AI-herkomst blijft apart van menselijke en brongeverifieerde herkomst',()=>{
  for(const kind of ['INFERRED','PROPOSED','SUMMARIZED','GENERATED'])
    assert.equal(artifact({epistemicType:kind}).epistemicType,kind);
  assert.notEqual(E.EPISTEMIC_TYPES.indexOf('INFERRED'),E.EPISTEMIC_TYPES.indexOf('SOURCE_VERIFIED'));
});

test('memory promotion, Commons-release en AI-scope zijn afzonderlijke poorten',()=>{
  assert.throws(()=>artifact({uses:{recall:true,'cross-domain':true}}),e=>e.code==='MEMORY_PROMOTION_REQUIRED');
  assert.throws(()=>artifact({memoryClass:'COMMONS'}),e=>e.code==='COMMONS_RELEASE_REQUIRED');
  assert.throws(()=>artifact({uses:{recall:true,ai:true}}),e=>e.code==='AI_SCOPE_REQUIRED');
});
