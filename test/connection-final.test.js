'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const maakBlocking=require('../server/kern/connection-blocking');
const maakCommunication=require('../server/kern/connection-communication');
const maakConcierge=require('../server/kern/rendezvous-concierge');
const maakCircles=require('../server/kern/rendezvous-circles');
const ConnectionPartner=require('../server/kern/connection-partner');
const fs=require('node:fs');

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
  comm.terminatePair('a','b','BLOCKED');
  assert.equal(db.data.connectionCommunication.calls.find(x=>x.id===start.call.id).state,'BLOCKED',
    'een blokkade beëindigt de actieve realtime-sessie in de opslag');
  const hervat=comm.startCall('a',{id:'a|b'},'voice','call-start-key-0004');
  assert.equal(comm.answer('b',hervat.call.id,true).call.state,'ACTIVE');
  comm.consent('a',{id:'a|b'},'connection.voice',false);
  assert.equal(comm.poll('b',hervat.call.id).call.state,'CONSENT_REVOKED');
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

test('Connection-partners staan standaard uit en kiezen ieder programma afzonderlijk',()=>{
  const s={code:'DATE1',name:'Datehuis',type:'restaurant',city:'Amsterdam',online:true,
    loc:{lat:52.37,lng:4.89,label:'Centrum'},tables:[{id:'t1'}],settings:{reservationsOpen:true}};
  assert.equal(ConnectionPartner.eligible(s,'vonk',{service:'diner'}).reason,'NOT_OPTED_IN');
  ConnectionPartner.update(s,{programs:{vonk:{enabled:true,locations:['primary'],services:['diner'],days:[5],from:'18:00',to:'23:00',maxPerSlot:2}}});
  assert.equal(ConnectionPartner.eligible(s,'vonk',{service:'diner',date:'2026-09-25',time:'20:00'}).ok,true);
  assert.equal(ConnectionPartner.eligible(s,'vonk',{service:'borrel',date:'2026-09-25',time:'20:00'}).reason,'SERVICE_NOT_OPTED_IN');
  assert.equal(ConnectionPartner.eligible(s,'rendezvous',{service:'diner'}).reason,'NOT_OPTED_IN','Vonk-toestemming opent Rendez-vous niet');
  assert.equal(ConnectionPartner.eligible(s,'vonk',{service:'diner',date:'2026-09-26',time:'20:00'}).reason,'DAY_NOT_AVAILABLE');
  assert.equal(ConnectionPartner.eligible(s,'vonk',{service:'diner',date:'2026-09-25',time:'17:00'}).reason,'TIME_NOT_AVAILABLE');
});

test('pauze, locatie en capaciteit sluiten alleen nieuwe Connection-voorstellen',()=>{
  const s={code:'DATE2',name:'Tafelhuis',type:'restaurant',city:'Amsterdam',online:true,
    loc:{lat:52.37,lng:4.89,label:'Centrum'},tables:[{id:'t1'}],settings:{reservationsOpen:true}};
  ConnectionPartner.update(s,{programs:{table:{enabled:true,locations:['primary'],services:['diner'],days:[0,1,2,3,4,5,6],maxPerSlot:1}}});
  const existing={id:'old',supplierCode:s.code,status:'bevestigd',datum:'2026-10-02',tijd:'20:00'};
  assert.equal(ConnectionPartner.eligible(s,'table',{service:'diner',date:'2026-10-02',time:'20:00',activeBookings:1}).reason,'PROGRAM_CAPACITY_REACHED');
  ConnectionPartner.update(s,{programs:{table:{pausedUntil:'2026-10-03'}}});
  assert.equal(ConnectionPartner.eligible(s,'table',{service:'diner',today:'2026-10-02'}).reason,'PAUSED');
  assert.equal(existing.status,'bevestigd','de deelnameconfiguratie muteert een bestaande afspraak niet');
});

