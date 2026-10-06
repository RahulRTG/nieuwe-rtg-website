'use strict';
const P=require('../kern/loop-fabric/protocol');
const envelope=require('../kern/envelop');
const {werkMutatie}=require('./gebeurtenis');
module.exports=({tx,time,workspaceFrom,protocolState,member,refEqual,appendEvent,serviceProof})=>async function apply(input){
  try {
    P.fields(input,['actorRef','memberId','workspaceCode','operationId','decisionId','procedureRef','changeTargetRef','data']);
    const operationId=P.operationId(input.operationId),actorRef=P.text(input.actorRef,160),memberId=P.text(input.memberId,100),
      changeTargetRef=P.objectRef(input.changeTargetRef||input.procedureRef),operationKey=P.hash([actorRef,operationId]);
    P.fields(input.data,['title','text','owner','validUntil']);
    const fingerprint=P.hash({workspaceCode:input.workspaceCode,decisionId:input.decisionId,changeTargetRef,data:input.data});
    return await tx(map=>{
      const workspace=workspaceFrom(map,input.workspaceCode),at=time(),authority=member(workspace,actorRef,memberId,undefined,at),
        state=protocolState(workspace),previous=state.operations[operationKey];
      if(previous){if(previous.fingerprint!==fingerprint)P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
        return {...P.clone(previous.result),replay:true};}
      const decision=workspace.besluiten&&workspace.besluiten[String(input.decisionId||'')];
      if(!decision||decision.status!=='aangenomen'||!decision.loopContext)P.fail('DECISION_REQUIRED','Een aangenomen, versiegebonden WorkOS-besluit is vereist.',409);
      if(!decision.loopContext.validation||decision.loopContext.validation.policyId!=='loop-decision-source-context')
        P.fail('DECISION_CONTEXT_UNVERIFIED','De beslisgrond is niet door de actuele brondomeinen bevestigd.',409);
      if(!refEqual(decision.loopContext.changeTargetRef||decision.loopContext.procedureRef,changeTargetRef))
        P.fail('DECISION_SOURCE_CHANGED','Het besluit gold voor een andere procedureversie.',409);
      if(changeTargetRef.domain!=='workos'||!['procedure','runbook'].includes(changeTargetRef.type))
        P.fail('INVALID_REF','De wijziging moet een WorkOS-procedure of runbook betreffen.');
      const articles=workspace.kennis||(workspace.kennis={}),old=articles[changeTargetRef.id];
      if(!old||old.vervallen||old.versie!==changeTargetRef.version||(changeTargetRef.type==='runbook'&&old.soort!=='runbook'))
        P.fail('SOURCE_CHANGED','De procedure is inmiddels gewijzigd.',409);
      const id='ken_loop_'+operationKey.slice(0,20);if(articles[id])P.fail('REPLAY_CONFLICT','De nieuwe procedure-ID bestaat al.',409);
      const title=P.text(input.data.title,120),body=P.text(input.data.text,20000),owner=P.text(input.data.owner||old.eigenaar,60),
        validUntil=input.data.validUntil==null||input.data.validUntil===''?null:P.text(input.data.validUntil,10);
      if(validUntil&&!/^\d{4}-\d{2}-\d{2}$/.test(validUntil))P.fail('INVALID_INPUT','Gebruik een geldige houdbaarheidsdatum.');
      const next={id,titel:title,tekst:body,soort:old.soort||'procedure',eigenaar:owner,versie:old.versie+1,recht:old.recht||null,
        vorigeId:old.id,vervallen:false,geldigTot:validUntil,laatstGecontroleerd:at.slice(0,10),at,door:authority.row.naam,
        loopDecisionRef:{domain:'workos',type:'decision',id:decision.id,version:decision.geslotenAt}};
      old.vervallen=true;old.vervallenAt=at;old.opgevolgdDoorVersie=next.versie;old.opgevolgdDoorId=next.id;articles[next.id]=next;
      const audit=werkMutatie(workspace,{objectType:'kennis',objectId:next.id,eventType:'kennis.version',van:old.id,naar:next.id,
        actor:authority.row.naam,reden:decision.titel,bron:'workos/loop',occurredAt:at});
      if(!audit.ok)P.fail('AUDIT_REJECTED',audit.error,audit.status);
      const receiptId='wcr_'+operationKey.slice(0,28),decisionRef={domain:'workos',type:'decision',id:decision.id,version:decision.geslotenAt};
      const receipt={receiptId,sourceDomain:'workos',protocolVersion:1,sourceObject:{domain:'workos',type:changeTargetRef.type+'-line',
        id:old.vorigeId||old.id,version:null},previousRef:changeTargetRef,newRef:{domain:'workos',type:changeTargetRef.type,id:next.id,
        version:next.versie},changeType:changeTargetRef.type+'.version-created',decisionRef,
        observationRef:P.clone(decision.loopContext.observationRef),expectation:{statement:decision.loopContext.expectation,
          successCriteria:P.clone(decision.loopContext.successCriteria),contextHash:decision.loopContext.contextHash},operationId,
        correlationId:receiptId,appliedAt:at,actorRef,authorityRef:{workspace:workspace.code,memberId:authority.row.id,
          rights:authority.rights,policy:authority.policy},context:{workspaceCode:workspace.code,
          scopeRefs:P.clone(decision.loopContext.scopeRefs||[decision.loopContext.placeRef,decision.loopContext.blueprintRef].filter(Boolean)),
          placeRef:P.clone(decision.loopContext.placeRef||null),blueprintRef:P.clone(decision.loopContext.blueprintRef||null),
          purpose:decision.loopContext.purpose},integrityRef:null};
      receipt.integrityRef={auditId:audit.gebeurtenis.id,hash:P.hash(receipt)};
      if(serviceProof&&typeof serviceProof.tekenBericht==='function')receipt.serviceProof=serviceProof.tekenBericht('rtg.service.workos',receipt,{issuedAt:at});
      state.receipts[receiptId]=P.clone(receipt);const eventId='wle_'+operationKey.slice(0,28);
      appendEvent(state,{id:eventId,type:'workos.change.applied',receipt:P.clone(receipt),envelop:envelope.maak({id:eventId,at,
        kanaal:'workos',actor:actorRef,correlatie:receipt.correlationId,oorzaak:null,classificatie:'intern'})});
      const result={ok:true,workspaceCode:workspace.code,decisionRef,changeReceipt:P.clone(receipt),artifact:P.clone(next),
        procedure:changeTargetRef.type==='procedure'?P.clone(next):undefined,replay:false};
      state.operations[operationKey]={fingerprint,result:P.clone(result)};return result;
    });
  }catch(e){return P.error(e);}
};
