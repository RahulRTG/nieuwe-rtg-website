'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {startServer,stop,kantoorAlsPersoon,elevateTier}=require('./helper');
const {padVorm}=require('../server/kern/journaalvorm');

const ID_PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const FOTO=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADHRFWHRHUFMANTIuMSw0LjMwjiV2AAAAFUlEQVR4nGOokNP4D8IMJxZE/QdhAEXMCP2u5XZBAAAAAElFTkSuQmCC','base64');
const WEBM=Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0]);
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-connection-final-'));
let srv,base,office,A,B,seq=0;

function bewaardeMeldingen(){
  const bron="const {DatabaseSync}=require('node:sqlite');const k=require('./server/kluis');const d=new DatabaseSync(process.env.RTG_PROEF_STORE,{readOnly:true});try{console.log(JSON.stringify(JSON.parse(k.ontsleutel(d.prepare('SELECT val FROM kv WHERE key=?').get('connectionCommunication').val)).reports));}finally{d.close();}";
  return JSON.parse(require('node:child_process').execFileSync(process.execPath,['-e',bron],{cwd:path.join(__dirname,'..'),
    env:{...process.env,RTG_ENC_KEY:'connection-final-route-key-123456789',RTG_PROEF_STORE:path.join(TMP,'store.db')},encoding:'utf8'}));
}

async function api(route,body,token,headers){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(headers||{})},body:Buffer.isBuffer(body)?body:JSON.stringify(body||{})});return {status:r.status,body:await r.json().catch(()=>({}))};}
async function lid(){const n=Date.now()+'-'+(++seq),reg=await api('/api/auth/register',{name:'Final '+seq,email:'final-'+n+'@test.invalid',phone:'064'+String(Date.now()).slice(-7)+seq,password:'geheim123',geboortedatum:'1990-05-05',tier:'rtg'});
  await elevateTier(base,reg.body.token,'lifestyle',office);let state=await api('/api/state',{},reg.body.token),codenaam=state.body.state.user.codename;
  await api('/api/verify/upload',{image:ID_PNG},reg.body.token);await api('/api/verify/selfie',{image:ID_PNG},reg.body.token);
  const pending=await api('/api/office/verifications',{},office),row=pending.body.pending.find(x=>x.codename===codenaam);
  await api('/api/office/verify',{userId:row.id,decision:'approve',faceMatch:true,geslacht:'x'},office);
  state=await api('/api/state',{},reg.body.token);return {token:reg.body.token,codenaam:state.body.state.user.codename};}

test.before(async()=>{srv=await startServer({env:{SMTP_URL:'',RTG_STORE:'sqlite',DATABASE_URL:'',PG_URL:'',RTG_DATA_DIR:TMP,RTG_ENC_KEY:'connection-final-route-key-123456789'}});base=srv.base;office=await kantoorAlsPersoon(base,'RTG-OFFICE');A=await lid();B=await lid();});
test.after(()=>{stop(srv&&srv.child);try{fs.rmSync(TMP,{recursive:true,force:true});}catch(e){}});

