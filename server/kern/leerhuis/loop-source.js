'use strict';

const P=require('../loop-fabric/protocol');
const D=require('../loop-fabric/delivery');
const serviceReceipt=require('../loop-fabric/service-receipt');
const eligibility=require('../loop-fabric/learning-eligibility');
const {heeftBestuur,relatieActief}=require('./oordeel');

module.exports=function makeAcademyLoopSource({db,bewerkCollectie,leerhuis,serviceProof,now}) {
  const time=now || (()=>new Date().toISOString());
  const tx=fn=>{
    if (typeof bewerkCollectie!=='function') P.fail('STORAGE_UNAVAILABLE','Leerhuis Loop-delivery vereist duurzame collectietransacties.',503);
    return bewerkCollectie('leerhuisLoopDelivery',fn);
  };
  function state(raw) {
    if (!raw || Object.keys(raw).length===0) return {schemaVersion:1,organizations:{}};
    if (raw.schemaVersion!==1 || !raw.organizations) P.fail('SCHEMA_UNAVAILABLE','Onbekende Leerhuis Loop-deliverystaat.',503);
    return raw;
  }
  function academy(org) {
    const st=leerhuis.stand(String(org || ''));
    if (!st.org) P.fail('NOT_FOUND','Dit leerhuis bestaat niet.',404);
    return st;
  }
  function authorization(actorRef,org,required=[]) {
    try {
      const st=academy(org),actor=P.text(actorRef,160);
      if (!relatieActief(st,actor)) P.fail('AUTHORITY_REVOKED','De relatie met dit leerhuis is niet meer actief.',403);
      const roles=st.bestuur[actor] || [];
      if (required.includes('besluit') && !roles.includes('KNOWLEDGE_OWNER'))
        P.fail('AUTHORITY_REVOKED','Praktijkvoorstellen behandelen vraagt actuele KNOWLEDGE_OWNER-bevoegdheid.',403);
      if (required.includes('kennis') && !roles.some(role=>['KNOWLEDGE_OWNER','CURRICULUM_OWNER','QUALITY_AUTHORITY'].includes(role)))
        P.fail('AUTHORITY_REVOKED','Deze kenniscontext is alleen voor het actuele Leerhuis-bestuur.',403);
      return {ok:true,organizationCode:st.id,actorRef:actor,roles:P.clone(roles),policy:{id:'leerhuis.bestuur',version:1}};
    } catch(e) { return P.error(e); }
  }
  const proposalRef=row=>({domain:'leerhuis',type:'practice-observation',id:row.data.id,version:row.at});
  function knowledgeRef(org,data) {
    return data.kennis && data.kennisVersie ? {domain:'leerhuis',type:'knowledge',id:org+':'+data.kennis,version:data.kennisVersie}
      : {domain:'leerhuis',type:'organization',id:org,version:1};
  }
  function observation(org,row) {
    const subjectRef=knowledgeRef(org,row.data),verificationOf=row.data.verificationOf ? P.objectRef(row.data.verificationOf) : null;
    const out={objectRef:proposalRef(row),subjectRef,scopeRefs:[subjectRef],title:'Praktijkvoorstel voor '+(row.data.kennis || org),
      text:[row.data.probleem,row.data.voorstel,row.data.reden].filter(Boolean).join('\n'),observedAt:row.at,recordedAt:row.at,
      sourceActorRef:null,status:'submitted',sharing:{visibility:'organization',purpose:row.data.purpose || 'academy-practice-improvement',
        recipients:[{domain:'leerhuis',id:org}],consent:true,returnUpdates:true},basis:'human-practice-proposal',
      review:null,contests:[],verificationOf,assessment:verificationOf ? (row.data.assessment || 'unknown') : null};
    out.eligibility=eligibility.issue({sourceRef:out.objectRef,purpose:out.sharing.purpose,memoryClass:'ORGANIZATIONAL',
      audience:out.sharing.recipients,basis:{type:'VOLUNTARY_PRACTICE_PROPOSAL'},
      allowedFields:['title','text','observedAt','status','contests','assessment'],uses:{decision:true,recall:true,'cross-domain':false,
        ai:false,aggregate:false,publish:false},issuedAt:out.recordedAt,validUntil:null,
      retention:{mode:'SOURCE_LIFECYCLE',policyId:'leerhuis.practice-proposal.lifecycle.v1'},epistemicType:'HUMAN_STATED'});
    return out;
  }
  function protocolEvents(org) {
    return leerhuis.spoor(org).slice().reverse().flatMap(row=>{
      const id='lhe_'+P.hash([org,row.nr,row.hash]).slice(0,30);
      if (row.soort==='voorstel') return [{id,sequence:row.nr,type:row.data.verificationOf ?
        'leerhuis.verification.observed':'leerhuis.practice.observed',protocol:observation(org,row),
        sourceAuditRef:{nr:row.nr,hash:row.hash}}];
      if (row.soort==='loopChangeReceipt') {
        const receipt={...P.clone(row.data),integrityRef:{auditId:'leerhuis:'+org+':'+row.nr,hash:row.hash}};
        receipt.protocolVersion=1;
        if (serviceProof && typeof serviceProof.tekenBericht==='function')
          receipt.serviceProof=serviceProof.tekenBericht('rtg.service.leerhuis',receipt,{issuedAt:receipt.appliedAt});
        return [{id,sequence:row.nr,type:'leerhuis.change.applied',receipt,sourceAuditRef:{nr:row.nr,hash:row.hash}}];
      }
      return [];
    });
  }
  function resolveObservation(ref,recipient) {
    try {
      const r=P.objectRef(ref),org=String(recipient && recipient.id || ''),st=academy(org);
      if (recipient.domain!=='leerhuis' || r.domain!=='leerhuis' || r.type!=='practice-observation')
        P.fail('PURPOSE_DENIED','Deze observatie hoort niet bij deze ontvanger.',403);
      const proposal=st.voorstellen[r.id];
      if (!proposal || proposal.at!==r.version) P.fail('SOURCE_MISSING','Dit praktijkvoorstel bestaat niet meer bij de bron.',404);
      const row=leerhuis.spoor(org).find(x=>x.soort==='voorstel' && x.data.id===r.id && x.at===r.version);
      if (!row) P.fail('NOT_FOUND','De bronregel van dit praktijkvoorstel ontbreekt.',404);
      const out=observation(org,row),rejected=proposal.stand==='REJECTED';
      out.status=rejected ? 'rejected' : proposal.stand.toLowerCase();
      out.review=proposal.historie.length ? {history:P.clone(proposal.historie)} : null;
      out.contests=rejected ? [{status:'contested',reason:(proposal.historie.at(-1)||{}).notitie || 'Voorstel afgewezen.',
        assertedBy:'leerhuis-governance',at:(proposal.historie.at(-1)||{}).at || time()}] : [];
      return {ok:true,observation:out,corrected:false};
    } catch(e) { return P.error(e); }
  }
  function learningEligibility(ref,recipient,request={}) {
    const resolved=resolveObservation(ref,recipient);if(!resolved.ok)return resolved;
    return eligibility.evaluate(resolved.observation.eligibility,{sourceRef:ref,purpose:request.purpose,
      recipient,use:request.use||'recall'},time());
  }
  function artifact(actorRef,org,ref) {
    const allowed=authorization(actorRef,org,['kennis']); if (!allowed.ok) return allowed;
    try {
      const r=P.objectRef(ref),prefix=org+':';
      if (r.domain!=='leerhuis' || r.type!=='knowledge' || !r.id.startsWith(prefix))
        P.fail('NOT_FOUND','Deze Leerhuis-kennisversie is niet beschikbaar.',404);
      const id=r.id.slice(prefix.length),st=academy(org),item=st.kennis[id],version=item && item.versies[r.version];
      if (!version) P.fail('NOT_FOUND','Deze Leerhuis-kennisversie is niet beschikbaar.',404);
      const current=item.actief===r.version && version.stand==='ACTIVE';
      return {ok:true,artifact:P.clone(version),current,currentRef:current ? r :
        (item.actief ? {domain:'leerhuis',type:'knowledge',id:r.id,version:item.actief} : r)};
    } catch(e) { return P.error(e); }
  }
  async function deliver(org,consumer,handle,limit=100,options={}) {
    if (!/^[a-z][a-z0-9.-]{1,79}$/.test(consumer) || typeof handle!=='function') throw new Error('Invalid Leerhuis Loop consumer');
    if (limit && typeof limit==='object') { options=limit; limit=100; }
    const events=protocolEvents(org),maxSource=Math.max(0,...leerhuis.spoor(org).map(row=>Number(row.nr)||0));
    const raw=db.data.leerhuisLoopDelivery || {},delivery=state(raw),cursor=Number(delivery.organizations[org] &&
      delivery.organizations[org].consumers && D.checkpoint(delivery.organizations[org].consumers[consumer]).sequence || 0);
    if (!Number.isSafeInteger(cursor) || cursor<0 || cursor>maxSource) P.fail('CHECKPOINT_CORRUPT','Het Leerhuis-checkpoint valt buiten het bronspoor.',503);
    const workerId=options.workerId || 'leerhuis-'+P.hash([process.pid,consumer,time(),Math.random()]).slice(0,16);
    let current=cursor,blocked=null;
    for (const event of events.filter(x=>x.sequence>cursor).sort((a,b)=>a.sequence-b.sequence)
      .slice(0,Math.max(1,Math.min(Number(limit)||100,1000)))) {
      const claimed=await tx(map=>{
        const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
        if (!row.consumers) row.consumers={};
        const result=D.claim(row.consumers,consumer,event,{at:time(),workerId,leaseMs:options.leaseMs}); Object.assign(map,s); return result;
      });
      if (claimed.conflict) P.fail(claimed.code,'Dezelfde delivery-sequence heeft andere inhoud.',409);
      if (!claimed.claimed) { if (claimed.complete) { current=Math.max(current,event.sequence); continue; } blocked=claimed.lease; break; }
      try { await handle(P.clone(event)); }
      catch(error) {
        const failure=await tx(map=>{
          const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
          const result=D.failed(row.consumers,consumer,event,error,{at:time(),workerId,maxAttempts:options.maxAttempts}); Object.assign(map,s); return result;
        });
        if (failure.deadLettered) throw Object.assign(new Error('Delivery staat in de dead-letterwachtrij.'),
          {loopFabric:true,code:'DEAD_LETTERED',status:503,eventId:event.id});
        throw error;
      }
      await tx(map=>{
        const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
        if (!row.consumers) row.consumers={};
        D.complete(row.consumers,consumer,event,{at:time(),workerId}); Object.assign(map,s);
      });
      current=event.sequence;
    }
    return {deliveredThrough:current,sourceThrough:maxSource,blocked};
  }
  function deliveryStatus(org,consumer) {
    const delivery=state(db.data.leerhuisLoopDelivery || {}),row=delivery.organizations[org],events=protocolEvents(org);
    return D.summary(row && row.consumers && row.consumers[consumer],Math.max(0,...events.map(x=>x.sequence)),time(),events);
  }
  function deliveryStatuses() {
    const s=state(db.data.leerhuisLoopDelivery || {}),rows=[];
    for (const [org,row] of Object.entries(s.organizations)) for (const consumer of Object.keys(row.consumers || {}))
      rows.push({scopeHash:P.hash(org).slice(0,20),consumer,...deliveryStatus(org,consumer)});
    return rows;
  }
  async function replayDeadLetter(org,consumer,eventId) {
    return tx(map=>{
      const s=state(map),row=s.organizations[org] || (s.organizations[org]={consumers:{}});
      if (!row.consumers) row.consumers={};
      const result=D.replay(row.consumers,consumer,eventId,time()); Object.assign(map,s); return {ok:true,...result};
    });
  }
  function verifyReceipt(receipt) {
    return serviceReceipt.verify(serviceProof,receipt,{domain:'leerhuis',issuer:'rtg.service.leerhuis',label:'Leerhuis'});
  }
  return {authorization,artifact,resolveObservation,learningEligibility,protocolEvents,deliver,deliveryStatus,deliveryStatuses,
    replayDeadLetter,verifyReceipt};
};
