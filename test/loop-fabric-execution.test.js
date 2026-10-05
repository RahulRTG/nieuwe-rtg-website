'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {build,OUT}=require('../scripts/loop-fabric-execution');

test('Execution Matrix dekt iedere capability exact eenmaal en is reproduceerbaar',()=>{
  const matrix=build(),disk=JSON.parse(fs.readFileSync(OUT,'utf8'));
  assert.deepEqual(disk,matrix);
  const ids=matrix.batches.flatMap(batch=>batch.capabilities);
  assert.equal(ids.length,228);assert.equal(new Set(ids).size,228);
  for(const batch of matrix.batches){assert.ok(['GO','PHASE','STOP'].includes(batch.status));
    assert.ok(Number.isInteger(batch.blastRadius.kernelModules));assert.ok(batch.blastRadius.dataSchema);
    assert.ok(batch.blastRadius.privacyImpact);assert.ok(batch.blastRadius.authorityImpact);}
});

test('alleen de reeds bewezen eindpoort is GO; high-volume en beslisbatches stoppen',()=>{
  const byId=Object.fromEntries(build().batches.map(row=>[row.id,row]));
  assert.equal(byId.B00_FINAL_GUARDS.status,'GO');
  assert.equal(byId.B00_FINAL_GUARDS.blastRadius.newSharedPrimitive,'geen');
  assert.equal(byId.B06_HIGH_VOLUME.status,'STOP');
  assert.equal(byId.B08_HUMAN_PROGRAMS.status,'STOP');
  assert.equal(byId.B09_REGULATED_PRIVATE.status,'STOP');
  assert.ok(byId.B01_PROVEN_CLOSURE.readiness.NEEDS_TECHNICAL_PREREQUISITE>0);
});
