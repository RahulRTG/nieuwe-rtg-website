'use strict';

/* Alleen de expliciete D15-promotiepoort. De routes krijgen dezelfde
   ledenbalie-authenticatie en named seat als de Service Case zelf. */
module.exports=function serviceKantoorLearning(kern,{veilig,lijf,kort,balieAuth}){
  const {app,officeAuth,serviceLoopSource}=kern;
  app.post('/api/office/service/learning/review',officeAuth,balieAuth,(req,res)=>veilig(res,()=>{
    const b=lijf(req);return serviceLoopSource.reviewCase({actorRef:req.balieKey,operationId:kort(b.operationId,160),
      caseId:kort(b.caseId,40),workspaceCode:kort(b.workspaceCode,40),processId:kort(b.processId,80),
      purpose:kort(b.purpose,120),verificationOf:b.verificationOf||null});
  }));
  app.post('/api/office/service/learning/withdraw',officeAuth,balieAuth,(req,res)=>veilig(res,()=>{
    const b=lijf(req);return serviceLoopSource.withdraw({actorRef:req.balieKey,operationId:kort(b.operationId,160),
      observationRef:b.observationRef,workspaceCode:kort(b.workspaceCode,40),reason:kort(b.reason,300)});
  }));
};
