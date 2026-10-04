'use strict';

module.exports = (sctx) => {
  const { app, werkPoort, workLoopSource } = sctx;
  if (!workLoopSource) return {};
  app.post('/api/bedrijf/loop/procedure/change', async (req,res)=>{
    const access=werkPoort(req,res,'kennis'); if (!access) return;
    if (!access.rechten.includes('besluit'))
      return res.status(403).json({error:'Deze wijziging vereist zowel kennis- als besluitbevoegdheid.',code:'AUTHORITY_DENIED'});
    if (!access.l || !access.l.id)
      return res.status(403).json({error:'Een bronwijziging vereist een persoonlijk WorkOS-lid; het gedeelde beheer-token volstaat niet.',code:'PERSONAL_AUTHORITY_REQUIRED'});
    const actorRef=access.l.rtgKey || 'work-member:'+access.l.id;
    const out=await workLoopSource.apply({actorRef,memberId:access.l.id,workspaceCode:access.w.code,
      operationId:req.body.operationId,decisionId:req.body.decisionId,procedureRef:req.body.procedureRef,
      data:req.body.data});
    res.status(out.status || 200).json(out);
  });
  return {};
};
