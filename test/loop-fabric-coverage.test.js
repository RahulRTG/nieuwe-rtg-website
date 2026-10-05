'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {build,OUT}=require('../scripts/loop-fabric-coverage');

test('coverage registry omvat iedere functieschakelaar precies eenmaal en is reproduceerbaar',()=>{
  const built=build(),onDisk=JSON.parse(fs.readFileSync(OUT,'utf8'));
  assert.deepEqual(onDisk,built);assert.equal(built.capabilities.length,built.measured.capabilities);
  assert.equal(new Set(built.capabilities.map(x=>x.id)).size,built.capabilities.length);
  for(const row of built.capabilities){assert.ok(row.semanticOwner.id);assert.ok(row.entryPoints.length);assert.ok(row.classificationReason);
    assert.ok(row.participation.retention);assert.ok(row.participation.eligibility);
    assert.ok(Array.isArray(row.behaviourEvidence.kernelDependencies));}
  assert.ok(built.semanticSurfaces.kernelFiles>2000);assert.ok(built.semanticSurfaces.kernelGroups.length>100);
  assert.equal(built.semanticSurfaces.evidenceLevel,'STATIC_SOURCE_CANDIDATE_NOT_LEARNING_PROOF');
});

test('gevoelige keuzes falen gesloten en bewezen Fabric blijft zichtbaar',()=>{
  const byId=Object.fromEntries(build().capabilities.map(x=>[x.id,x]));
  assert.equal(byId['loop-fabric'].classification,'LOOP_CAPABLE');
  assert.equal(byId.gedachten.classification,'PROHIBITED_FROM_LEARNING');
  assert.equal(byId.gedachten.participation.eligibility,'DENY');
  assert.equal(byId['tg-inlog'].classification,'HUMAN_REVIEW_REQUIRED');
  assert.equal(byId['tg-inlog'].participation.lawfulBasis,'UNDECIDED');
  assert.equal(byId['kern-state'].classification,'NO_LEARNING_VALUE');
});

test('registry meet semantische mutatiepunten en geen HTTP-telemetrie',()=>{
  const registry=build();
  assert.ok(registry.measured.mutationContracts>4000);
  assert.equal(registry.capabilities.some(x=>Object.hasOwn(x,'requestCount')),false);
  assert.ok(registry.capabilities.some(x=>x.behaviourEvidence.signals.includes('decision')));
});
