'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const maakBlocking=require('../server/kern/connection-blocking');
const maakCommunication=require('../server/kern/connection-communication');
const maakConcierge=require('../server/kern/rendezvous-concierge');
const maakCircles=require('../server/kern/rendezvous-circles');

const schoon=(v,n)=>String(v==null?'':v).replace(/[<>]/g,'').trim().slice(0,n||200);

test('communication media blijft purpose-bound en voice vereist een transcript',async()=>{
  const db={data:{}},files=new Map();let saves=0;
  const blocking=maakBlocking({db,save:()=>{saves++;}});
  const media={bewaarBestandPrive:async(bytes,mime)=>{const ref='private-'+files.size;files.set(ref,{bytes,mime});return {ref};},
    leesBuf:async ref=>(files.get(ref)||{}).bytes,verwijder:ref=>files.delete(ref)};
  const comm=maakCommunication({product:'vonk',db,save:()=>{saves++;},crypto,media,schoon,ticketSecret:'final-test-ticket-secret',
    isBlocked:blocking.isGeblokkeerd,resolveContext:(actor,input)=>input.id==='match-1'?{counterpart:actor==='a'?'b':'a',scope:'match-1'}:null});
  blocking.onBlock((a,b)=>comm.terminatePair(a,b,'BLOCKED'));
  const webm=Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0]);
  assert.equal((await comm.sendMedia('a',{id:'match-1'},webm,'audio/webm','voice','voice-message-key-0001','')).status,400);
  const sent=await comm.sendMedia('a',{id:'match-1'},webm,'audio/webm','voice','voice-message-key-0002','Ik vertel waar ik graag afspreek.');
  assert.equal(sent.status,200);assert.equal(sent.message.media.purpose,'VOICE_MESSAGE');
  assert.equal(sent.message.media.transcript,'Ik vertel waar ik graag afspreek.');
  const status=comm.status('b',{id:'match-1'}),ticket=status.messages[0].media.src.split('/').pop();
  assert.deepEqual((await comm.deliver(ticket)).bytes,webm);
  assert.equal(await comm.deliver(ticket+'x'),null,'een gewijzigd bearer-ticket geeft niets prijs');
  blocking.blokkeer('a','b','vonk');
  assert.equal(await comm.deliver(ticket),null,'een block trekt een reeds geprojecteerd ticket onmiddellijk in');
  assert.ok(saves>0);
});

test('voice en video bestaan pas na doelgebonden wederzijdse consent en revoke stopt de call',()=>{
  const db={data:{}},blocking=maakBlocking({db,save:()=>{}});
  const comm=maakCommunication({product:'rendezvous',db,save:()=>{},crypto,schoon,ticketSecret:'call-test-secret',
    media:{},isBlocked:blocking.isGeblokkeerd,resolveContext:(actor,input)=>input.id==='a|b'?{counterpart:actor==='a'?'b':'a',scope:'a|b'}:null});
  blocking.onBlock((a,b)=>comm.terminatePair(a,b,'BLOCKED'));
  assert.equal(comm.startCall('a',{id:'a|b'},'voice','call-start-key-0001').code,'MUTUAL_CONSENT_REQUIRED');
  comm.consent('a',{id:'a|b'},'connection.voice',true);
  assert.equal(comm.startCall('a',{id:'a|b'},'voice','call-start-key-0002').code,'MUTUAL_CONSENT_REQUIRED');
  assert.equal(comm.status('a',{id:'a|b'}).ownConsent.voice,true,'de eerste toestemming blijft voor de actor zichtbaar');
  assert.equal(comm.status('a',{id:'a|b'}).consent.voice,false,'de capability blijft dicht tot de ander ook toestemt');
  comm.consent('b',{id:'a|b'},'connection.voice',true);
  const start=comm.startCall('a',{id:'a|b'},'voice','call-start-key-0003');
  assert.equal(start.call.state,'RINGING');
  assert.equal(comm.answer('b',start.call.id,true).call.state,'ACTIVE');
  assert.equal(comm.sendSignal('a',start.call.id,'caption',{text:'Goedenavond'}).status,200);
  const first=comm.poll('b',start.call.id);assert.equal(first.signals[0].payload.text,'Goedenavond');
  assert.deepEqual(comm.poll('b',start.call.id,first.signals[0].id).signals,[],'poll levert bevestigde signalen niet opnieuw');
  comm.consent('a',{id:'a|b'},'connection.voice',false);
  assert.equal(comm.poll('b',start.call.id).call.state,'CONSENT_REVOKED');
});

test('Concierge kan alleen via echte service-overgangen bevestigd worden',()=>{
  const data={profielen:{a:{aan:true}}},R=()=>data;
  const api=maakConcierge({R,mag:()=>({ok:true}),schoon,nu:()=>new Date().toISOString(),save:()=>{},crypto,notify:()=>{}});
  const made=api.rvConciergeRequest('a',{subject:'Diner',request:'Regel een rustige tafel.',idempotencyKey:'concierge-request-0001'}).request;
  assert.equal(made.state,'REQUESTED');
  assert.equal(api.rvConciergeOfficeStep(made.id,'CONFIRMED',{confirmation:'x'},'office').status,409);
  api.rvConciergeOfficeStep(made.id,'ACKNOWLEDGED',{},'office');api.rvConciergeOfficeStep(made.id,'IN_PROGRESS',{},'office');
  api.rvConciergeOfficeStep(made.id,'PROPOSED',{proposal:'Vrijdag om 20:00'},'office');
  api.rvConciergeApprove('a',made.id,true);
  assert.equal(api.rvConciergeOfficeStep(made.id,'CONFIRMED',{confirmation:'Tafelbevestiging RV-1'},'office').request.state,'CONFIRMED');
  assert.equal(api.rvConciergeList('a').requests[0].confirmation,'Tafelbevestiging RV-1');
});

test('Circles tonen geen ledenlijst en blokkades verhinderen gedeeld lidmaatschap',()=>{
  const data={profielen:{a:{aan:true},b:{aan:true}},circles:{}},R=()=>data;
  const api=maakCircles({R,mag:()=>({ok:true}),schoon,nu:()=>new Date().toISOString(),save:()=>{},crypto,notify:()=>{},
    geblokkeerd:(r,a,b)=>a==='b'&&b==='a'});
  const circle=api.rvCircleCreate({name:'Founders',theme:'Ondernemen',context:'Besloten gesprekken.',idempotencyKey:'circle-create-key-0001'}).circle;
  assert.equal(api.rvCircleInvite(circle.id,'a').status,200);
  assert.equal(api.rvCircleInvite(circle.id,'b').status,409);
  const view=api.rvCircles('a').circles[0];
  assert.equal(Object.hasOwn(view,'members'),false);
});
