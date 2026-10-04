'use strict';

const P = require('../kern/loop-fabric/protocol');
const envelope = require('../kern/envelop');
const roles = require('./rollen-beleid');
const { werkMutatie } = require('./gebeurtenis');

module.exports = function makeWorkLoopSource({db,bewerkCollectie,now}) {
  const time=now || (()=>new Date().toISOString());
  const read=()=>db.data.werkruimtes || {};
  const tx=fn=>{
    if (typeof bewerkCollectie !== 'function') P.fail('STORAGE_UNAVAILABLE','WorkOS Loop vereist duurzame collectietransacties.',503);
    return bewerkCollectie('werkruimtes',fn);
  };
  function protocolState(workspace) {
    if (!workspace.loopProtocol || workspace.loopProtocol.schemaVersion !== 1)
      workspace.loopProtocol={schemaVersion:1,operations:{},receipts:{},outbox:[],delivery:{}};
    return workspace.loopProtocol;
  }
  function member(workspace,actorRef,memberId,required=['kennis','besluit'],at=time()) {
    const row=workspace && workspace.leden && workspace.leden[memberId];
    const expected=row && (row.rtgKey || 'work-member:'+row.id);
    if (!row || row.status !== 'actief' || expected !== actorRef)
      P.fail('AUTHORITY_REVOKED','Uw WorkOS-bevoegdheid is niet meer geldig.',403);
    const current=roles.rechtenVan(row,at.slice(0,10));
    const missing=required.filter(right=>!current.includes(right));
    if (missing.length) P.fail('AUTHORITY_REVOKED','De vereiste WorkOS-bevoegdheid is ingetrokken.',403);
    return {row,rights:required.slice(),policy:{id:'workos.roles',version:1}};
  }
  function workspaceFrom(map,code) {
    const w=map[String(code || '').trim().toUpperCase()];
    if (!w) P.fail('NOT_FOUND','Deze werkruimte is niet beschikbaar.',404);
    return w;
  }
  function refEqual(left,right) { return P.refKey(P.objectRef(left))===P.refKey(P.objectRef(right)); }
  async function apply(input) {
    try {
      P.fields(input,['actorRef','memberId','workspaceCode','operationId','decisionId','procedureRef','data']);
      const operationId=P.operationId(input.operationId), actorRef=P.text(input.actorRef,160), memberId=P.text(input.memberId,100);
      const procedureRef=P.objectRef(input.procedureRef);
      P.fields(input.data,['title','text','owner','validUntil']);
      const fingerprint=P.hash({workspaceCode:input.workspaceCode,decisionId:input.decisionId,procedureRef,data:input.data});
      const operationKey=P.hash([actorRef,operationId]);
      return await tx(map=>{
        const workspace=workspaceFrom(map,input.workspaceCode), at=time(), authority=member(workspace,actorRef,memberId,undefined,at);
        const state=protocolState(workspace), previous=state.operations[operationKey];
        if (previous) {
          if (previous.fingerprint!==fingerprint) P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
          return {...P.clone(previous.result),replay:true};
        }
        const decision=workspace.besluiten && workspace.besluiten[String(input.decisionId || '')];
        if (!decision || decision.status!=='aangenomen' || !decision.loopContext)
          P.fail('DECISION_REQUIRED','Een aangenomen, versiegebonden WorkOS-besluit is vereist.',409);
        if (!decision.loopContext.validation || decision.loopContext.validation.policyId!=='loop-decision-source-context')
          P.fail('DECISION_CONTEXT_UNVERIFIED','De beslisgrond is niet door de actuele brondomeinen bevestigd.',409);
        if (!refEqual(decision.loopContext.procedureRef,procedureRef))
          P.fail('DECISION_SOURCE_CHANGED','Het besluit gold voor een andere procedureversie.',409);
        if (procedureRef.domain!=='workos' || procedureRef.type!=='procedure')
          P.fail('INVALID_REF','De wijziging moet een WorkOS-procedure betreffen.');
        const articles=workspace.kennis || (workspace.kennis={}), old=articles[procedureRef.id];
        if (!old || old.vervallen || old.versie!==procedureRef.version)
          P.fail('SOURCE_CHANGED','De procedure is inmiddels gewijzigd.',409);
        const id='ken_loop_'+operationKey.slice(0,20);
        if (articles[id]) P.fail('REPLAY_CONFLICT','De nieuwe procedure-ID bestaat al.',409);
        const title=P.text(input.data.title,120), body=P.text(input.data.text,20000), owner=P.text(input.data.owner || old.eigenaar,60);
        const validUntil=input.data.validUntil==null || input.data.validUntil==='' ? null : P.text(input.data.validUntil,10);
        if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) P.fail('INVALID_INPUT','Gebruik een geldige houdbaarheidsdatum.');
        const next={id,titel:title,tekst:body,soort:old.soort || 'procedure',eigenaar:owner,
          versie:old.versie+1,recht:old.recht || null,vorigeId:old.id,vervallen:false,
          geldigTot:validUntil,laatstGecontroleerd:at.slice(0,10),at,door:authority.row.naam,
          loopDecisionRef:{domain:'workos',type:'decision',id:decision.id,version:decision.geslotenAt}};
        old.vervallen=true; old.vervallenAt=at; old.opgevolgdDoorVersie=next.versie; old.opgevolgdDoorId=next.id;
        articles[next.id]=next;
        const audit=werkMutatie(workspace,{objectType:'kennis',objectId:next.id,eventType:'kennis.version',
          van:old.id,naar:next.id,actor:authority.row.naam,reden:decision.titel,bron:'workos/loop',occurredAt:at});
        if (!audit.ok) P.fail('AUDIT_REJECTED',audit.error,audit.status);
        const receiptId='wcr_'+operationKey.slice(0,28), decisionRef={domain:'workos',type:'decision',id:decision.id,version:decision.geslotenAt};
        const receipt={receiptId,sourceDomain:'workos',sourceObject:{domain:'workos',type:'procedure-line',id:old.vorigeId || old.id,version:null},
          previousRef:procedureRef,newRef:{domain:'workos',type:'procedure',id:next.id,version:next.versie},
          changeType:'procedure.version-created',decisionRef,observationRef:P.clone(decision.loopContext.observationRef),
          expectation:{statement:decision.loopContext.expectation,successCriteria:P.clone(decision.loopContext.successCriteria),
            contextHash:decision.loopContext.contextHash},operationId,correlationId:receiptId,appliedAt:at,
          actorRef,authorityRef:{workspace:workspace.code,memberId:authority.row.id,rights:authority.rights,policy:authority.policy},
          context:{workspaceCode:workspace.code,placeRef:P.clone(decision.loopContext.placeRef),
            blueprintRef:P.clone(decision.loopContext.blueprintRef),purpose:decision.loopContext.purpose},integrityRef:null};
        receipt.integrityRef={auditId:audit.gebeurtenis.id,hash:P.hash(receipt)};
        state.receipts[receiptId]=P.clone(receipt);
        const eventId='wle_'+operationKey.slice(0,28), prior=state.outbox.at(-1);
        const event={id:eventId,sequence:state.outbox.length+1,type:'workos.change.applied',receipt:P.clone(receipt),
          previousHash:prior ? prior.hash : null,envelop:envelope.maak({id:eventId,at,kanaal:'workos',actor:actorRef,
            correlatie:receipt.correlationId,oorzaak:null,classificatie:'intern'})};
        event.hash=P.hash(event); state.outbox.push(event);
        const result={ok:true,workspaceCode:workspace.code,decisionRef,changeReceipt:P.clone(receipt),procedure:P.clone(next),replay:false};
        state.operations[operationKey]={fingerprint,result:P.clone(result)};
        return result;
      });
    } catch(e) { return P.error(e); }
  }
  function authorization(actorRef,workspaceCode,required=['kennis']) {
    try {
      const workspace=workspaceFrom(read(),workspaceCode);
      const row=Object.values(workspace.leden || {}).find(l=>(l.rtgKey || 'work-member:'+l.id)===actorRef);
      const authority=member(workspace,actorRef,row && row.id,required);
      return {ok:true,workspaceCode:workspace.code,memberId:authority.row.id,rights:authority.rights};
    } catch(e) { return P.error(e); }
  }
  function procedure(actorRef,workspaceCode,ref) {
    const allowed=authorization(actorRef,workspaceCode,['kennis']); if (!allowed.ok) return allowed;
    try {
      const r=P.objectRef(ref), workspace=workspaceFrom(read(),workspaceCode), row=workspace.kennis && workspace.kennis[r.id];
      if (r.domain!=='workos' || r.type!=='procedure' || !row || row.versie!==r.version)
        P.fail('NOT_FOUND','Deze procedureversie is niet beschikbaar.',404);
      return {ok:true,procedure:P.clone(row),current:!row.vervallen,
        currentRef:row.vervallen && row.opgevolgdDoorId ? {domain:'workos',type:'procedure',id:row.opgevolgdDoorId,version:row.opgevolgdDoorVersie} : r};
    } catch(e) { return P.error(e); }
  }
  function protocolEvents(workspaceCode) {
    const spaces=read(), selected=workspaceCode ? [workspaceFrom(spaces,workspaceCode)] : Object.values(spaces);
    return selected.flatMap(workspace=>Object.values(workspace.loopProtocol && workspace.loopProtocol.receipts || {})
      .map(receipt=>({id:'snapshot-'+receipt.receiptId,type:'workos.change.applied',receipt:P.clone(receipt)})));
  }
  async function deliver(workspaceCode,consumer,handle,limit=100) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle!=='function') throw new Error('Invalid WorkOS Loop consumer');
    const workspace=workspaceFrom(read(),workspaceCode), start=workspace.loopProtocol && workspace.loopProtocol.delivery[consumer] || 0;
    let cursor=start;
    const events=(workspace.loopProtocol && workspace.loopProtocol.outbox || []).filter(e=>e.sequence>start)
      .slice(0,Math.max(1,Math.min(limit,100)));
    for (const event of events) {
      await handle(P.clone(event));
      await tx(map=>{
        const current=workspaceFrom(map,workspaceCode), state=protocolState(current), seen=state.delivery[consumer] || 0;
        if (seen<cursor) P.fail('CURSOR_CONFLICT','Herhaal de overdracht vanaf het duurzame checkpoint.',409);
        if (seen===cursor) state.delivery[consumer]=event.sequence;
      });
      cursor=event.sequence;
    }
    return {deliveredThrough:cursor};
  }
  return {apply,authorization,procedure,protocolEvents,deliver};
};