test('partnerapp rendert de servergedreven Connection-keuzes',()=>{
  const bron=fs.readFileSync(require('node:path').join(__dirname,'../public/apps/leverancier/leverancier-84b.js'),'utf8');
  const html=fs.readFileSync(require('node:path').join(__dirname,'../public/apps/leverancier.html'),'utf8');
  assert.match(bron,/state\.connectionParticipation/);
  assert.match(bron,/data-cp-program/);
  assert.match(bron,/connectionParticipation:\{programs\}/);
  assert.match(bron,/cp\.program\.vonk/,'programmanamen volgen dezelfde taalrail als de rest van de app');
  assert.match(html,/'cp\.title':'Connection programmes'/,'Engels is expliciet; de overige producttalen kunnen hier atomair van worden afgeleid');
  assert.match(html,/'cp\.saved':'Participation updated\./);
});

test('een ingetrokken partnerdeelname blokkeert een nieuwe betaling maar laat een bevestigde date staan',async()=>{
  const maakBetaling=require('../server/kern/vonk/payment');let boekingen=0;
  const trustRuntime=require('../server/kern/bewijsvlak/runtime');
  const voor=trustRuntime.current().metrics.aggregate('payment.authorize',30);
  const open={id:'m-open',a:'a',b:'b',betaald:{},status:'wacht-op-betaling',
    tafel:{supplierCode:'DATE3',datum:'2026-10-02',tijd:'20:00',soort:'diner'}};
  const confirmed={id:'m-confirmed',a:'a',b:'b',betaald:{a:'eerder'},status:'bevestigd',reserveringId:'r1',
    tafel:{supplierCode:'DATE3',datum:'2026-10-02',tijd:'20:00',soort:'diner'}};
  const data={matches:[open,confirmed]},betaal=maakBetaling({d:()=>data,save:()=>{},nu:()=>new Date().toISOString(),
    geblokkeerd:()=>false,codenaamVan:x=>x,pay:{boekAsync:async()=>{boekingen++;return {ok:true};}},reserveerTafel:()=>({ok:true}),notify:()=>{},
    partnerEligible:()=>false,PRIJS_CENTEN:1000,RTG_CENTEN:500});
  const geweigerd=await betaal('a','m-open');
  assert.equal(geweigerd.code,'PARTNER_NOT_PARTICIPATING');assert.equal(boekingen,0);assert.equal(open.tafel,null);
  const bestaand=await betaal('a','m-confirmed');
  assert.equal(bestaand.status,200);assert.equal(confirmed.reserveringId,'r1');
  const na=trustRuntime.current().metrics.aggregate('payment.authorize',30);
  assert.equal(na.denied-voor.denied,1,'ingetrokken deelname blijft zichtbaar maar is geen storing');
  assert.equal(na.succeeded-voor.succeeded,1,'een reeds bevestigde geldstatus telt technisch als succes');
});

test('Vonk fabriceert zonder hospitality-ingress geen providerbevestiging',async()=>{
  const runtime=require('../server/kern/bewijsvlak/runtime');
  runtime.configure({state:{},mode:'shadow',nu:()=>new Date().toISOString()});
  const maakBetaling=require('../server/kern/vonk/payment');
  const match={id:'m-proof',a:'a',b:'b',betaald:{},status:'wacht-op-betaling',
    tafel:{supplierCode:'DATE4',supplierName:'Tafelhuis',datum:'2026-10-02',tijd:'20:00',soort:'diner'}};
  const data={matches:[match]};
  const betaal=maakBetaling({d:()=>data,save:()=>{},nu:()=>new Date().toISOString(),
    geblokkeerd:()=>false,codenaamVan:x=>x,pay:{boekAsync:async()=>({ok:true})},
    reserveerTafel:()=>({ok:true,reservering:{id:'R-proof',status:'aangevraagd'}}),notify:()=>{},
    partnerEligible:()=>true,PRIJS_CENTEN:1000,RTG_CENTEN:500});
  assert.equal((await betaal('a','m-proof')).status,200);
  assert.equal((await betaal('b','m-proof')).status,200);
  assert.equal(match.status,'reservering-aangevraagd','een aanvraag wordt nooit als bevestiging vertaald');
  assert.equal(match.reservationEvidence.state,'PENDING');
  const evidence=runtime.current().v3.store.list('evidence');
  assert.equal(evidence.filter(x=>x.factType==='external.commitment.recorded').length,0,
    'zonder het echte hospitalitydomein ontstaat ook geen lokale commitmentclaim');
  assert.equal(evidence.filter(x=>x.factType==='external.provider.confirmed').length,0,
    'een succesvolle RTG-reserveringsfunctie is nog geen extern providerbewijs');
  const claim=runtime.current().v3.store.list('claims').find(x=>x.claimType==='external.fulfilled');
  assert.equal(claim,undefined,'zonder domeinbewijs is er niets om te beoordelen');
});

test('een truthy evidence-failure of ongeverifieerd bevestigd antwoord opent nooit een date',async()=>{
  const runtime=require('../server/kern/bewijsvlak/runtime');
  runtime.configure({state:{},mode:'shadow',nu:()=>new Date().toISOString()});
  const maakBetaling=require('../server/kern/vonk/payment');
  for(const antwoord of [{ok:false,shadow:true,code:'EXTERNAL_EVIDENCE_FAILED'},
    {ok:true,reservering:{id:'R-onbewezen',status:'bevestigd'}}]){
    const match={id:'m-'+Math.random(),a:'a',b:'b',betaald:{},status:'wacht-op-betaling',
      tafel:{supplierCode:'DATE4',supplierName:'Tafelhuis',datum:'2026-10-02',tijd:'20:00',soort:'diner'}};
    const betaal=maakBetaling({d:()=>({matches:[match]}),save:()=>{},nu:()=>new Date().toISOString(),
      geblokkeerd:()=>false,codenaamVan:x=>x,pay:{boekAsync:async()=>({ok:true})},
      reserveerTafel:()=>antwoord,notify:()=>{},partnerEligible:()=>true,PRIJS_CENTEN:1000,RTG_CENTEN:500});
    await betaal('a',match.id);await betaal('b',match.id);
    assert.equal(match.status,'reservering-onbekend');
    assert.notEqual(match.status,'bevestigd');
    assert.equal(match.reservationEvidence.state,'UNKNOWN');
  }
});
