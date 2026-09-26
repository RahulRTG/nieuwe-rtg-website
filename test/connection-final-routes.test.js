'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {startServer,stop,kantoorAlsPersoon,elevateTier}=require('./helper');

const ID_PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const FOTO=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADHRFWHRHUFMANTIuMSw0LjMwjiV2AAAAFUlEQVR4nGOokNP4D8IMJxZE/QdhAEXMCP2u5XZBAAAAAElFTkSuQmCC','base64');
const WEBM=Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0]);
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-connection-final-'));
let srv,base,office,A,B,seq=0;

async function api(route,body,token,headers){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(headers||{})},body:Buffer.isBuffer(body)?body:JSON.stringify(body||{})});return {status:r.status,body:await r.json().catch(()=>({}))};}
async function lid(){const n=Date.now()+'-'+(++seq),reg=await api('/api/auth/register',{name:'Final '+seq,email:'final-'+n+'@test.invalid',phone:'064'+String(Date.now()).slice(-7)+seq,password:'geheim123',geboortedatum:'1990-05-05',tier:'rtg'});
  await elevateTier(base,reg.body.token,'lifestyle',office);let state=await api('/api/state',{},reg.body.token),codenaam=state.body.state.user.codename;
  await api('/api/verify/upload',{image:ID_PNG},reg.body.token);await api('/api/verify/selfie',{image:ID_PNG},reg.body.token);
  const pending=await api('/api/office/verifications',{},office),row=pending.body.pending.find(x=>x.codename===codenaam);
  await api('/api/office/verify',{userId:row.id,decision:'approve',faceMatch:true,geslacht:'x'},office);
  state=await api('/api/state',{},reg.body.token);return {token:reg.body.token,codenaam:state.body.state.user.codename};}

test.before(async()=>{srv=await startServer({env:{SMTP_URL:'',RTG_DATA_DIR:TMP,RTG_ENC_KEY:'connection-final-route-key-123456789'}});base=srv.base;office=await kantoorAlsPersoon(base,'RTG-OFFICE');A=await lid();B=await lid();});
test.after(()=>{stop(srv&&srv.child);try{fs.rmSync(TMP,{recursive:true,force:true});}catch(e){}});

