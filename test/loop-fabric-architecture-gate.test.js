'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../server/kern/loop-fabric/invariants'),M=require('../server/kern/loop-fabric/model');
const ref=(domain,type,id)=>({domain,type,id,version:1});

test('architectuurpoort controleert betekenis in de projectie',()=>{
  const state=M.empty(),obs=ref('living-world','observation','o1'),decision=ref('workos','decision','d1'),next=ref('workos','procedure','p2');
  state.observations['o']={record:{objectRef:obs,sharing:{visibility:'workspace',purpose:'improve',recipients:[]}}};
  state.changes.r1={receipt:{receiptId:'r1',sourceDomain:'workos',observationRef:obs,decisionRef:decision,newRef:next}};
  state.lineage.l1={from:decision,to:next,relation:'authorized_change',receiptRef:'r1',causalClaim:false};
  assert.equal(I.projection(state).ok,true);
});

test('architectuurpoort weigert broninhoud, vreemde source ownership en impliciete causaliteit',()=>{
  const base=M.empty(),obs=ref('living-world','observation','o1'),decision=ref('workos','decision','d1');
  base.observations.o={record:{objectRef:obs,sharing:{visibility:'workspace',purpose:'improve',recipients:[]},text:'verboden'}};
  assert.throws(()=>I.projection(base),e=>e.code==='FABRIC_DOMAIN_TRUTH');
  delete base.observations.o.record.text;
  base.changes.r1={receipt:{receiptId:'r1',sourceDomain:'workos',observationRef:obs,decisionRef:decision,
    newRef:ref('leerhuis','knowledge','k2')}};
  assert.throws(()=>I.projection(base),e=>e.code==='FABRIC_SOURCE_OWNERSHIP');
  base.changes.r1.receipt.newRef=ref('workos','procedure','p2');
  base.lineage.l1={from:decision,to:base.changes.r1.receipt.newRef,relation:'authorized_change',receiptRef:'r1',causalClaim:true};
  assert.throws(()=>I.projection(base),e=>e.code==='FABRIC_CAUSALITY');
});
