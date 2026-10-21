'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
function maak(){const db={data:{},writable:true};const bewerkCollectie=require('../server/db/collectie-bewerken')({store:'memory',db,save:()=>{}});return{db,w:require('../server/kern/werkplek')({db,save:()=>{},bewerkCollectie,crypto}).werkplek};}
test('taak: verplichte bedoeling, conflict, replay en bewust nieuwe opdracht',async()=>{
 const {db,w}=maak(),b={tekst:'Controle',afdeling:'finance',idem:'1'};
 assert.equal((await w.taakMaakBedoeling('rtg','a',{tekst:'a'})).status,400);assert.deepEqual(db.data,{});
 const a=await w.taakMaakBedoeling('rtg','a',b),r=await w.taakMaakBedoeling('rtg','a',{...b,tekst:' Controle '});
 assert.equal(r.taak.id,a.taak.id);assert.equal(r.herhaald,true);
 assert.equal((await w.taakMaakBedoeling('rtg','a',{...b,tekst:'anders'})).status,409);
 assert.equal((await w.taakMaakBedoeling('rtg','a',{...b,afdeling:'operations'})).status,409);
 const nieuw=await w.taakMaakBedoeling('rtg','a',{...b,idem:'2'});assert.notEqual(nieuw.taak.id,a.taak.id);
 assert.equal(db.data.werkplekTaken.rtg.length,2);
});
test('actor isoleert sleutels; ander bedrijf vereist een nieuwe bedoeling; archivering behoudt ontvangst',async()=>{
 const {db,w}=maak(),b={tekst:'Controle',idem:'1'};
 const a=await w.taakMaakBedoeling('rtg','a',b),ander=await w.taakMaakBedoeling('rtg','b',b),huis=await w.taakMaakBedoeling('rtf','a',b);
 assert.notEqual(a.taak.id,ander.taak.id);assert.equal(huis.status,409);
 const nieuwHuis=await w.taakMaakBedoeling('rtf','a',{...b,idem:'2'});assert.notEqual(a.taak.id,nieuwHuis.taak.id);
 for(let n=0;n<101;n++)w.taakMaak('rtg','Intern '+n);
 assert.equal(db.data.werkplekTaken.rtg.length,100);
 assert.equal((await w.taakMaakBedoeling('rtg','a',b)).status,410);assert.equal(db.data.werkplekTaken.rtg.length,100);
 assert.equal(db.data.werkplekTaken.rtf.length,1);
});
test('huisAuth controleert ingetrokken toegang vóór replay, actor nooit uit body',async()=>{
 const {w}=maak(),routes=new Map();let actor='a',calls=[];
 w.toegangGeef('rtg','a','A');w.taakMaakBedoeling=async(...args)=>{calls.push(args);return{ok:true};};
 require('../server/routes/werkplek')({app:{post:(p,...h)=>routes.set(p,h)},boardroomWie:()=>actor,boardroomBaas:()=>false,werkplek:w});
 const h=routes.get('/api/werkplek/taak'),req={body:{bedrijf:'rtg',actor:'b',idem:'x'},headers:{}};
 const res={status(n){this.code=n;return this;},json(x){this.body=x;return this;}};
 let next=false;h[0](req,res,()=>{next=true;});assert.equal(next,true);await h[1](req,res);assert.equal(calls[0][1],'a');
 w.toegangWeg('rtg','a');next=false;h[0](req,res,()=>{next=true;});assert.equal(next,false);assert.equal(res.code,403);assert.equal(calls.length,1);
 actor='b';h[0]({...req,body:{...req.body,bedrijf:'rtf'}},res,()=>assert.fail('ander huis'));assert.equal(res.code,403);
});
test('campus bewaart bedoeling bij timeout/herladen; pas bevestiging maakt volgende nieuw',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const s=fs.readFileSync(require('node:path').join(__dirname,'../public/apps/werkplek-campus.js'),'utf8');
 const taakbron=fs.readFileSync(require('node:path').join(__dirname,'../public/apps/werkplek-taken.js'),'utf8');
 const verandering=s.slice(s.indexOf('  function verander('),s.indexOf('  function bindNav('));
 const opslag=new Map(),bodies=[];let n=0;
 const sessionStorage={getItem:k=>opslag.get(k),setItem:(k,v)=>opslag.set(k,v),removeItem:k=>opslag.delete(k)};
 function laad(){let submit;const ctx={MODEL:{code:'rtg'},k:{id:'finance'},sessionStorage,crypto:{randomUUID:()=> 'intent-'+(++n)},alert:()=>{},shell:()=>{},
 document:{querySelector:sel=>sel==='#campusTaakForm'?{addEventListener:(ev,fn)=>{submit=fn;}}:sel==='#campusTaakNieuw'?{addEventListener(){}}:{value:'Controle'}},
 ACT:{api:async(p,b)=>{bodies.push(b);if(bodies.length===1)throw Error('timeout');return{taken:[]};}}};
 ctx.window=ctx;vm.runInNewContext(taakbron+verandering+'\nRTGWerkplekTaken.bind(MODEL,k,verander);',ctx);return submit;}
 laad()({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(opslag.size,1);
 laad()({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(bodies[1].idem,bodies[0].idem);assert.equal(opslag.size,0);
 laad()({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.notEqual(bodies[2].idem,bodies[0].idem);
});
test('mislukte transactie laat geen taak of ontvangst achter',async()=>{
 const db={data:{},writable:true};const bewerkCollectie=require('../server/db/collectie-bewerken')({store:'memory',db,save:()=>{throw Error('opslag');}});
 const w=require('../server/kern/werkplek')({db,save:()=>{},bewerkCollectie,crypto}).werkplek;
 await assert.rejects(w.taakMaakBedoeling('rtg','a',{tekst:'X',idem:'k'}),/opslag/);
 assert.equal(db.data.werkplekTaken,undefined);
});
