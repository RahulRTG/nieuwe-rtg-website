'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const h=require('./helper');
let srv,tokenA,tokenB,tokenC;
async function request(path,body,token){
  const r=await fetch(srv.base+path,{method:'POST',headers:{'Content-Type':'application/json',
    ...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{})});
  return{status:r.status,body:await r.json()};
}
async function post(path,body,token){const r=await request(path,body,token);assert.equal(r.status,200,path+': '+JSON.stringify(r.body));return r.body;}
async function view(token){return post('/api/living-world/view',{},token);}
async function action(token,name,data,extra={}){
  const boot=await post('/api/experience/bootstrap',{world:'travel'},token);
  const p=await post('/api/experience/intent/preview',{intent:'living-world.'+name,world:'travel',
    contextId:boot.currentContext.id,parameters:data},token);
  const body={previewId:p.preview.id,idempotencyKey:'world-'+crypto.randomUUID(),confirmed:true,...extra};
  const result=await post('/api/experience/intent/execute',body,token);
  return{result,body,preview:p.preview};
}
test.before(async()=>{
  srv=await h.startServer({env:{SMTP_URL:'',RTG_BETALEN_UIT:'1',RTG_AI_UIT:'1',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:''}});
  const tokens=[];
  for(const name of ['A','B','C']){
    const r=await post('/api/auth/register',{name:'World '+name,email:'world-'+name+'@example.test',
      phone:'0612345678',password:'VeiligWachtwoord123!',geboortedatum:'1990-01-01',tier:'rtg'});
    assert.ok(r.token);tokens.push(r.token);
  }
  [tokenA,tokenB,tokenC]=tokens;
});
test.after(async()=>{if(srv)await h.stop(srv.child);});
test('HTTP: gesloten menselijke lus met betalingen, AI en push uit',async()=>{
  assert.equal((await request('/api/living-world/view',{})).status,401);
  const created=await action(tokenA,'place.create',{title:'IJmuiden',area:'Noord-Holland',description:'De haven'});
  const place=created.result.id;
  assert.equal((await view(tokenB)).places.length,0);
  await action(tokenA,'place.publish',{id:place,revision:created.result.revision});
  const blueprint=(await action(tokenA,'blueprint.create',{placeId:place,title:'Samen de kust ontdekken',
    summary:'Een gratis, gezamenlijk voorbereide kustwandeling.',activity:'Wandelen',requirements:[],
    steps:[{kind:'crew',text:'Spreek samen af'}],remixAllowed:true})).result;
  await action(tokenA,'blueprint.publish',{id:blueprint.id,revision:blueprint.revision});
  const plan=(await action(tokenB,'plan.create',{id:blueprint.id,revision:2,consentImpact:true})).result;
  const repeated=await post('/api/experience/intent/execute',created.body,tokenA);
  assert.equal(repeated.id,place,'antwoordverlies mag geen tweede plek maken');
  assert.equal((await view(tokenA)).places.length,1);
  const hidden=await request('/api/living-world/view',{plan:plan.id},tokenC);assert.equal(hidden.status,404);
  let p=(await action(tokenB,'plan.update',{id:plan.id,revision:plan.revision,title:'Onze kustwandeling',
    date:new Date(Date.now()+1500).toISOString(),notes:'Neem water mee',preparation:[]})).result;
  p=(await action(tokenB,'plan.request',{id:p.id,revision:p.revision})).result;
  const inbox=(await view(tokenA)).plans.find(x=>x.id===p.id);
  assert.equal(inbox.status,'requested');assert.equal(inbox.notes,'Neem water mee');
  const wrong=await request('/api/experience/intent/preview',{intent:'living-world.plan.decide',world:'travel',
    parameters:{id:p.id,revision:p.revision,decision:'accepted',reason:'Ik doe alsof'}},tokenC);
  assert.equal(wrong.status,403);
  p=(await action(tokenA,'plan.decide',{id:p.id,revision:p.revision,decision:'accepted',reason:'Ik begeleid deze wandeling.'})).result;
  await new Promise(resolve=>setTimeout(resolve,1600));
  p=(await action(tokenA,'plan.start',{id:p.id,revision:p.revision})).result;
  p=(await action(tokenA,'plan.complete',{id:p.id,revision:p.revision,statement:'De wandeling samen afgerond.'})).result;
  assert.equal((await view(tokenB)).plans[0].acknowledgedAt,null);
  p=(await action(tokenB,'plan.acknowledge',{id:p.id,revision:p.revision,consentImpact:true})).result;
  const contribution=(await action(tokenB,'contribution.create',{placeId:place,planId:p.id,kind:'knowledge',
    title:'Ontmoetingsplek',text:'Spreek af bij de ingang van de haven.',observedAt:new Date().toISOString()})).result;
  assert.equal((await view(tokenC)).contributions.length,0);
  let c=(await action(tokenA,'contribution.review',{id:contribution.id,revision:contribution.revision,
    decision:'accepted',reason:'Zelf gecontroleerd.'})).result;
  c=(await action(tokenA,'contribution.adopt',{id:c.id,revision:c.revision,blueprintRevision:2})).result;
  const next=(await view(tokenC)).blueprints[0];assert.equal(next.version,2);assert.equal(next.improvements[0].id,c.id);
  await action(tokenC,'plan.create',{id:next.id,revision:next.revision,knowledgeIds:[c.id],consentImpact:true});
  const impact=(await view(tokenB)).contributions[0].impact;assert.equal(impact.usedInPlans,1);assert.equal(impact.confirmedParticipants,0);
  const evidence=await post('/api/experience/evidence',{limit:100},tokenB);
  assert.equal(evidence.integrity.valid,true);
  assert.ok(evidence.evidence.some(e=>e.intent.id==='living-world.contribution.create'));
});
test('HTTP: stale preview, gewijzigde rechten en onbekende actor krijgen geen uitvoering',async()=>{
  const world=await view(tokenA),b=world.blueprints[0];
  const preview=await post('/api/experience/intent/preview',{world:'travel',intent:'living-world.plan.create',
    parameters:{id:b.id,revision:b.revision}},tokenC);
  await action(tokenA,'blueprint.withdraw',{id:b.id,revision:b.revision,reason:'Uitvoering tijdelijk gestopt'});
  const out=await request('/api/experience/intent/execute',{previewId:preview.preview.id,
    idempotencyKey:'stale-'+crypto.randomUUID(),confirmed:true},tokenC);
  assert.equal(out.status,403);
  assert.equal((await view(tokenC)).blueprints.length,0);
  const stolen=await request('/api/experience/intent/execute',{previewId:preview.preview.id,
    idempotencyKey:'stolen-'+crypto.randomUUID(),confirmed:true},tokenB);
  assert.equal(stolen.status,404);
});
module.exports={request,post,action};
