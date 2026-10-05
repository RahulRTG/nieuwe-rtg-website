'use strict';
const {idVanKey}=require('../lib/lidsleutel');

module.exports=({app,auth,loopFabric})=>{
  const send=(res,out)=>res.status(out.status || 200).json(out);
  const sync=async workspaceCode=>loopFabric.sync(String(workspaceCode || '').trim().toUpperCase());
  const consumerOf=value=>value && value.consumer && value.consumer.domain==='leerhuis'
    ? {domain:'leerhuis',id:String(value.consumer.id || '')}
    : {domain:'workos',id:String(value && value.workspaceCode || '').trim().toUpperCase()};
  const syncFor=async value=>{
    const consumer=consumerOf(value);
    return consumer.domain==='workos' ? sync(consumer.id) : loopFabric.syncSource(consumer.domain,consumer.id);
  };
  const actorFor=(req,consumer)=>{
    if (consumer.domain!=='leerhuis') return req.session.key;
    const id=idVanKey(req.session.key); return id==null ? null : 'lid:'+id;
  };
  app.post('/api/loop/observation/inbox',auth,async(req,res)=>{
    try {
      const consumer=consumerOf(req.body),actor=actorFor(req,consumer);
      if (!actor) return send(res,{status:403,code:'IDENTITY_REQUIRED',error:'Het Leerhuis vereist een eigen RTG-lidaccount.'});
      await syncFor(req.body); send(res,consumer.domain==='workos' ? loopFabric.inbox(actor,consumer.id) : loopFabric.inboxFor(actor,consumer));
    }
    catch(e) { send(res,{status:e.status || 503,code:e.code || 'HANDOFF_UNAVAILABLE',error:'De overdracht kon nog niet worden bijgewerkt.'}); }
  });
  app.post('/api/loop/recall/present',auth,async(req,res)=>{
    try {
      const context=req.body.context || {},consumer=consumerOf(context),actor=actorFor(req,consumer);
      if (!actor) return send(res,{status:403,code:'IDENTITY_REQUIRED',error:'Het Leerhuis vereist een eigen RTG-lidaccount.'});
      await syncFor(context); send(res,await loopFabric.present(actor,req.body));
    }
    catch(e) { send(res,{status:e.status || 503,code:e.code || 'HANDOFF_UNAVAILABLE',error:'Recall kon de actuele bronnen nog niet bevestigen.'}); }
  });
  app.post('/api/loop/recall/disposition',auth,async(req,res)=>{
    const consumer=loopFabric.consumerForRecall(req.body.recallId) || {domain:'workos',id:''};
    const actor=actorFor(req,consumer);
    if (!actor) return send(res,{status:403,code:'IDENTITY_REQUIRED',error:'Het Leerhuis vereist een eigen RTG-lidaccount.'});
    send(res,await loopFabric.disposition(actor,req.body));
  });
  app.post('/api/loop/proof',auth,async(req,res)=>{
    try { await sync(req.body.workspaceCode); send(res,loopFabric.proof(req.session.key,req.body.workspaceCode)); }
    catch(e) { send(res,{status:e.status || 503,code:e.code || 'HANDOFF_UNAVAILABLE',error:'Het ketenbewijs kon de bronnen nog niet synchroniseren.'}); }
  });
};
