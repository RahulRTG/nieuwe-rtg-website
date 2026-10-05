'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../server/kern/loop-fabric/delivery');
const {fixture}=require('./lib/loop-fabric-fixture');

const T0='2026-10-05T10:00:00.000Z',T1='2026-10-05T10:01:00.000Z';
const event={id:'event-1',sequence:1,type:'source.changed',protocol:{privateText:'mag niet naar dead letter'}};

test('delivery lease voorkomt dubbele claim en herstelt crash vóór en na consumerverwerking',()=>{
  const delivery={};
  assert.equal(D.claim(delivery,'consumer',event,{at:T0,workerId:'worker-a',leaseMs:30000}).claimed,true);
  const duplicate=D.claim(delivery,'consumer',event,{at:T0,workerId:'worker-b',leaseMs:30000});
  assert.equal(duplicate.busy,true,'twee workers verwerken niet tegelijk dezelfde sequence');
  const recovered=D.claim(delivery,'consumer',event,{at:T1,workerId:'worker-b',leaseMs:30000});
  assert.equal(recovered.claimed,true,'na lease-expiry kan een andere worker herstellen');
  D.complete(delivery,'consumer',event,{at:T1,workerId:'worker-b'});
  assert.equal(D.claim(delivery,'consumer',event,{at:T1,workerId:'worker-c'}).complete,true,
    'antwoordverlies na checkpoint leidt bij retry niet tot een tweede effect');
});

test('poison delivery wordt na begrensde pogingen zichtbaar zonder bronpayload en kan veilig replayen',async()=>{
  const f=fixture();
  const observed=await f.workSource.observeIncident({actorRef:'user-1',memberId:'lead',workspaceCode:'WLOOP',
    operationId:'delivery_poison_observe_1',incidentId:'incident_1',runbookRef:f.runbookRef(),title:'Gevoelige near miss',
    text:'Deze gevoelige broninhoud hoort niet in operations.',occurredAt:f.time(),purpose:'runbook-near-miss-improvement'});
  assert.equal(observed.ok,true);
  const poison=()=>{const e=new Error('gevoelige fouttekst');e.code='SCHEMA_REJECTED';throw e;};
  for (let attempt=1;attempt<=2;attempt++) await assert.rejects(
    f.workSource.deliver('WLOOP','poison-consumer',poison,100,{workerId:'worker-'+attempt,maxAttempts:3}),/gevoelige fouttekst/);
  await assert.rejects(f.workSource.deliver('WLOOP','poison-consumer',poison,100,{workerId:'worker-3',maxAttempts:3}),
    error=>error.code==='DEAD_LETTERED');
  let status=f.workSource.deliveryStatus('WLOOP','poison-consumer');
  assert.equal(status.checkpoint,1); assert.equal(status.deadLetters,1); assert.equal(status.openDeadLetters,1);
  const stored=JSON.stringify(f.workspace.loopProtocol.delivery['poison-consumer']);
  assert.equal(stored.includes('Deze gevoelige broninhoud'),false); assert.equal(stored.includes('gevoelige fouttekst'),false);
  const eventId=f.workspace.loopProtocol.outbox[0].id;
  await f.workSource.replayDeadLetter('WLOOP','poison-consumer',eventId);
  let handled=0;
  await f.workSource.deliver('WLOOP','poison-consumer',async()=>{handled++;},100,{workerId:'recovery-worker'});
  assert.equal(handled,1); status=f.workSource.deliveryStatus('WLOOP','poison-consumer');
  assert.equal(status.openDeadLetters,0); assert.equal(status.lag,0);
});

test('changed replay, checkpointcorruptie en failure metadata falen gesloten',()=>{
  const delivery={};
  D.claim(delivery,'c',event,{at:T0,workerId:'a'});
  const mismatch={...event,protocol:{privateText:'andere payload'}};
  assert.throws(()=>D.complete(delivery,'c',mismatch,{at:T0,workerId:'a'}),error=>error.code==='LEASE_LOST');
  const failure=D.failed(delivery,'c',event,Object.assign(new Error('niet bewaren'),{code:'PAYLOAD_MISMATCH'}),
    {at:T0,workerId:'a',maxAttempts:1});
  assert.equal(failure.deadLettered,true);
  assert.equal(failure.row.deadLetters[event.id].reasonCode,'PAYLOAD_MISMATCH');
  assert.equal(JSON.stringify(failure.row.deadLetters[event.id]).includes('privateText'),false);
  assert.throws(()=>D.checkpoint({sequence:'1'}),error=>error.code==='CHECKPOINT_CORRUPT');
});
