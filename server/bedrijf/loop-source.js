'use strict';

const P = require('../kern/loop-fabric/protocol');
const envelope = require('../kern/envelop');
const roles = require('./rollen-beleid');
const eligibility = require('../kern/loop-fabric/learning-eligibility');

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
  function observationEligibility(observation) {
    return eligibility.issue({sourceRef:observation.objectRef,purpose:observation.sharing.purpose,
      memoryClass:'ORGANIZATIONAL',audience:observation.sharing.recipients,
      basis:{type:'VOLUNTARY_WORKPLACE_SAFETY_REPORT'},allowedFields:['title','text','observedAt','status','assessment'],
      uses:{decision:true,recall:true,'cross-domain':false,ai:false,aggregate:false,publish:false},issuedAt:observation.recordedAt,
      validUntil:null,retention:{mode:'SOURCE_LIFECYCLE',policyId:'workos.incident-observation.lifecycle.v1'},
      epistemicType:'HUMAN_STATED',capabilityId:'bedrijf'});
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
        observation.eligibility=observationEligibility(observation);
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
  const lifecycleObservation=require('./loop-source-lifecycle')({tx,time,workspaceFrom,protocolState,member,refEqual,appendEvent});
  const apply=require('./loop-source-change')({tx,time,workspaceFrom,protocolState,member,refEqual,appendEvent,serviceProof});
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
  function learningEligibility(ref,recipient,request={}) {
    const resolved=resolveObservation(ref,recipient);if(!resolved.ok)return resolved;
    return eligibility.evaluate(observationEligibility(resolved.observation),{sourceRef:ref,purpose:request.purpose,
      recipient,use:request.use||'recall'},time());
  }
  const transport=require('./loop-source-transport')({read,tx,time,workspaceFrom,protocolState,serviceProof});
  return {apply,observeIncident,lifecycleObservation,authorization,artifact,procedure,resolveObservation,learningEligibility,...transport};
};
