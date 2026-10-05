'use strict';

const assert=require('node:assert/strict');
const makeWorld=require('../../server/kern/living-world');
const makeWork=require('../../server/bedrijf/loop-source');
const makeFabric=require('../../server/kern/loop-fabric');
const {maakLeerhuis}=require('../../server/kern/leerhuis');
const makeAcademySource=require('../../server/kern/leerhuis/loop-source');

const clone=value=>JSON.parse(JSON.stringify(value));

function fixture(previous,settings={}) {
  const db={data:clone(previous || {})};
  let now='2026-10-04T10:00:00.000Z', serial=0, chain=Promise.resolve(), fault=null;
  function bewerkCollectie(name,fn) {
    const run=async()=>{
      const before=clone(db.data[name] || {}), draft=clone(before);
      if (fault && fault.name===name && fault.when==='before') throw new Error('before commit');
      const result=await fn(draft); db.data[name]=draft;
      if (fault && fault.name===name && fault.when==='after') throw new Error('after commit');
      return result;
    };
    const result=chain.then(run,run); chain=result.catch(()=>{}); return result;
  }
  const sources={name:key=>'Member '+key,context:()=>({items:[],unavailable:[]}),media:()=>null};
  const world=makeWorld({db,bewerkCollectie,save:()=>{},sources,now:()=>now});
  const workSource=makeWork({db,bewerkCollectie,serviceProof:settings.serviceProof,now:()=>now});
  const academy=maakLeerhuis({db,save:()=>{},nu:()=>Date.parse(now)});
  const academySource=makeAcademySource({db,bewerkCollectie,leerhuis:academy,serviceProof:settings.serviceProof,now:()=>now});
  const fabric=makeFabric({db,bewerkCollectie,livingWorld:world,workSource,academySource,now:()=>now});
  const workspace={code:'WLOOP',naam:'Loop Werkruimte',leden:{
    lead:{id:'lead',naam:'Olivia Organisator',status:'actief',rtgKey:'user-1',rollen:[{id:'directie',van:null,tot:null,at:now}]}
  },kennis:{procedure_v1:{id:'procedure_v1',titel:'Event toegankelijkheidscheck',tekst:'Controleer de hoofdingang.',
    soort:'procedure',eigenaar:'Olivia Organisator',versie:1,recht:'kennis',vorigeId:null,vervallen:false,
    geldigTot:'2027-10-04',laatstGeControleerd:'2026-10-04',at:now,door:'Olivia Organisator'},
    runbook_v1:{id:'runbook_v1',titel:'Uitrol-runbook',tekst:'Controleer de primaire route.',
      soort:'runbook',eigenaar:'Olivia Organisator',versie:1,recht:'kennis',vorigeId:null,vervallen:false,
      geldigTot:'2027-10-04',laatstGecontroleerd:'2026-10-04',at:now,door:'Olivia Organisator'}},
    storingen:{incident_1:{id:'incident_1',wat:'Bij de uitrol is de terugvalroute bijna overgeslagen.',ernst:'near-miss',
      begonnenAt:now,opgelostAt:null,tickets:[],evaluatie:null,at:now,door:'Olivia Organisator'}},
    besluiten:{},journaal:[],gebeurtenissen:[],at:now};
  db.data.werkruimtes={WLOOP:workspace};
  async function command(actor,action,data,operationId) {
    const out=await world.execute(actor,action,data,operationId || 'loop_world_operation_'+String(++serial).padStart(5,'0'));
    assert.equal(out.ok,true,action+': '+JSON.stringify(out)); return out.result;
  }
  function row(actor,type,id) {
    return world.view(actor)[{place:'places',blueprint:'blueprints',plan:'plans',contribution:'contributions'}[type]].find(x=>x.id===id);
  }
  async function setupEvent() {
    let place=await command('user-1','place.create',{title:'Communityhuis IJmuiden',area:'IJmuiden',description:'Lokale ontmoetingsplek.'});
    await command('user-1','place.publish',{id:place.id,revision:place.revision});
    let blueprint=await command('user-1','blueprint.create',{placeId:place.id,title:'Communityavond',summary:'Een lokale avond voor leden.',
      activity:'community-event',route:'Hoofdingang en zaal',season:'doorlopend',equipment:'',transport:'',crew:'vrijwilligers',requirements:[],
      steps:[{kind:'organize',text:'Controleer de eventprocedure'}],mediaRef:'',remixAllowed:true});
    await command('user-1','blueprint.publish',{id:blueprint.id,revision:blueprint.revision});
    return {placeId:place.id,blueprintId:blueprint.id};
  }
  async function eventRun(blueprintId,participant) {
    let blueprint=row(participant,'blueprint',blueprintId);
    let plan=await command(participant,'plan.create',{id:blueprint.id,revision:blueprint.revision,consentImpact:false,knowledgeIds:[]});
    const eventAt=new Date(Date.parse(now)+3600000).toISOString();
    plan=await command(participant,'plan.update',{id:plan.id,revision:plan.revision,title:'Communityavond uitvoering',date:eventAt,
      notes:'',preparation:['Eventprocedure controleren'],knowledgeIds:[]});
    plan=await command(participant,'plan.request',{id:plan.id,revision:plan.revision});
    plan=row('user-1','plan',plan.id);
    plan=await command('user-1','plan.decide',{id:plan.id,revision:plan.revision,decision:'accepted',requirementsChecked:true,reason:'Deelname bevestigd.'});
    now=eventAt; plan=await command('user-1','plan.start',{id:plan.id,revision:plan.revision});
    now=new Date(Date.parse(now)+7200000).toISOString();
    plan=await command('user-1','plan.complete',{id:plan.id,revision:plan.revision,statement:'Community-event uitgevoerd.'});
    plan=row(participant,'plan',plan.id);
    await command(participant,'plan.acknowledge',{id:plan.id,revision:plan.revision,consentImpact:false});
    return plan.id;
  }
  function decisionRoutes() {
    const currentWorkspace=db.data.werkruimtes.WLOOP;
    const routes={}, app={post:(path,handler)=>{routes[path]=handler;}}, member=currentWorkspace.leden.lead;
    let rid=0;
    const sctx={app,save:()=>{},schoon:(v,n)=>String(v == null ? '' : v).trim().slice(0,n),nu:()=>now,
      rid:()=>('decision_'+(++rid)),dag:()=>now.slice(0,10),
      werkPoort:()=>({w:currentWorkspace,l:member,directie:false,rechten:['kennis','besluit']}),
      log:(w,l,wat,waarover,reden)=>w.journaal.push({wat,waarover,reden,wie:l.naam,at:now}),
      eigenVeld:(map,key)=>Object.prototype.hasOwnProperty.call(map,key) ? map[key] : null,loopFabric:fabric,
      regelMagSluiten:()=>({ontbreekt:[]})};
    require('../../server/bedrijf/besluit')(sctx);
    async function post(path,body) {
      let status=200,payload;
      const res={status(code){status=code;return this;},json(value){payload=value;return this;}};
      await routes[path]({body},res); return {status,body:payload};
    }
    return {post};
  }
  async function propose(loopContext) {
    return decisionRoutes().post('/api/bedrijf/besluit/maak',{titel:'Pas de eventprocedure aan',
      onderbouwing:'De gedeelde observatie vraagt om een concrete controle.',soort:'overig',
      eigenaar:'Olivia Organisator',loopContext});
  }
  async function decide(loopContext) {
    const api=decisionRoutes();
    let out=await api.post('/api/bedrijf/besluit/maak',{titel:'Pas de eventprocedure aan',onderbouwing:'De gedeelde observatie vraagt om een concrete controle.',
      soort:'overig',eigenaar:'Olivia Organisator',loopContext});
    assert.equal(out.status,200,JSON.stringify(out.body)); const id=out.body.besluit.id;
    assert.equal((await api.post('/api/bedrijf/besluit/stemronde',{besluitId:id})).status,200);
    assert.equal((await api.post('/api/bedrijf/besluit/stem',{besluitId:id,stem:'voor',toelichting:'Uitvoeren en nameten.'})).status,200);
    out=await api.post('/api/bedrijf/besluit/sluit',{besluitId:id,evalueerOp:'2026-11-01'});
    assert.equal(out.status,200,JSON.stringify(out.body)); return db.data.werkruimtes.WLOOP.besluiten[id];
  }
  const api={db,world,workSource,academy,academySource,fabric,command,row,setupEvent,eventRun,decide,
    propose,
    time:()=>now,clock:value=>{now=value;},fault:(name,when)=>{fault=name?{name,when}:null;},
    procedureRef:()=>({domain:'workos',type:'procedure',id:'procedure_v1',version:1}),
    runbookRef:()=>({domain:'workos',type:'runbook',id:'runbook_v1',version:1})};
  Object.defineProperty(api,'workspace',{get:()=>db.data.werkruimtes.WLOOP});
  return api;
}

module.exports={fixture};
