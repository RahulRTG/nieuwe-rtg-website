'use strict';

const P = require('../kern/loop-fabric/protocol');
const D = require('../kern/loop-fabric/delivery');
const envelope = require('../kern/envelop');
const roles = require('./rollen-beleid');
const { werkMutatie } = require('./gebeurtenis');

module.exports = function makeWorkLoopSource({db,bewerkCollectie,serviceProof,now}) {
  const time=now || (()=>new Date().toISOString());
  const read=()=>db.data.werkruimtes || {};
  const tx=fn=>{
    if (typeof bewerkCollectie !== 'function') P.fail('STORAGE_UNAVAILABLE','WorkOS Loop vereist duurzame collectietransacties.',503);
    return bewerkCollectie('werkruimtes',fn);
  };
  function protocolState(workspace) {
    if (!workspace.loopProtocol || workspace.loopProtocol.schemaVersion !== 1)
      workspace.loopProtocol={schemaVersion:1,operations:{},observations:{},lifecycles:{},receipts:{},outbox:[],delivery:{}};
    if (!workspace.loopProtocol.observations) workspace.loopProtocol.observations={};
    if (!workspace.loopProtocol.lifecycles) workspace.loopProtocol.lifecycles={};
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
  function appendEvent(state,event) {
    const prior=state.outbox.at(-1);
    event.sequence=state.outbox.length+1; event.previousHash=prior ? prior.hash : null;
    event.hash=P.hash(event); state.outbox.push(event); return event;
  }
  async function observeIncident(input) {
    try {
      P.fields(input,['actorRef','memberId','workspaceCode','operationId','incidentId','runbookRef','title','text','occurredAt','purpose','verificationOf','assessment']);
      const operationId=P.operationId(input.operationId),actorRef=P.text(input.actorRef,160),memberId=P.text(input.memberId,100);
      const fingerprint=P.hash(input),operationKey=P.hash([actorRef,operationId]);
      return await tx(map=>{
        const workspace=workspaceFrom(map,input.workspaceCode),at=time(),authority=member(workspace,actorRef,memberId,['service'],at);
        const state=protocolState(workspace),previous=state.operations[operationKey];
        if (previous) {
          if (previous.fingerprint!==fingerprint) P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
          return {...P.clone(previous.result),replay:true};
        }
        const incident=workspace.storingen && workspace.storingen[String(input.incidentId || '')];
        if (!incident) P.fail('NOT_FOUND','Deze WorkOS-storing of near-miss bestaat niet.',404);
        const incidentVersion=P.hash({id:incident.id,at:incident.at,begonnenAt:incident.begonnenAt,wat:incident.wat}).slice(0,24);
        const subjectRef={domain:'workos',type:'incident',id:incident.id,version:incidentVersion};
        const runbookRef=input.runbookRef ? P.objectRef(input.runbookRef) : null;
        if (runbookRef) {
          const row=workspace.kennis && workspace.kennis[runbookRef.id];
          if (runbookRef.domain!=='workos' || runbookRef.type!=='runbook' || !row || row.soort!=='runbook' ||
              row.versie!==runbookRef.version || row.vervallen) P.fail('SOURCE_CHANGED','Open de actuele runbookversie.',409);
        }
        const verificationOf=input.verificationOf ? P.objectRef(input.verificationOf) : null;
        if (verificationOf) {
          if (verificationOf.domain!=='workos' || verificationOf.type!=='change-receipt' ||
              !state.receipts[verificationOf.id]) P.fail('NOT_FOUND','Het te verifiëren wijzigingsbewijs bestaat niet in deze bron.',404);
        }
        const id='wobs_'+operationKey.slice(0,27),objectRef={domain:'workos',type:'incident-observation',id,version:1};
        const observation={objectRef,subjectRef,scopeRefs:[subjectRef,runbookRef].filter(Boolean),title:P.text(input.title,160),text:P.text(input.text,4000),
          observedAt:P.instant(input.occurredAt,'occurred_at'),recordedAt:at,sourceActorRef:actorRef,status:'accepted',
          sharing:{visibility:'workspace',purpose:P.text(input.purpose,120),recipients:[{domain:'workos',id:workspace.code}],
            consent:true,returnUpdates:false},basis:'voluntary-workos-report',review:{actorRef,at,authorityRef:{workspace:workspace.code,
            memberId:authority.row.id,rights:authority.rights,policy:authority.policy}},contests:[],verificationOf,
          assessment:verificationOf ? P.text(input.assessment || 'unknown',40) : null};
        state.observations[id]=P.clone(observation);
        const eventId='wlo_'+operationKey.slice(0,28);
        appendEvent(state,{id:eventId,type:verificationOf ? 'workos.verification.observed' : 'workos.incident.observed',
          protocol:P.clone(observation),envelop:envelope.maak({id:eventId,at,kanaal:'workos',actor:actorRef,
            correlatie:operationId,oorzaak:null,classificatie:'intern'})});
        const result={ok:true,workspaceCode:workspace.code,observation:P.clone(observation),replay:false};
        state.operations[operationKey]={fingerprint,result:P.clone(result)}; return result;
      });
    } catch(e) { return P.error(e); }
  }
  async function lifecycleObservation(input) {
    try {
      P.fields(input,['actorRef','memberId','workspaceCode','operationId','observationRef','status','reason']);
      const operationId=P.operationId(input.operationId),actorRef=P.text(input.actorRef,160),memberId=P.text(input.memberId,100);
      if (!['deleted','anonymized','expired'].includes(input.status)) P.fail('INVALID_INPUT','Kies deleted, anonymized of expired.');
      const ref=P.objectRef(input.observationRef),fingerprint=P.hash(input),operationKey=P.hash([actorRef,operationId]);
      return await tx(map=>{
        const workspace=workspaceFrom(map,input.workspaceCode),at=time(); member(workspace,actorRef,memberId,['service'],at);
        const state=protocolState(workspace),previous=state.operations[operationKey];
        if (previous) {
          if (previous.fingerprint!==fingerprint) P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
          return {...P.clone(previous.result),replay:true};
        }
        const observation=state.observations[ref.id];
        if (!observation || !refEqual(observation.objectRef,ref)) P.fail('SOURCE_MISSING','Deze observatie bestaat niet meer.',404);
        const lifecycle={objectRef:P.clone(ref),subjectRef:P.clone(observation.subjectRef),scopeRefs:P.clone(observation.scopeRefs),
          title:'Niet meer beschikbaar',text:'',observedAt:observation.observedAt,recordedAt:at,sourceActorRef:null,
          status:input.status,sharing:{visibility:'restricted',purpose:'unlinked',recipients:[]},basis:'source-lifecycle',
          review:null,contests:[],verificationOf:null,assessment:null,reasonCode:P.text(input.reason,200)};
        delete state.observations[ref.id]; state.lifecycles[ref.id]=P.clone(lifecycle);
        const eventId='wll_'+operationKey.slice(0,28);
        appendEvent(state,{id:eventId,type:'workos.observation.'+input.status,protocol:P.clone(lifecycle),
          envelop:envelope.maak({id:eventId,at,kanaal:'workos',actor:actorRef,correlatie:operationId,oorzaak:null,classificatie:'intern'})});
        const result={ok:true,status:input.status,refHash:P.hash(P.refKey(ref)),replay:false};
        state.operations[operationKey]={fingerprint,result:P.clone(result)}; return result;
      });
    } catch(e) { return P.error(e); }
  }
  async function apply(input) {
    try {
      P.fields(input,['actorRef','memberId','workspaceCode','operationId','decisionId','procedureRef','changeTargetRef','data']);
      const operationId=P.operationId(input.operationId), actorRef=P.text(input.actorRef,160), memberId=P.text(input.memberId,100);
      const changeTargetRef=P.objectRef(input.changeTargetRef || input.procedureRef);
      P.fields(input.data,['title','text','owner','validUntil']);
      const fingerprint=P.hash({workspaceCode:input.workspaceCode,decisionId:input.decisionId,changeTargetRef,data:input.data});
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
        if (!refEqual(decision.loopContext.changeTargetRef || decision.loopContext.procedureRef,changeTargetRef))
          P.fail('DECISION_SOURCE_CHANGED','Het besluit gold voor een andere procedureversie.',409);
        if (changeTargetRef.domain!=='workos' || !['procedure','runbook'].includes(changeTargetRef.type))
          P.fail('INVALID_REF','De wijziging moet een WorkOS-procedure of runbook betreffen.');
        const articles=workspace.kennis || (workspace.kennis={}), old=articles[changeTargetRef.id];
        if (!old || old.vervallen || old.versie!==changeTargetRef.version ||
            (changeTargetRef.type==='runbook' && old.soort!=='runbook'))
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
        const receipt={receiptId,sourceDomain:'workos',protocolVersion:1,sourceObject:{domain:'workos',type:changeTargetRef.type+'-line',id:old.vorigeId || old.id,version:null},
          previousRef:changeTargetRef,newRef:{domain:'workos',type:changeTargetRef.type,id:next.id,version:next.versie},
          changeType:changeTargetRef.type+'.version-created',decisionRef,observationRef:P.clone(decision.loopContext.observationRef),
          expectation:{statement:decision.loopContext.expectation,successCriteria:P.clone(decision.loopContext.successCriteria),
            contextHash:decision.loopContext.contextHash},operationId,correlationId:receiptId,appliedAt:at,
          actorRef,authorityRef:{workspace:workspace.code,memberId:authority.row.id,rights:authority.rights,policy:authority.policy},
          context:{workspaceCode:workspace.code,scopeRefs:P.clone(decision.loopContext.scopeRefs ||
              [decision.loopContext.placeRef,decision.loopContext.blueprintRef].filter(Boolean)),
            placeRef:P.clone(decision.loopContext.placeRef || null),blueprintRef:P.clone(decision.loopContext.blueprintRef || null),
            purpose:decision.loopContext.purpose},integrityRef:null};
        receipt.integrityRef={auditId:audit.gebeurtenis.id,hash:P.hash(receipt)};
        if (serviceProof && typeof serviceProof.tekenBericht==='function')
          receipt.serviceProof=serviceProof.tekenBericht('rtg.service.workos',receipt,{issuedAt:at});
        state.receipts[receiptId]=P.clone(receipt);
        const eventId='wle_'+operationKey.slice(0,28);
        const event={id:eventId,type:'workos.change.applied',receipt:P.clone(receipt),
          envelop:envelope.maak({id:eventId,at,kanaal:'workos',actor:actorRef,
            correlatie:receipt.correlationId,oorzaak:null,classificatie:'intern'})};
        appendEvent(state,event);
        const result={ok:true,workspaceCode:workspace.code,decisionRef,changeReceipt:P.clone(receipt),artifact:P.clone(next),
          procedure:changeTargetRef.type==='procedure' ? P.clone(next) : undefined,replay:false};
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
  function artifact(actorRef,workspaceCode,ref) {
    const allowed=authorization(actorRef,workspaceCode,['kennis']); if (!allowed.ok) return allowed;
    try {
      const r=P.objectRef(ref), workspace=workspaceFrom(read(),workspaceCode), row=workspace.kennis && workspace.kennis[r.id];
      if (r.domain!=='workos' || !['procedure','runbook'].includes(r.type) || !row || row.versie!==r.version ||
          (r.type==='runbook' && row.soort!=='runbook'))
        P.fail('NOT_FOUND','Deze procedureversie is niet beschikbaar.',404);
      return {ok:true,artifact:P.clone(row),procedure:r.type==='procedure' ? P.clone(row) : undefined,current:!row.vervallen,
        currentRef:row.vervallen && row.opgevolgdDoorId ? {domain:'workos',type:r.type,id:row.opgevolgdDoorId,version:row.opgevolgdDoorVersie} : r};
    } catch(e) { return P.error(e); }
  }
  const procedure=(actorRef,workspaceCode,ref)=>artifact(actorRef,workspaceCode,ref);
  function resolveObservation(ref,recipient) {
    try {
      const r=P.objectRef(ref),workspace=workspaceFrom(read(),recipient && recipient.id);
      const lifecycle=workspace.loopProtocol && workspace.loopProtocol.lifecycles && workspace.loopProtocol.lifecycles[r.id];
      if (lifecycle) P.fail(lifecycle.status==='expired'?'SOURCE_EXPIRED':'SOURCE_MISSING',
        'Deze WorkOS-observatie is niet meer beschikbaar.',lifecycle.status==='expired'?410:404);
      const observation=workspace.loopProtocol && workspace.loopProtocol.observations && workspace.loopProtocol.observations[r.id];
      if (r.domain!=='workos' || r.type!=='incident-observation' || !observation || !refEqual(observation.objectRef,r))
        P.fail('SOURCE_MISSING','Deze WorkOS-observatie bestaat niet meer bij de bron.',404);
      if (!(observation.sharing.recipients||[]).some(x=>x.domain===recipient.domain && x.id===recipient.id))
        P.fail('SOURCE_DENIED','Deze observatie is niet met deze ontvanger gedeeld.',403);
      return {ok:true,observation:P.clone(observation),corrected:false};
    } catch(e) { return P.error(e); }
  }
  function protocolEvents(workspaceCode) {
    const spaces=read(), selected=workspaceCode ? [workspaceFrom(spaces,workspaceCode)] : Object.values(spaces);
    return selected.flatMap(workspace=>[
      ...Object.values(workspace.loopProtocol && workspace.loopProtocol.observations || {})
        .map(observation=>({id:'snapshot-work-observation-'+P.hash(P.refKey(observation.objectRef)).slice(0,24),type:'workos.incident.observed',protocol:P.clone(observation)})),
      ...Object.values(workspace.loopProtocol && workspace.loopProtocol.lifecycles || {})
        .map(observation=>({id:'snapshot-work-lifecycle-'+P.hash(P.refKey(observation.objectRef)).slice(0,24),type:'workos.observation.'+observation.status,protocol:P.clone(observation)})),
      ...Object.values(workspace.loopProtocol && workspace.loopProtocol.receipts || {})
        .map(receipt=>({id:'snapshot-work-receipt-'+P.hash(receipt.receiptId).slice(0,24),type:'workos.change.applied',receipt:P.clone(receipt)}))]);
  }
  async function deliver(workspaceCode,consumer,handle,limit=100,options={}) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle!=='function') throw new Error('Invalid WorkOS Loop consumer');
    if (limit && typeof limit==='object') { options=limit; limit=100; }
    const workspace=workspaceFrom(read(),workspaceCode), start=D.checkpoint(workspace.loopProtocol && workspace.loopProtocol.delivery[consumer]);
    const workerId=options.workerId || 'workos-'+P.hash([process.pid,consumer,time(),Math.random()]).slice(0,16);
    let cursor=start.sequence,blocked=null;
    const events=(workspace.loopProtocol && workspace.loopProtocol.outbox || []).filter(e=>e.sequence>cursor)
      .sort((a,b)=>a.sequence-b.sequence).slice(0,Math.max(1,Math.min(limit,100)));
    for (const event of events) {
      const at=time(),claimed=await tx(map=>{
        const current=workspaceFrom(map,workspaceCode),state=protocolState(current);
        return D.claim(state.delivery,consumer,event,{at,workerId,leaseMs:options.leaseMs});
      });
      if (!claimed.claimed) { if (claimed.complete) { cursor=Math.max(cursor,event.sequence); continue; } blocked=claimed.lease; break; }
      try { await handle(P.clone(event)); }
      catch(error) {
        const failure=await tx(map=>{
          const current=workspaceFrom(map,workspaceCode),state=protocolState(current);
          return D.failed(state.delivery,consumer,event,error,{at:time(),workerId,maxAttempts:options.maxAttempts});
        });
        if (failure.deadLettered) throw Object.assign(new Error('Delivery staat in de dead-letterwachtrij.'),
          {loopFabric:true,code:'DEAD_LETTERED',status:503,eventId:event.id});
        throw error;
      }
      await tx(map=>{
        const current=workspaceFrom(map,workspaceCode),state=protocolState(current);
        D.complete(state.delivery,consumer,event,{at:time(),workerId});
      });
      cursor=event.sequence;
    }
    return {deliveredThrough:cursor,blocked};
  }
  function deliveryStatus(workspaceCode,consumer) {
    const workspace=workspaceFrom(read(),workspaceCode),state=workspace.loopProtocol || {outbox:[],delivery:{}};
    return D.summary(state.delivery && state.delivery[consumer],(state.outbox||[]).length,time());
  }
  async function replayDeadLetter(workspaceCode,consumer,eventId) {
    return tx(map=>{
      const workspace=workspaceFrom(map,workspaceCode),state=protocolState(workspace);
      return {ok:true,...D.replay(state.delivery,consumer,eventId,time())};
    });
  }
  function verifyReceipt(receipt) {
    if (!receipt || receipt.sourceDomain!=='workos') return {ok:false,code:'SERVICE_PROOF_INVALID',error:'Receipt issuer en brondomein verschillen.'};
    if (!receipt.serviceProof) return {ok:true,mode:'in-process'};
    if (!serviceProof || typeof serviceProof.controleerBericht!=='function')
      return {ok:false,code:'SERVICE_PROOF_UNAVAILABLE',error:'De servicehandtekening kan hier niet worden gecontroleerd.'};
    const payload=P.clone(receipt); delete payload.serviceProof;
    const checked=serviceProof.controleerBericht(receipt.serviceProof,payload);
    return checked.geldig && checked.issuer==='rtg.service.workos' ? {ok:true,mode:'signed',proof:checked}
      : {ok:false,code:'SERVICE_PROOF_INVALID',error:'De WorkOS-servicehandtekening klopt niet.'};
  }
  return {apply,observeIncident,lifecycleObservation,authorization,artifact,procedure,resolveObservation,protocolEvents,
    deliver,deliveryStatus,replayDeadLetter,verifyReceipt};
};
