'use strict';

module.exports = (sctx) => {
  const { app, werkPoort, workLoopSource } = sctx;
  if (!workLoopSource) return {};
  const change=kind=>async (req,res)=>{
    const access=werkPoort(req,res,'kennis'); if (!access) return;
    if (!access.rechten.includes('besluit'))
      return res.status(403).json({error:'Deze wijziging vereist zowel kennis- als besluitbevoegdheid.',code:'AUTHORITY_DENIED'});
    if (!access.l || !access.l.id)
      return res.status(403).json({error:'Een bronwijziging vereist een persoonlijk WorkOS-lid; het gedeelde beheer-token volstaat niet.',code:'PERSONAL_AUTHORITY_REQUIRED'});
    const actorRef=access.l.rtgKey || 'work-member:'+access.l.id;
    const out=await workLoopSource.apply({actorRef,memberId:access.l.id,workspaceCode:access.w.code,
      operationId:req.body.operationId,decisionId:req.body.decisionId,
      [kind==='procedure' ? 'procedureRef' : 'changeTargetRef']:req.body[kind==='procedure' ? 'procedureRef' : 'changeTargetRef'],
      data:req.body.data});
    res.status(out.status || 200).json(out);
  };
  app.post('/api/bedrijf/loop/procedure/change',change('procedure'));
  app.post('/api/bedrijf/loop/runbook/change',change('runbook'));
  app.post('/api/bedrijf/loop/incident/observe',async (req,res)=>{
    const access=werkPoort(req,res,'service'); if (!access) return;
    if (!access.l || !access.l.id)
      return res.status(403).json({error:'Een observatie vereist een persoonlijk WorkOS-lid.',code:'PERSONAL_AUTHORITY_REQUIRED'});
    const actorRef=access.l.rtgKey || 'work-member:'+access.l.id;
    const out=await workLoopSource.observeIncident({actorRef,memberId:access.l.id,workspaceCode:access.w.code,
      operationId:req.body.operationId,incidentId:req.body.incidentId,runbookRef:req.body.runbookRef,
      title:req.body.title,text:req.body.text,occurredAt:req.body.occurredAt,purpose:req.body.purpose,
      verificationOf:req.body.verificationOf,assessment:req.body.assessment});
    res.status(out.status || 200).json(out);
  });
  return {};
};
