'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./lib/loop-fabric-fixture');

test('operationeel beeld toont afzonderlijke tellers zonder broninhoud of identiteit',async()=>{
  const f=fixture(),setup=await f.setupEvent();
  const plan=await f.eventRun(setup.blueprintId,'user-2');
  let observation=await f.command('user-2','contribution.create',{placeId:setup.placeId,planId:plan,kind:'observation',
    title:'Drempel',text:'Persoonsgevoelige vrije tekst',observedAt:f.time(),sharing:{visibility:'workspace',
      purpose:'event-accessibility-improvement',recipients:[{domain:'workos',id:'WLOOP'}],consent:true,returnUpdates:false}});
  await f.command('user-1','contribution.review',{id:observation.id,revision:observation.revision,
    decision:'accepted',reason:'Gecontroleerd.'});
  await f.fabric.sync('WLOOP');
  const out=f.fabric.operations(),serialized=JSON.stringify(out);
  assert.equal(out.privacy.sourceContentCopied,false);assert.equal(out.privacy.actorIdentifiersExposed,false);
  assert.ok(out.delivery.streams>=1);assert.ok(out.index.observations>=1);assert.equal(out.index.journalIntegrity,true);
  assert.equal(out.verification.causalClaims,0);assert.doesNotMatch(serialized,/Persoonsgevoelige|user-2|WLOOP/);
});

test('delivery operations meten conflict, latency, backlog en dead letters los',()=>{
  const D=require('../server/kern/loop-fabric/delivery'),state={},at='2026-10-05T10:00:00.000Z';
  const one={id:'one',sequence:1,type:'source.changed',at};
  assert.equal(D.claim(state,'consumer',one,{at,workerId:'a'}).claimed,true);
  D.complete(state,'consumer',one,{at:'2026-10-05T10:00:00.025Z',workerId:'a'});
  const changed={...one,type:'source.changed-again'};
  const conflict=D.claim(state,'consumer',changed,{at:'2026-10-05T10:00:01.000Z',workerId:'b'});
  assert.equal(conflict.conflict,true);
  const two={id:'two',sequence:2,type:'source.changed',at:'2026-10-05T10:00:02.000Z'};
  const status=D.summary(state.consumer,2,'2026-10-05T10:00:03.000Z',[one,two]);
  assert.equal(status.lag,1);assert.equal(status.replayConflicts,1);assert.equal(status.processingLatencyMs.last,25);
  assert.equal(status.oldestUnprocessedAt,two.at);
});
