/* De PostgreSQL-proef bewijst multi-instance serialisatie, payloadgebonden
   replay, herstel na verloren commitantwoord en duurzame Loop Fabric-projectie
   over een herstart. */
'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const makeWork=require('../server/bedrijf/loop-source');
const makeFabric=require('../server/kern/loop-fabric');

const at='2026-10-04T10:00:00.000Z';
const procedureRef={domain:'workos',type:'procedure',id:'procedure_v1',version:1};
const observationRef={domain:'living-world',type:'observation',id:'observation_1',version:2};
const placeRef={domain:'living-world',type:'place',id:'place_1',version:null};
const blueprintRef={domain:'living-world',type:'blueprint',id:'blueprint_1',version:null};

function workspace(code='WLOOP') {
  return {code,naam:'Loop Werkruimte',leden:{lead:{id:'lead',naam:'Olivia Organisator',status:'actief',
    rtgKey:'user-1',rollen:[{id:'directie',van:null,tot:null,at}]}},kennis:{procedure_v1:{id:'procedure_v1',
      titel:'Event toegankelijkheidscheck',tekst:'Controleer de hoofdingang.',soort:'procedure',eigenaar:'Olivia Organisator',
      versie:1,recht:'kennis',vorigeId:null,vervallen:false,geldigTot:'2027-10-04',laatstGecontroleerd:'2026-10-04',at,
      door:'Olivia Organisator'}},besluiten:{decision_1:{id:'decision_1',titel:'Pas de eventprocedure aan',status:'aangenomen',
      geslotenAt:at,loopContext:{observationRef,observationHash:'a'.repeat(64),procedureRef,placeRef,blueprintRef,
        expectation:'Een gecontroleerde route maakt zelfstandige toegang mogelijk.',successCriteria:['Route gecontroleerd.'],
        purpose:'event-accessibility-improvement',contextHash:'b'.repeat(64),validation:{policyId:'loop-decision-source-context',
          version:1,validatedAt:at,observationEventId:'observation_event_1',observationRef,procedureRef,
          purpose:'event-accessibility-improvement'}}}},journaal:[],gebeurtenissen:[],at};
}

function changeInput(operationId='pg_loop_change_operation_01',text='Controleer hoofdingang, helling en route vóór opening.',workspaceCode='WLOOP') {
  return {actorRef:'user-1',memberId:'lead',workspaceCode,operationId,decisionId:'decision_1',procedureRef,
    data:{title:'Event toegankelijkheidscheck',text,owner:'Olivia Organisator',validUntil:'2027-10-04'}};
}

