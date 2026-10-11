'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {build,md,OUT,DOC}=require('../scripts/loop-fabric-unlock');

test('98 technische blockers hebben exact één primaire prerequisite',()=>{
  const r=build();assert.equal(r.prerequisites.expected.length,98);assert.equal(r.prerequisites.complete,true);
  assert.equal(new Set(r.prerequisites.assigned).size,98);assert.deepEqual(JSON.parse(fs.readFileSync(OUT,'utf8')),r,'LOOP-FABRIC-UNLOCK-ROADMAP.json loopt achter op de code -- draai: npm run loopfabric:unlock');
  assert.equal(fs.readFileSync(DOC,'utf8'),md(r));
  assert.equal(r.prerequisites.rejectedHypotheses[0].id,'P06_VERSIONED_PHYSICAL_HANDOFF');
  assert.equal(r.prerequisites.nodes.find(x=>x.id==='P03_ASSET_INTERVENTION_LIFECYCLE').consumers.includes('dom-doos'),true);
});

test('roadmap registreert bewezen nieuwe GO-flows en houdt alle 32 schaalcapabilities STOP',()=>{
  const r=build();assert.deepEqual(r.sourceFlows.newGo,['library-edition-to-academy','experience.living-world-commons-release','service.process-improvement']);
  assert.equal(r.sourceFlows.implementedGo.length,8);
  assert.equal(r.scale.count,32);assert.ok(r.scale.blockers.every(x=>x.status==='STOP'));
  assert.deepEqual([...new Set(r.scale.blockers.map(x=>x.domain))].sort(),['commerce','media-culture','mobility']);
  assert.match(r.stopStatement,/blijven STOP/);
  assert.deepEqual(r.fixedPoint,{reached:true,implementedGo:8,remainingPhase:8,remainingStop:8,
    reason:r.fixedPoint.reason,safeTechnicalWorkWithoutNewDecision:false});
});

test('roadmap onderscheidt begrensd bewijs van brede capabilityvrijgave',()=>{
  const nodes=Object.fromEntries(build().prerequisites.nodes.map(x=>[x.id,x]));
  assert.equal(nodes.P01_VERSIONED_SOURCE_RELEASE.proofStatus.status,'PROVEN_BOUNDED');
  assert.equal(nodes.P04_VERSIONED_SERVICE_PROCEDURE.proofStatus.status,'PROVEN_BOUNDED');
  assert.equal(nodes.P12_VERSION_BOUND_COMMONS_RELEASE.proofStatus.status,'PROVEN_ONE_SOURCE');
  assert.equal(nodes.P03_ASSET_INTERVENTION_LIFECYCLE.proofStatus.status,'PHASE');
  assert.equal(build().roadmap.some(x=>/Bouw P01/.test(x.step)),false);
});

test('prerequisites hergebruiken concrete RTG-bronnen en noemen een tegenvoorbeeld',()=>{
  for(const p of build().prerequisites.nodes){assert.ok(p.reuse.length);assert.ok(p.counterexample);assert.ok(p.dependencies.length);
    assert.ok(p.implementationScope);assert.ok(p.risk);}
});
