'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {build,md,OUT,DOC}=require('../scripts/loop-fabric-unlock');

test('38 technische blockers hebben exact één primaire prerequisite',()=>{
  const r=build();assert.equal(r.prerequisites.expected.length,38);assert.equal(r.prerequisites.complete,true);
  assert.equal(new Set(r.prerequisites.assigned).size,38);assert.deepEqual(JSON.parse(fs.readFileSync(OUT,'utf8')),r);
  assert.equal(fs.readFileSync(DOC,'utf8'),md(r));
});

test('roadmap maakt geen nieuw GO en houdt alle 32 schaalcapabilities STOP',()=>{
  const r=build();assert.deepEqual(r.sourceFlows.newGo,[]);assert.equal(r.sourceFlows.implementedGo.length,5);
  assert.equal(r.scale.count,32);assert.ok(r.scale.blockers.every(x=>x.status==='STOP'));
  assert.deepEqual([...new Set(r.scale.blockers.map(x=>x.domain))].sort(),['commerce','media-culture','mobility']);
  assert.match(r.stopStatement,/blijven STOP/);
});

test('prerequisites hergebruiken concrete RTG-bronnen en noemen een tegenvoorbeeld',()=>{
  for(const p of build().prerequisites.nodes){assert.ok(p.reuse.length);assert.ok(p.counterexample);assert.ok(p.dependencies.length);
    assert.ok(p.implementationScope);assert.ok(p.risk);}
});