test('Loop Fabric PostgreSQL: bronchange, receipt en projectie zijn race-, replay- en herstartbestendig',{
  timeout:30000
},async t=>{
  const url=process.env.RTG_LOOP_FABRIC_TEST_PG_URL || process.env.DATABASE_URL || process.env.PG_URL;
  assert.ok(url,'Vereist een geïsoleerde PostgreSQL-testserver via RTG_LOOP_FABRIC_TEST_PG_URL of npm run test:pg.');
  const isolated=await require('./lib/living-world-pg-database')(url); t.after(isolated.close);
  const {maakPg}=require('../server/pg'),{merge3}=require('../server/db/merge'),kluis=require('../server/kluis');
  const a=maakPg({url:isolated.url,merge3,kluis}),b=maakPg({url:isolated.url,merge3,kluis});
  const core=(pg,data,afterCommit=false)=>makeWork({leesCollectie:name=>data[name],now:()=>at,bewerkCollectie:async(name,fn)=>{
      const out=await pg.bewerkCollectie(name,data,fn); if(afterCommit) throw new Error('injected after commit'); return out;
    }});
  try {
    await a.schema(); const dataA=await a.laadAlles()||{},dataB=await b.laadAlles()||{};
    await a.bewerkCollectie('werkruimtes',dataA,map=>{map.WLOOP=workspace();map.WAFTER=workspace('WAFTER');});
    Object.assign(dataB,await b.laadAlles());
    const ca=core(a,dataA),cb=core(b,dataB),input=changeInput();
    const race=await Promise.all([ca.apply(input),cb.apply(input)]);
    assert.equal(race.filter(x=>x.ok).length,2); assert.equal(race.filter(x=>x.replay).length,1);
    const stored=(await a.laadAlles()).werkruimtes.WLOOP;
    assert.equal(Object.keys(stored.loopProtocol.receipts).length,1); assert.equal(Object.keys(stored.kennis).length,2);

    const changedReplay=await cb.apply(changeInput(input.operationId,'Andere payload voor dezelfde operatie.'));
    assert.equal(changedReplay.code,'REPLAY_CONFLICT');

    const dataAfter=await b.laadAlles(),afterInput=changeInput('pg_loop_after_commit_001',
      'Controleer hoofdingang, helling en route vóór opening.','WAFTER');
    const uncertain=await core(b,dataAfter,true).apply(afterInput);
    assert.equal(uncertain.code,'OUTCOME_UNKNOWN');
    const restartedAfter=core(a,await a.laadAlles());
    const recovered=await restartedAfter.apply(afterInput);
    assert.equal(recovered.ok,true); assert.equal(recovered.replay,true);

    const receipt=Object.values(stored.loopProtocol.receipts)[0];
    const observation={objectRef:observationRef,placeRef,planRef:null,blueprintRef,sourceActorRef:'user-2',kind:'observation',
      title:'Drempel',text:'De route was niet toegankelijk.',status:'accepted',observedAt:at,recordedAt:at,validUntil:null,
      basis:'participant_and_organizer',sharing:{visibility:'workspace',purpose:'event-accessibility-improvement',
        recipients:[{domain:'workos',id:'WLOOP'}],consent:{basis:'explicit',grantedAt:at}},review:{by:'user-1',at,reason:'Bekeken.'},
      contests:[],supersedes:null,supersededBy:null,verificationOf:null,assessment:null};
    const livingWorld={deliver:async()=>({deliveredThrough:0}),protocolEvents:()=>[],
      resolveObservation:()=>({ok:true,observation,corrected:false})};
    const faData=await a.laadAlles(),fbData=await b.laadAlles();
    const workA=makeWork({leesCollectie:name=>faData[name],now:()=>at,
      bewerkCollectie:(name,fn)=>a.bewerkCollectie(name,faData,fn)});
    const workB=makeWork({leesCollectie:name=>fbData[name],now:()=>at,
      bewerkCollectie:(name,fn)=>b.bewerkCollectie(name,fbData,fn)});
    const fa=makeFabric({db:{data:faData,writable:true},now:()=>at,livingWorld,workSource:workA,
      bewerkCollectie:(name,fn)=>a.bewerkCollectie(name,faData,fn)});
    const fb=makeFabric({db:{data:fbData,writable:true},now:()=>at,livingWorld,workSource:workB,
      bewerkCollectie:(name,fn)=>b.bewerkCollectie(name,fbData,fn)});
    const event={id:'work_receipt_event_1',type:'workos.change.applied',receipt};
    const projected=await Promise.all([fa.ingest(event),fb.ingest(event)]);
    assert.equal(projected.filter(x=>x.ok).length,2); assert.equal(projected.filter(x=>x.replay).length,1);
    const conflict=await fb.ingest({...event,type:'workos.change.tampered'});
    assert.equal(conflict.code,'SOURCE_EVENT_CONFLICT');
    const restartedData=await a.laadAlles();
    const restartedWork=makeWork({leesCollectie:name=>restartedData[name],now:()=>at,
      bewerkCollectie:(name,fn)=>a.bewerkCollectie(name,restartedData,fn)});
    const restarted=makeFabric({db:{data:restartedData,writable:true},now:()=>at,livingWorld,workSource:restartedWork,
      bewerkCollectie:(name,fn)=>a.bewerkCollectie(name,restartedData,fn)});
    const proof=restarted.proof('user-1','WLOOP');
    assert.equal(proof.ok,true); assert.equal(proof.changes.length,1); assert.equal(proof.integrity,true);
  } finally { await Promise.all([a.pool.end(),b.pool.end()]); }
});