test('Vonk en Rendez-vous finale routes vormen een echte mobiele serviceketen',async()=>{
  for(const u of [A,B]){
    assert.equal((await api('/api/vonk/profiel',{over:'Open voor een rustige ontmoeting.',stad:'Utrecht',lat:52.09,lng:5.12,leeftijdMin:18,leeftijdMax:99,maxKm:100},u.token)).status,200);
    assert.equal((await api('/api/member/rendezvous/profiel/zet',{aan:true,over:'Private society member',locaties:['Amsterdam']},u.token)).status,200);
  }
  const upload=await api('/api/member/rendezvous/profile-photo',FOTO,B.token,{'Content-Type':'image/png','X-RTG-Visibility':'DISCOVERY','Idempotency-Key':'rv-profile-photo-final-0001'});
  assert.equal(upload.status,200,JSON.stringify(upload.body));
  assert.equal((await api('/api/member/rendezvous/profile-photo/publish',{id:upload.body.media.id,visibility:'DISCOVERY'},B.token)).status,200);
  const candidates=await api('/api/member/rendezvous/kandidaten',{},A.token),candidate=candidates.body.kandidaten.find(x=>x.codenaam===B.codenaam);
  assert.equal(candidate.media.length,1);assert.equal(Object.hasOwn(candidate.media[0],'ref'),false);

  await api('/api/vonk/like',{codenaam:B.codenaam},A.token);const matched=await api('/api/vonk/like',{codenaam:A.codenaam},B.token);
  assert.equal(matched.body.match,true);const id=matched.body.id;
  assert.equal((await api('/api/connection/vonk/text',{id,text:'Zullen we koffie drinken?'},A.token)).status,200);
  let status=await api('/api/connection/vonk/status',{id},B.token);assert.equal(status.body.messages[0].text,'Zullen we koffie drinken?');
  const textMessage=status.body.messages[0];
  assert.equal((await api('/api/connection/vonk/message/report',{id,messageId:textMessage.id,reason:'Veiligheidstest'},B.token)).status,200);
  assert.equal((await api('/api/connection/vonk/message/remove',{id,messageId:textMessage.id},A.token)).status,200);
  status=await api('/api/connection/vonk/status',{id},B.token);assert.equal(status.body.messages.length,0);
  const media=await api('/api/connection/vonk/message-media',WEBM,A.token,{'Content-Type':'audio/webm','X-RTG-Context':id,'X-RTG-Media-Kind':'voice','X-RTG-Transcript':'Ik stel zaterdagmiddag voor.','Idempotency-Key':'vonk-voice-final-0001'});
  assert.equal(media.status,200,JSON.stringify(media.body));status=await api('/api/connection/vonk/status',{id},B.token);
  const voice=status.body.messages.find(x=>x.kind==='voice');assert.equal(voice.media.transcript,'Ik stel zaterdagmiddag voor.');
  assert.equal((await fetch(base+voice.media.src)).status,200);

  for(const u of [A,B])assert.equal((await api('/api/connection/vonk/consent',{id,capability:'connection.voice',active:true},u.token)).status,200);
  const edge=await api('/api/vonk/edge',{id},A.token);assert.ok(edge.body.actions.some(x=>x.id==='voice'));
  const call=await api('/api/connection/vonk/call/start',{id,type:'voice'},A.token,{'Idempotency-Key':'vonk-call-final-0001'});assert.equal(call.body.call.state,'RINGING');
  assert.equal((await api('/api/connection/vonk/call/answer',{callId:call.body.call.id,accept:true},B.token)).body.call.state,'ACTIVE');
  await api('/api/connection/vonk/call/signal',{callId:call.body.call.id,kind:'caption',payload:{text:'Goedenavond'}},A.token);
  const poll=await api('/api/connection/vonk/call/poll',{callId:call.body.call.id},B.token);assert.equal(poll.body.signals[0].payload.text,'Goedenavond');
  await api('/api/connection/vonk/consent',{id,capability:'connection.voice',active:false},A.token);
  assert.equal((await api('/api/connection/vonk/call/poll',{callId:call.body.call.id},B.token)).body.call.state,'CONSENT_REVOKED');

  const request=await api('/api/member/rendezvous/concierge/request',{subject:'Diner',request:'Een rustige tafel in Amsterdam.',idempotencyKey:'rv-concierge-final-0001'},A.token);
  const rid=request.body.request.id;for(const [state,extra] of [['ACKNOWLEDGED',{}],['IN_PROGRESS',{}],['PROPOSED',{proposal:'Vrijdag om 20:00'}]])
    assert.equal((await api('/api/office/rendezvous/concierge/step',{id:rid,state,...extra},office)).status,200);
  await api('/api/member/rendezvous/concierge/approve',{id:rid,approve:true},A.token);
  await api('/api/office/rendezvous/concierge/step',{id:rid,state:'CONFIRMED',confirmation:'Bevestiging RV-2026'},office);
  assert.equal((await api('/api/member/rendezvous/concierge',{},A.token)).body.requests[0].confirmation,'Bevestiging RV-2026');

  const circle=await api('/api/office/rendezvous/circle/create',{name:'Founders',theme:'Ondernemen',context:'Besloten tafel.',idempotencyKey:'rv-circle-final-0001'},office);
  await api('/api/office/rendezvous/circle/invite',{circleId:circle.body.circle.id,codename:A.codenaam},office);
  const circles=await api('/api/member/rendezvous/circles',{},A.token);
  assert.equal(circles.status,200);assert.equal(Object.hasOwn(circles.body.circles[0],'members'),false);
});
