'use strict';

module.exports=({app,auth,loopFabric})=>{
  const send=(res,out)=>res.status(out.status || 200).json(out);
  const sync=async workspaceCode=>loopFabric.sync(String(workspaceCode || '').trim().toUpperCase());
  app.post('/api/loop/observation/inbox',auth,async(req,res)=>{
    try { await sync(req.body.workspaceCode); send(res,loopFabric.inbox(req.session.key,req.body.workspaceCode)); }
    catch(e) { send(res,{status:e.status || 503,code:e.code || 'HANDOFF_UNAVAILABLE',error:'De overdracht kon nog niet worden bijgewerkt.'}); }
  });
  app.post('/api/loop/recall/present',auth,async(req,res)=>{
    try { await sync(req.body.context && req.body.context.workspaceCode); send(res,await loopFabric.present(req.session.key,req.body)); }
    catch(e) { send(res,{status:e.status || 503,code:e.code || 'HANDOFF_UNAVAILABLE',error:'Recall kon de actuele bronnen nog niet bevestigen.'}); }
  });
  app.post('/api/loop/recall/disposition',auth,async(req,res)=>send(res,
    await loopFabric.disposition(req.session.key,req.body)));
  app.post('/api/loop/proof',auth,async(req,res)=>{
    try { await sync(req.body.workspaceCode); send(res,loopFabric.proof(req.session.key,req.body.workspaceCode)); }
    catch(e) { send(res,{status:e.status || 503,code:e.code || 'HANDOFF_UNAVAILABLE',error:'Het ketenbewijs kon de bronnen nog niet synchroniseren.'}); }
  });
};
