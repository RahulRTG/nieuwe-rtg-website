/* Werkelijke HTTP-keten, zonder betaal-, AI- of pushprovider. De agenda leest
   de reserveringsbron; bevestigd blijft een besluit van de juiste zaak. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const h=require('./helper');let srv,member,other,supplier,date;
async function api(route,body={},token=member){const r=await fetch(srv.base+route,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
async function register(suffix){const r=await api('/api/auth/register',{name:'Diner '+suffix,email:'dinner-'+suffix+'-'+Date.now()+'@example.test',phone:'0612345678',password:'geheim12345',geboortedatum:'1980-01-01',tier:'rtg',pasApp:'rtg'},null);assert.equal(r.status,200);return r.body.token;}
async function request(time,people=3,token=member){return api('/api/reserveer',{supplierCode:'KIKUNOI',datum:date,tijd:time,personen:people},token);}
test.before(async()=>{
 srv=await h.startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1'}});date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 member=await register('one');other=await register('two');
 const roster=await api('/api/supplier/roster',{code:'KIKUNOI'},null),manager=roster.body.staff.find(s=>s.role==='manager');
 supplier=(await api('/api/supplier/login',{code:'KIKUNOI',staffId:manager.id,pin:'1234'},null)).body.token;assert.ok(supplier);
});
test.after(async()=>{if(srv)await h.stop(srv.child);});
test('ontdekken, aanvragen, juiste zaak bevestigt, agenda projecteert actuele status en annulering',async()=>{
 const discovery=await api('/api/foodcourt');assert.ok(discovery.body.restaurants.some(r=>r.code==='KIKUNOI'));
 const r=await request('19:00');assert.equal(r.status,200,JSON.stringify(r.body));const id=r.body.reservering.id;assert.equal(r.body.reservering.status,'aangevraagd');
 const agenda=()=>api('/api/agenda/bereik',{van:date,tot:date});
 let view=(await agenda()).body.ecosysteem.find(x=>x.id==='reservering:'+id);assert.equal(view.status,'aangevraagd');
 assert.equal((await api('/api/supplier/reservering/beslis',{id,action:'bevestig'},member)).status,401);
 const decision=await api('/api/supplier/reservering/beslis',{id,action:'bevestig'},supplier);assert.equal(decision.status,200);
 view=(await agenda()).body.ecosysteem.filter(x=>x.id==='reservering:'+id);assert.equal(view.length,1);assert.equal(view[0].status,'bevestigd');
 const theirs=await api('/api/agenda/bereik',{van:date,tot:date},other);assert.ok(!theirs.body.ecosysteem.some(x=>x.id==='reservering:'+id));
 assert.equal((await api('/api/reservering/annuleer',{id},other)).status,404);
 assert.equal((await api('/api/reservering/annuleer',{id})).status,200);
 assert.ok(!(await agenda()).body.ecosysteem.some(x=>x.id==='reservering:'+id));
});
test('dubbel versturen en antwoordverlies leveren maximaal een actieve aanvraag',async()=>{
 const responses=await Promise.all([request('19:30'),request('19:30')]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const list=await api('/api/reserveringen/mijn');assert.equal(list.body.reserveringen.filter(r=>r.datum===date&&r.tijd==='19:30').length,1);
});
test('gewijzigde beschikbaarheid wordt bij uitvoering opnieuw beoordeeld',async()=>{
 const close=await api('/api/supplier/zaak/functie',{id:'reserveren',aan:false},supplier);assert.equal(close.status,200);
 try{assert.equal((await request('20:00')).status,409);}finally{await api('/api/supplier/zaak/functie',{id:'reserveren',aan:true},supplier);}
});
test('verlopen of ontbrekende sessie kan geen aanvraag plaatsen',async()=>{
 assert.equal((await request('20:30',3,'expired-session')).status,401);
 assert.equal((await request('20:30',3,null)).status,401);
});
test('de laatste vrije plaatsen worden opnieuw geteld; een vol slot kan niet worden overboekt',()=>{
 const restaurant={code:'SMALL',name:'Klein',tables:[{seats:3}],settings:{}};
 const db={data:{reserveringen:[]}};let id=0;
 const noop=()=>{};
 const core=require('../server/kern/ervaring/tafels')({db,save:noop,findSupplier:()=>restaurant,notify:noop,notifySupplier:noop,sseToCustomer:noop,sseToSupplier:noop,sseToOffice:noop,
  id:()=>String(++id),nu:()=>new Date().toISOString(),vandaag:()=>new Date().toISOString().slice(0,10)});
 const input={supplierCode:'SMALL',datum:date,tijd:'21:00',personen:2};
 assert.equal(core.reserveerTafel({key:'one'},'Een',input).ok,true);
 assert.equal(core.reserveerTafel({key:'two'},'Twee',input).status,409);
 assert.equal(db.data.reserveringen.length,1);
});
