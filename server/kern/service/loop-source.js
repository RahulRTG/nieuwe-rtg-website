'use strict';

/* Service geeft alleen gereviewde procesmetadata aan de Loop Fabric. De zaak,
   berichten, melder en medewerker blijven in kern/service. Deze adapter bewaart
   een onomkeerbare bronhash en een los procesartifact; hij is geen tweede
   ticketarchief. */
const P=require('../loop-fabric/protocol');
const eligibility=require('../loop-fabric/learning-eligibility');
const envelope=require('../envelop');
const makeDelivery=require('./loop-source-delivery');

module.exports=function makeServiceLoopSource({leesCollectie,bewerkCollectie,zaken,kwaliteit,authorize,authorizeRecipient,now}){
  const time=now||(()=>new Date().toISOString()),empty=()=>({schemaVersion:1,operations:{},observations:{},lifecycles:{},outbox:[],delivery:{}});
  if(typeof leesCollectie!=='function')P.fail('STORAGE_UNAVAILABLE','Service learning vereist de datalaag-leespoort.',503);
  const state=value=>Object.assign(empty(),value||{}),read=()=>state(leesCollectie('serviceLearning'));
  const tx=fn=>{
    if(typeof bewerkCollectie!=='function')P.fail('STORAGE_UNAVAILABLE','Service learning vereist duurzame collectietransacties.',503);
    return bewerkCollectie('serviceLearning',raw=>{const s=state(raw),out=fn(s);Object.assign(raw,s);return out;});
  };
  const processRef=id=>({domain:'service',type:'process',id,version:1});
  const addDays=(iso,days)=>new Date(Date.parse(iso)+days*86400000).toISOString();
  function authority(actorRef,workspaceCode){
    if(typeof authorize!=='function'||authorize(actorRef)!==true)P.fail('AUTHORITY_REVOKED','Een actuele Service-zetel is vereist.',403);
    const target=typeof authorizeRecipient==='function'&&authorizeRecipient(actorRef,workspaceCode);
    if(!target||!target.ok)P.fail(target&&target.code||'AUTHORITY_REVOKED',target&&target.error||'De ontvangende werkruimte is niet bevoegd.',target&&target.status||403);
    return {policyId:'service.office-seat+workos.recipient',workspaceCode:target.workspaceCode||workspaceCode};
  }
  function appendServiceEvent(s,event){const prior=s.outbox.at(-1);event.sequence=s.outbox.length+1;event.previousHash=prior&&prior.hash||null;
    event.hash=P.hash(event);s.outbox.push(event);return event;}
  function issued(observation){
    return eligibility.issue({sourceRef:observation.objectRef,purpose:observation.sharing.purpose,memoryClass:'ORGANIZATIONAL',
      audience:observation.sharing.recipients,basis:{type:'ORGANIZATIONAL_PROCESS_METADATA'},
      allowedFields:['title','text','observedAt','status','assessment'],uses:{decision:true,recall:true,'cross-domain':true,
        ai:false,aggregate:false,publish:false},issuedAt:observation.recordedAt,validUntil:observation.validUntil,
      retention:{mode:'EXPIRY',policyId:'service.process-observation.180d.v1'},epistemicType:'SYSTEM_OBSERVED',capabilityId:'service'});
  }
  function publicObservation(row){return P.clone(row.observation);}
  async function reviewCase(input){
    try{
      P.fields(input,['actorRef','operationId','caseId','workspaceCode','processId','purpose','verificationOf']);
      const actorRef=P.text(input.actorRef,160),operationId=P.operationId(input.operationId),processId=P.text(input.processId,80);
      if(processId!=='human-handoff')P.fail('NO_LEARNING_VALUE','Deze Service-slice kent alleen de gereviewde menselijke overdracht.',409);
      const at=time(),auth=authority(actorRef,P.text(input.workspaceCode,40)),found=zaken.vind(P.text(input.caseId,40));
      if(!found)P.fail('SOURCE_MISSING','Deze Service Case bestaat niet.',404);
      const caseRow=P.clone(found),repeated=kwaliteit.opnieuwUitleggen(caseRow);
      if(repeated===null)P.fail('NO_LEARNING_VALUE','Deze zaak bevat geen voltooide menselijke overdracht.',409);
      const verificationOf=input.verificationOf?P.objectRef(input.verificationOf):null;
      if(verificationOf&&(verificationOf.domain!=='workos'||verificationOf.type!=='change-receipt'))
        P.fail('INVALID_REF','Service-verificatie verwijst naar een WorkOS ChangeReceipt.');
      const fingerprint=P.hash(input),operationKey=P.hash([actorRef,operationId]);
      return await tx(s=>{
        const previous=s.operations[operationKey];if(previous){if(previous.fingerprint!==fingerprint)
          P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);return {...P.clone(previous.result),replay:true};}
        const id='svobs_'+operationKey.slice(0,25),objectRef={domain:'service',type:'process-observation',id,version:1},subject=processRef(processId);
        const outcome=repeated?'repeated-explanation-required':'handoff-without-repeat',observedAt=(caseRow.tijdlijn.at(-1)||{}).at||caseRow.at;
        const observation={objectRef,subjectRef:subject,scopeRefs:[subject],title:repeated?'Serviceoverdracht vroeg herhaling':'Serviceoverdracht zonder herhaling',
          text:repeated?'De procesoverdracht liet de melder opnieuw beginnen.':'De procesoverdracht liet RTG als eerste opvolgen.',
          observedAt:P.instant(observedAt,'occurred_at'),recordedAt:at,sourceActorRef:null,status:'accepted',
          sharing:{visibility:'workspace',purpose:P.text(input.purpose,120),recipients:[{domain:'workos',id:auth.workspaceCode}],consent:false,
            returnUpdates:false},basis:'reviewed-minimal-process-metadata',review:{authorityRef:{policyId:auth.policyId},at},contests:[],
          verificationOf,assessment:verificationOf?(repeated?'not-improved':'improved'):null,validUntil:addDays(at,180)};
        observation.eligibility=issued(observation);
        s.observations[id]={observation:P.clone(observation),source:{caseHash:P.hash(['service-case',caseRow.id]),
          caseVersionHash:P.hash({stand:caseRow.stand,team:caseRow.team,mensVerzoeken:caseRow.mensVerzoeken,
            structure:caseRow.tijdlijn.map(x=>({wat:x.wat,van:x.van||null,naar:x.naar||null,at:x.at}))}),outcome}};
        const eventId='sve_'+operationKey.slice(0,28);appendServiceEvent(s,{id:eventId,type:verificationOf?'service.verification.observed':'service.process.observed',
          protocol:P.clone(observation),envelop:envelope.maak({id:eventId,at,kanaal:'service',actor:'service-seat',correlatie:operationId,
            oorzaak:null,classificatie:'intern'})});
        const result={ok:true,observation:P.clone(observation),replay:false};s.operations[operationKey]={fingerprint,result:P.clone(result)};return result;
      });
    }catch(e){return P.error(e);}
  }
  async function withdraw(input){
    try{
      P.fields(input,['actorRef','operationId','observationRef','workspaceCode','reason']);
      const actorRef=P.text(input.actorRef,160),operationId=P.operationId(input.operationId),ref=P.objectRef(input.observationRef),at=time();
      authority(actorRef,P.text(input.workspaceCode,40));const fingerprint=P.hash(input),key=P.hash([actorRef,operationId]);
      return await tx(s=>{const old=s.operations[key];if(old){if(old.fingerprint!==fingerprint)P.fail('REPLAY_CONFLICT','Deze operatie-ID hoort bij andere invoer.',409);
          return {...P.clone(old.result),replay:true};}
        const row=s.observations[ref.id];if(!row||P.refKey(row.observation.objectRef)!==P.refKey(ref))P.fail('SOURCE_MISSING','Deze Service-observatie bestaat niet.',404);
        delete s.observations[ref.id];const observation={...publicObservation(row),status:'withdrawn',sourceActorRef:null,title:'Niet meer beschikbaar',text:'',
          recordedAt:at,review:null,contests:[],verificationOf:null,assessment:null};delete observation.eligibility;
        s.lifecycles[ref.id]=P.clone(observation);const eventId='svw_'+key.slice(0,28);appendServiceEvent(s,{id:eventId,type:'service.observation.withdrawn',
          protocol:P.clone(observation),envelop:envelope.maak({id:eventId,at,kanaal:'service',actor:'service-seat',correlatie:operationId,
            oorzaak:null,classificatie:'intern'})});
        const result={ok:true,status:'withdrawn',refHash:P.hash(P.refKey(ref)),replay:false};s.operations[key]={fingerprint,result:P.clone(result)};return result;});
    }catch(e){return P.error(e);}
  }
  function resolveServiceObservation(ref,recipient){
    try{const r=P.objectRef(ref),s=read(),lifecycle=s.lifecycles[r.id];if(lifecycle)P.fail('SOURCE_WITHDRAWN','Deze Service-observatie is ingetrokken.',410);
      const row=s.observations[r.id];if(r.domain!=='service'||r.type!=='process-observation'||!row||P.refKey(row.observation.objectRef)!==P.refKey(r))
        P.fail('SOURCE_MISSING','Deze Service-observatie bestaat niet.',404);
      const o=publicObservation(row);if(o.validUntil<=time())P.fail('SOURCE_EXPIRED','Deze Service-observatie is verlopen.',410);
      if(!recipient||(o.sharing.recipients||[]).every(x=>x.domain!==recipient.domain||x.id!==recipient.id))
        P.fail('SOURCE_DENIED','Deze procesobservatie is niet met deze ontvanger gedeeld.',403);
      return {ok:true,observation:o,corrected:false};}catch(e){return P.error(e);}
  }
  function evaluateServiceEligibility(ref,recipient,request={}){const resolved=resolveServiceObservation(ref,recipient);if(!resolved.ok)return resolved;
    return eligibility.evaluate(issued(resolved.observation),{sourceRef:ref,purpose:request.purpose,recipient,use:request.use||'recall'},time());}
  function serviceProtocolEvents(){const s=read();return [...Object.values(s.observations).map(row=>({id:'snapshot-service-'+P.hash(P.refKey(row.observation.objectRef)).slice(0,24),
    type:'service.process.observed',protocol:publicObservation(row)})),...Object.values(s.lifecycles).map(o=>({id:'snapshot-service-life-'+P.hash(P.refKey(o.objectRef)).slice(0,24),
      type:'service.observation.'+o.status,protocol:P.clone(o)}))];}
  const {deliver,deliveryStatus,deliveryStatuses}=makeDelivery({read,tx,time});
  return {consumerDomain:'workos',reviewCase,withdraw,resolveObservation:resolveServiceObservation,
    learningEligibility:evaluateServiceEligibility,protocolEvents:serviceProtocolEvents,deliver,
    deliveryStatus,deliveryStatuses,_read:read};
};
