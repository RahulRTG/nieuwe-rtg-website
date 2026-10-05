/* De Loop Fabric-routeproef bewijst dat de HTTP-deuren de actor uit de sessie
   en het persoonlijke WorkOS-lid afleiden, en ontbrekende bevoegdheid vóór de
   bronmutatie afwijzen. */
'use strict';

const test=require('node:test'),assert=require('node:assert/strict');

function response() {
  return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}

test('Loop Fabric-routes staan achter de liddeur en leiden de actor uit de sessie af',async()=>{
  const routes={},auth=()=>{},calls=[];
  const app={post(path,...handlers){routes[path]=handlers;}};
  const loopFabric={sync:async code=>{calls.push(['sync',code]);return {ok:true};},
    syncSource:async(domain,id)=>{calls.push(['syncSource',domain,id]);return {ok:true};},
    present:async(actor,input)=>{calls.push(['present',actor,input]);return {ok:true,actor};},
    disposition:async(actor,input)=>{calls.push(['disposition',actor,input]);return {ok:true};},
    consumerForRecall:()=>({domain:'workos',id:'WLOOP'}),
    inbox:()=>({ok:true,items:[]}),inboxFor:()=>({ok:true,items:[]}),proof:()=>({ok:true})};
  require('../server/routes/loop-fabric')({app,auth,loopFabric});
  for (const handlers of Object.values(routes)) assert.equal(handlers[0],auth,'iedere Loop Fabric-route gebruikt de liddeur');
  const req={session:{key:'server-user'},body:{operationId:'route_operation_0001',actorRef:'spoofed-user',
    context:{workspaceCode:'wloop',placeRef:{},action:'event.prepare',purpose:'event-accessibility-improvement'}}};
  const res=response(); await routes['/api/loop/recall/present'][1](req,res);
  assert.equal(res.statusCode,200); assert.deepEqual(calls[0],['sync','WLOOP']);
  assert.equal(calls[1][0],'present'); assert.equal(calls[1][1],'server-user');
  const academyReq={session:{key:'user-4'},body:{operationId:'route_operation_academy_1',context:{
    consumer:{domain:'leerhuis',id:'ACADEMY'},scopeRefs:[{domain:'leerhuis',type:'knowledge',id:'ACADEMY:k',version:2}],
    action:'knowledge.review',purpose:'academy-practice-improvement'}}};
  await routes['/api/loop/recall/present'][1](academyReq,response());
  assert.deepEqual(calls[2],['syncSource','leerhuis','ACADEMY']);
  assert.equal(calls[3][1],'lid:4','Leerhuis-actor wordt server-side uit de RTG-sessie afgeleid');
});

test('WorkOS-change gebruikt persoonlijk lid en actuele dubbele bevoegdheid als bronactor',async()=>{
  const routes={},calls=[],app={post(path,handler){routes[path]=handler;}};
  const access={w:{code:'WLOOP'},l:{id:'lead',rtgKey:'server-user'},rechten:['kennis','besluit']};
  const workLoopSource={apply:async input=>{calls.push(['change',input]);return {ok:true};},
    observeIncident:async input=>{calls.push(['observe',input]);return {ok:true};}};
  require('../server/bedrijf/loop-change')({app,werkPoort:()=>access,workLoopSource});
  const req={body:{actorRef:'spoofed-user',operationId:'route_change_operation_01',decisionId:'decision_1',
    procedureRef:{domain:'workos',type:'procedure',id:'p1',version:1},data:{title:'t',text:'x'}}},res=response();
  await routes['/api/bedrijf/loop/procedure/change'](req,res);
  assert.equal(res.statusCode,200); assert.equal(calls[0][1].actorRef,'server-user'); assert.equal(calls[0][1].memberId,'lead');
  access.rechten=['kennis']; const denied=response();
  await routes['/api/bedrijf/loop/procedure/change'](req,denied);
  assert.equal(denied.statusCode,403); assert.equal(calls.length,1,'zonder besluitrecht bereikt de mutatie de bron niet');
  access.rechten=['service'];
  await routes['/api/bedrijf/loop/incident/observe']({body:{actorRef:'spoof',operationId:'route_observe_operation_01',
    incidentId:'s1',title:'Near miss',text:'Waargenomen.',occurredAt:'2026-10-04T10:00:00.000Z',purpose:'service-improvement'}},res);
  assert.equal(calls[1][0],'observe'); assert.equal(calls[1][1].actorRef,'server-user');
});

test('alle Loop Fabric-transportdeuren verklaren een woordelijke retry als hetzelfde verzoek',()=>{
  const {SLEUTELS}=require('../server/lib/idemsleutels');
  for(const route of [
    'POST /api/loop/observation/inbox',
    'POST /api/loop/recall/present',
    'POST /api/loop/recall/disposition',
    'POST /api/loop/proof',
    'POST /api/bedrijf/loop/procedure/change',
    'POST /api/bedrijf/loop/runbook/change',
    'POST /api/bedrijf/loop/incident/observe'
  ]) assert.deepEqual(SLEUTELS[route],{zelfdeVerzoek:true},route);
});
