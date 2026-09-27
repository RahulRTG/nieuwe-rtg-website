'use strict';

module.exports = (kern, { stuur, doe, eisCapability }) => {
  const { app, auth, express, rvFotoUpload, rvFotoPubliceer, rvFotoVerwijder, rvFotoOrden, rvFotoLever,
    rvCommStatus, rvCommConsent, rvCommText, rvCommRemove, rvCommReport, rvCommMedia, rvCommMediaLever,
    rvCommCallStart, rvCommCallAnswer, rvCommCallSignal, rvCommCallPoll, rvCommCallEnd } = kern;
  const { stuurBuffer } = require('../../media/bestand');
  app.post('/api/member/rendezvous/profile-photo', auth, express.raw({ type: () => true, limit: '8mb' }), (req,res) => {
    if(!eisCapability(req,res,'connection.profile.photo.manage'))return;
    Promise.resolve(rvFotoUpload(req.session.key,req.body,req.get('Content-Type')||'',{
      visibility:req.get('X-RTG-Visibility'),alt:req.get('X-RTG-Alt'),idempotencyKey:req.get('Idempotency-Key')
    })).then(r=>stuur(res,r)).catch(()=>res.status(500).json({error:'De foto kon niet veilig worden opgeslagen.'}));
  });
  app.post('/api/member/rendezvous/profile-photo/publish',auth,doe('connection.profile.photo.manage',(k,b)=>rvFotoPubliceer(k,b.id,b.visibility,b.publish!==false)));
  app.post('/api/member/rendezvous/profile-photo/remove',auth,doe('connection.profile.photo.manage',(k,b)=>rvFotoVerwijder(k,b.id)));
  app.post('/api/member/rendezvous/profile-photo/order',auth,doe('connection.profile.photo.manage',(k,b)=>rvFotoOrden(k,b.ids)));
  app.get('/api/member/rendezvous/profile-photo/delivery/:ticket',auth,async(req,res)=>{try{const item=await rvFotoLever(req.params.ticket);return item
    ?stuurBuffer(req,res,item.bytes,item.mime,'private, no-store'):res.status(404).end();}catch(e){if(!res.headersSent)res.status(404).end();}});
  app.post('/api/connection/rendezvous/status',auth,doe('connection.message',(k,b)=>rvCommStatus(k,b)));
  app.post('/api/connection/rendezvous/consent',auth,doe('connection.communication.consent',(k,b)=>rvCommConsent(k,b,b.capability,b.active!==false)));
  app.post('/api/connection/rendezvous/text',auth,doe('connection.message',(k,b)=>rvCommText(k,b,b.text)));
  app.post('/api/connection/rendezvous/message/remove',auth,doe('connection.message',(k,b)=>rvCommRemove(k,b,b.messageId)));
  app.post('/api/connection/rendezvous/message/report',auth,doe('connection.safety.block',(k,b)=>rvCommReport(k,b,b.messageId,b.reason)));
  app.post('/api/connection/rendezvous/message-media',auth,express.raw({type:()=>true,limit:'8mb'}),(req,res)=>{
    if(!eisCapability(req,res,'connection.media'))return;
    Promise.resolve(rvCommMedia(req.session.key,{id:req.get('X-RTG-Context')},req.body,req.get('Content-Type')||'',
      req.get('X-RTG-Media-Kind'),req.get('Idempotency-Key'),req.get('X-RTG-Transcript'))).then(r=>stuur(res,r))
      .catch(()=>res.status(500).json({error:'De media kon niet veilig worden verwerkt.'}));
  });
  app.get('/api/connection/rendezvous/message-media/delivery/:ticket',async(req,res)=>{try{const item=await rvCommMediaLever(req.params.ticket);return item
    ?stuurBuffer(req,res,item.bytes,item.mime,'private, no-store'):res.status(404).end();}catch(e){if(!res.headersSent)res.status(404).end();}});
  app.post('/api/connection/rendezvous/call/start',auth,(req,res)=>{const cap=req.body&&req.body.type==='video'?'connection.video':'connection.voice';
    if(!eisCapability(req,res,cap))return;stuur(res,rvCommCallStart(req.session.key,req.body||{},req.body.type,req.get('Idempotency-Key')||req.body.idempotencyKey));});
  app.post('/api/connection/rendezvous/call/answer',auth,doe('connection.call.control',(k,b)=>rvCommCallAnswer(k,b.callId,b.accept)));
  app.post('/api/connection/rendezvous/call/signal',auth,doe('connection.call.control',(k,b)=>rvCommCallSignal(k,b.callId,b.kind,b.payload)));
  app.post('/api/connection/rendezvous/call/poll',auth,doe('connection.call.control',(k,b)=>rvCommCallPoll(k,b.callId,b.after)));
  app.post('/api/connection/rendezvous/call/end',auth,doe('connection.call.control',(k,b)=>rvCommCallEnd(k,b.callId,'ENDED')));
};