test('Vonk en Rendez-vous finale routes vormen een echte mobiele serviceketen',async()=>{
  for(const u of [A,B]){
    assert.equal((await api('/api/vonk/profiel',{over:'Open voor een rustige ontmoeting.',stad:'Utrecht',lat:52.09,lng:5.12,leeftijdMin:18,leeftijdMax:99,maxKm:100},u.token)).status,200);
    assert.equal((await api('/api/member/rendezvous/profiel/zet',{aan:true,over:'Private society member',locaties:['Amsterdam'],
      aanwezig:[{stad:'Amsterdam',van:'2026-11-06',tot:'2026-11-08'}]},u.token)).status,200);
  }
  const upload=await api('/api/member/rendezvous/profile-photo',FOTO,B.token,{'Content-Type':'image/png','X-RTG-Visibility':'DISCOVERY','Idempotency-Key':'rv-profile-photo-final-0001'});
  assert.equal(upload.status,200,JSON.stringify(upload.body));
  assert.equal((await api('/api/member/rendezvous/profile-photo/publish',{id:upload.body.media.id,visibility:'DISCOVERY'},B.token)).status,200);
  const candidates=await api('/api/member/rendezvous/kandidaten',{},A.token),candidate=candidates.body.kandidaten.find(x=>x.codenaam===B.codenaam);
  assert.equal(candidate.media.length,1);assert.equal(Object.hasOwn(candidate.media[0],'ref'),false);
  const fotoHeaders={Authorization:'Bearer '+A.token};
  assert.equal((await fetch(base+candidate.media[0].src)).status,401);
  assert.equal((await fetch(base+candidate.media[0].src,{headers:fotoHeaders})).status,200);
  assert.equal((await fetch(base+'/api/member/rendezvous/profile-photo/delivery/ongeldig',{headers:fotoHeaders})).status,404);
  assert.equal(padVorm(candidate.media[0].src),'/api/member/rendezvous/profile-photo/delivery/:ticket');
  assert.equal((await api('/api/member/rendezvous/like',{id:candidate.id},A.token)).status,200);
  const candidateA=(await api('/api/member/rendezvous/kandidaten',{},B.token)).body.kandidaten.find(x=>x.codenaam===A.codenaam);
  assert.equal((await api('/api/member/rendezvous/like',{id:candidateA.id},B.token)).status,200);
  assert.equal((await api('/api/member/rendezvous/matches',{},A.token)).body.matches.length,1);

  const rvContext=[candidate.id,candidateA.id].sort().join('|');
  assert.equal((await api('/api/connection/rendezvous/text',{id:rvContext,text:'Zullen we rustig kennismaken?'},A.token)).status,200);
  let rvStatus=await api('/api/connection/rendezvous/status',{id:rvContext},B.token);
  assert.equal(rvStatus.body.messages[0].text,'Zullen we rustig kennismaken?');
  const rvText=rvStatus.body.messages[0];
  assert.equal((await api('/api/connection/rendezvous/message/report',{id:rvContext,messageId:rvText.id,reason:'Routeproef'},B.token)).status,200);
  assert.ok(bewaardeMeldingen().some(r=>r.messageId===rvText.id&&r.product==='rendezvous'&&r.reason==='Routeproef'));
  assert.equal((await api('/api/connection/rendezvous/message/remove',{id:rvContext,messageId:rvText.id},A.token)).status,200);
  assert.equal((await api('/api/connection/rendezvous/status',{id:rvContext},B.token)).body.messages.some(m=>m.id===rvText.id),false);
  const rvMedia=await api('/api/connection/rendezvous/message-media',WEBM,A.token,{'Content-Type':'audio/webm','X-RTG-Context':rvContext,'X-RTG-Media-Kind':'voice','X-RTG-Transcript':'Vrijdagavond past voor mij.','Idempotency-Key':'rv-voice-final-0001'});
  assert.equal(rvMedia.status,200,JSON.stringify(rvMedia.body));
  rvStatus=await api('/api/connection/rendezvous/status',{id:rvContext},B.token);
  const rvVoice=rvStatus.body.messages.find(x=>x.kind==='voice');
  assert.equal(rvVoice.media.transcript,'Vrijdagavond past voor mij.');
  assert.equal((await fetch(base+rvVoice.media.src)).status,200);
  assert.equal((await fetch(base+'/api/connection/rendezvous/message-media/delivery/ongeldig')).status,404);
  assert.equal(padVorm(rvVoice.media.src),'/api/connection/rendezvous/message-media/delivery/:ticket');
  for(const u of [A,B])assert.equal((await api('/api/connection/rendezvous/consent',{id:rvContext,capability:'connection.voice',active:true},u.token)).status,200);
  const rvCall=await api('/api/connection/rendezvous/call/start',{id:rvContext,type:'voice'},A.token,{'Idempotency-Key':'rv-call-final-0001'});
  assert.equal(rvCall.body.call.state,'RINGING');
  assert.equal((await api('/api/connection/rendezvous/call/answer',{callId:rvCall.body.call.id,accept:true},B.token)).body.call.state,'ACTIVE');
  assert.equal((await api('/api/connection/rendezvous/call/signal',{callId:rvCall.body.call.id,kind:'caption',payload:{text:'Tot vrijdag'}},A.token)).status,200);
  assert.equal((await api('/api/connection/rendezvous/call/poll',{callId:rvCall.body.call.id},B.token)).body.signals[0].payload.text,'Tot vrijdag');
  assert.equal((await api('/api/connection/rendezvous/call/end',{callId:rvCall.body.call.id},A.token)).status,200);
  assert.equal((await api('/api/connection/rendezvous/call/poll',{callId:rvCall.body.call.id},B.token)).body.call.state,'ENDED');
  const ordered=await api('/api/member/rendezvous/profile-photo/order',{ids:[upload.body.media.id]},B.token);
  assert.deepEqual(ordered.body.media.map(m=>m.id),[upload.body.media.id]);
  const freshPhoto=ordered.body.media[0].src;
  assert.equal((await fetch(base+freshPhoto,{headers:{Authorization:'Bearer '+B.token}})).status,200);
  assert.equal((await api('/api/member/rendezvous/profile-photo/remove',{id:upload.body.media.id},B.token)).status,200);
  assert.equal((await api('/api/member/rendezvous/profiel',{},B.token)).body.profiel.media.length,0,'de foto is uit het eigen profiel verwijderd');
  assert.equal((await fetch(base+freshPhoto,{headers:{Authorization:'Bearer '+B.token}})).status,404,'ook het actuele fototicket is ingetrokken');
  assert.equal((await fetch(base+candidate.media[0].src,{headers:fotoHeaders})).status,404,'een verwijderde profielfoto wordt niet meer geleverd');
  const arranged=await api('/api/member/rendezvous/arrange',{id:candidate.id,setting:'diner'},A.token);
  assert.equal(arranged.status,200,JSON.stringify(arranged.body));
  const akkoordA=await api('/api/member/rendezvous/akkoord',{id:candidate.id,ja:true},A.token);
  assert.equal(akkoordA.status,200,JSON.stringify(akkoordA.body));
  const akkoordB=await api('/api/member/rendezvous/akkoord',{id:candidateA.id,ja:true},B.token);
  assert.equal(akkoordB.status,200,JSON.stringify(akkoordB.body));
  const arrangements=await api('/api/office/rendezvous/arrangements',{},office);
  const arrangement=arrangements.body.requests.find(x=>x.id===rvContext);
  assert.ok(arrangement,'de dubbele goedkeuring bereikt de werkqueue van De Rechterhand');
  for(const state of ['ACKNOWLEDGED','IN_PROGRESS'])
    assert.equal((await api('/api/office/rendezvous/arrangement/step',{id:arrangement.id,state},office)).status,200);
  assert.equal((await api('/api/office/rendezvous/arrangement/step',{id:arrangement.id,state:'CONFIRMED',confirmation:'Arrangement RV-2026'},office)).status,200);
  const confirmed=(await api('/api/office/rendezvous/arrangements',{},office)).body.requests.find(r=>r.id===arrangement.id);
  assert.equal(confirmed.state,'CONFIRMED');assert.equal(confirmed.confirmation,'Arrangement RV-2026');

  await api('/api/vonk/like',{codenaam:B.codenaam},A.token);const matched=await api('/api/vonk/like',{codenaam:A.codenaam},B.token);
  assert.equal(matched.body.match,true);const id=matched.body.id;
  assert.equal((await api('/api/connection/vonk/text',{id,text:'Zullen we koffie drinken?'},A.token)).status,200);
  let status=await api('/api/connection/vonk/status',{id},B.token);assert.equal(status.body.messages[0].text,'Zullen we koffie drinken?');
  const textMessage=status.body.messages[0];
  assert.equal((await api('/api/connection/vonk/message/report',{id,messageId:textMessage.id,reason:'Veiligheidstest'},B.token)).status,200);
  assert.ok(bewaardeMeldingen().some(r=>r.messageId===textMessage.id&&r.product==='vonk'&&r.reason==='Veiligheidstest'));
  assert.equal((await api('/api/connection/vonk/message/remove',{id,messageId:textMessage.id},A.token)).status,200);
  status=await api('/api/connection/vonk/status',{id},B.token);assert.equal(status.body.messages.length,0);
  const media=await api('/api/connection/vonk/message-media',WEBM,A.token,{'Content-Type':'audio/webm','X-RTG-Context':id,'X-RTG-Media-Kind':'voice','X-RTG-Transcript':'Ik stel zaterdagmiddag voor.','Idempotency-Key':'vonk-voice-final-0001'});
  assert.equal(media.status,200,JSON.stringify(media.body));status=await api('/api/connection/vonk/status',{id},B.token);
  const voice=status.body.messages.find(x=>x.kind==='voice');assert.equal(voice.media.transcript,'Ik stel zaterdagmiddag voor.');
  assert.equal((await fetch(base+voice.media.src)).status,200);
  assert.equal(padVorm(voice.media.src),'/api/connection/vonk/message-media/delivery/:ticket');

  for(const u of [A,B])assert.equal((await api('/api/connection/vonk/consent',{id,capability:'connection.voice',active:true},u.token)).status,200);
  const edge=await api('/api/vonk/edge',{id},A.token);assert.ok(edge.body.actions.some(x=>x.id==='voice'));
  const call=await api('/api/connection/vonk/call/start',{id,type:'voice'},A.token,{'Idempotency-Key':'vonk-call-final-0001'});assert.equal(call.body.call.state,'RINGING');
  assert.equal((await api('/api/connection/vonk/call/answer',{callId:call.body.call.id,accept:true},B.token)).body.call.state,'ACTIVE');
  await api('/api/connection/vonk/call/signal',{callId:call.body.call.id,kind:'caption',payload:{text:'Goedenavond'}},A.token);
  const poll=await api('/api/connection/vonk/call/poll',{callId:call.body.call.id},B.token);assert.equal(poll.body.signals[0].payload.text,'Goedenavond');
  assert.equal((await api('/api/connection/vonk/call/end',{callId:call.body.call.id},A.token)).status,200);
  assert.equal((await api('/api/connection/vonk/call/poll',{callId:call.body.call.id},B.token)).body.call.state,'ENDED');
  const nextCall=await api('/api/connection/vonk/call/start',{id,type:'voice'},A.token,{'Idempotency-Key':'vonk-call-final-0002'});
  assert.equal(nextCall.status,200,JSON.stringify(nextCall.body));
  assert.equal(nextCall.body.call.state,'RINGING');
  assert.equal((await api('/api/connection/vonk/call/answer',{callId:nextCall.body.call.id,accept:true},B.token)).body.call.state,'ACTIVE');
  await api('/api/connection/vonk/consent',{id,capability:'connection.voice',active:false},A.token);
  assert.equal((await api('/api/connection/vonk/call/poll',{callId:nextCall.body.call.id},B.token)).body.call.state,'CONSENT_REVOKED');
  await api('/api/connection/vonk/call/end',{callId:nextCall.body.call.id},A.token);
  assert.equal((await api('/api/connection/vonk/call/poll',{callId:nextCall.body.call.id},B.token)).body.call.state,'CONSENT_REVOKED');
  assert.equal((await fetch(base+'/api/connection/vonk/message-media/delivery/ongeldig')).status,404);

  const request=await api('/api/member/rendezvous/concierge/request',{subject:'Diner',request:'Een rustige tafel in Amsterdam.',idempotencyKey:'rv-concierge-final-0001'},A.token);
  const rid=request.body.request.id;
  assert.ok((await api('/api/office/rendezvous/concierge',{},office)).body.requests.some(x=>x.id===rid));
  for(const [state,extra] of [['ACKNOWLEDGED',{}],['IN_PROGRESS',{}],['PROPOSED',{proposal:'Vrijdag om 20:00'}]])
    assert.equal((await api('/api/office/rendezvous/concierge/step',{id:rid,state,...extra},office)).status,200);
  await api('/api/member/rendezvous/concierge/approve',{id:rid,approve:true},A.token);
  await api('/api/office/rendezvous/concierge/step',{id:rid,state:'CONFIRMED',confirmation:'Bevestiging RV-2026'},office);
  assert.equal((await api('/api/member/rendezvous/concierge',{},A.token)).body.requests[0].confirmation,'Bevestiging RV-2026');

  const circle=await api('/api/office/rendezvous/circle/create',{name:'Founders',theme:'Ondernemen',context:'Besloten tafel.',idempotencyKey:'rv-circle-final-0001'},office);
  await api('/api/office/rendezvous/circle/invite',{circleId:circle.body.circle.id,codename:A.codenaam},office);
  const gathering=await api('/api/office/rendezvous/circle/gathering',{circleId:circle.body.circle.id,title:'Founders dinner',city:'Amsterdam',date:'2026-11-06',context:'Een rustige kennismaking.','idempotencyKey':'rv-gathering-final-0001'},office);
  assert.equal((await api('/api/member/rendezvous/circle/rsvp',{circleId:circle.body.circle.id,gatheringId:gathering.body.gathering.id,yes:true},A.token)).body.state,'ACCEPTED');
  assert.equal((await api('/api/office/rendezvous/circles',{},office)).body.circles.length,1);
  const circles=await api('/api/member/rendezvous/circles',{},A.token);
  assert.equal(circles.status,200);assert.equal(Object.hasOwn(circles.body.circles[0],'members'),false);
});
