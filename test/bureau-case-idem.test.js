'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
function maak(){
 const db={data:{lifestyle:{}},writable:true};let saves=0,beoordeeld=0,n=0;
 const schoon=(x,max)=>String(x??'').replace(/[<>]/g,'').trim().slice(0,max);
 const bewerkCollectie=require('../server/db/collectie-bewerken')({store:'memory',db,save:()=>saves++});
 const open=require('../server/kern/bureau/cases-bedoeling')({db,bewerkCollectie,schoon,
  maakCases: levens=>require('../server/kern/bureau/cases')({levens,save:()=>{},nu:()=> '2026-10-21T12:00:00Z',rid:()=>String(++n),schoon,
   beoordeel:()=>{beoordeeld++;return{niveau:2,magZelf:false,reden:'akkoord'};},deelopdrachten:()=>[]})});
 return{db,open,get beoordeeld(){return beoordeeld;},get saves(){return saves;}};
}
test('opdracht is verplicht; gelijk replay, andere inhoud conflict en nieuwe bedoeling nieuw',async()=>{
 const f=maak(),b={titel:'Transfer',idem:crypto.randomUUID()};
 assert.equal((await f.open('a',{titel:'Transfer'})).status,400);assert.deepEqual(f.db.data.lifestyle,{});
 const a=await f.open('a',b);assert.equal(a.status,200);
 const r=await f.open('a',{...b,titel:' Transfer '});assert.equal(r.herhaald,true);assert.deepEqual(r.zaak,a.zaak);
 assert.equal((await f.open('a',{...b,bedragCenten:1})).status,409);assert.equal(f.beoordeeld,1);
 const nieuw=await f.open('a',{...b,idem:crypto.randomUUID()});assert.notEqual(nieuw.zaak.id,a.zaak.id);
 assert.equal(f.db.data.lifestyle.a.cases.length,2);
});
test('andere dossieractor heeft eigen sleutelruimte; receipt blijft bij archivering',async()=>{
 const f=maak(),b={titel:'Privé',idem:'zelfde'};const a=await f.open('a',b),ander=await f.open('b',b);
 assert.notEqual(a.zaak.id,ander.zaak.id);assert.equal(f.db.data.lifestyle.b.cases.length,1);
 f.db.data.lifestyle.a.cases=[];assert.equal((await f.open('a',b)).status,410);
 assert.equal(f.db.data.lifestyle.a.cases.length,0);assert.equal(f.beoordeeld,2);
 assert.equal((await f.open('a',{...b,titel:'gewijzigd'})).status,409);
});
test('transactiefout publiceert noch zaak noch ontvangst',async()=>{
 const db={data:{lifestyle:{}},writable:true};
 const transactie=require('../server/db/collectie-bewerken')({store:'memory',db,save:()=>{throw Error('disk');}});
 const open=require('../server/kern/bureau/cases-bedoeling')({db,bewerkCollectie:transactie,schoon:(x,n)=>String(x??'').trim().slice(0,n),
 maakCases:levens=>({caseOpen:(k)=>{levens.zetVeld(k,'cases',[{id:'x'}]);return{ok:true,zaak:{id:'x'}};}})});
 await assert.rejects(open('a',{titre:'x',titel:'x',idem:'k'}),/disk/);assert.deepEqual(db.data.lifestyle,{});
});
test('API-poort weigert pas zonder recht vóór cache; actor komt uitsluitend uit sessie',async()=>{
 const routes=new Map();let aanroepen=[];
 const auth=()=>{};require('../server/routes/member/bureau')({app:{post:(p,...h)=>routes.set(p,h)},auth,
 bureau:{caseOpenBedoeling:async(k,b)=>{aanroepen.push([k,b]);return{ok:true};}}});
 const handlers=routes.get('/api/member/bureau/zaak/open');assert.equal(handlers[0],auth);
 const res={status(n){this.code=n;return this;},json(x){this.body=x;return this;}};
 await handlers[1]({session:{key:'guest',tier:'guest'},body:{idem:'x'}},res);
 assert.equal(res.code,403);assert.equal(aanroepen.length,0);
 await handlers[1]({session:{key:'a',tier:'business'},body:{idem:'x',key:'b'}},res);
 assert.equal(aanroepen[0][0],'a');
});
test('client behoudt UUID bij onzeker antwoord en gebruikt nieuwe na bevestiging',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const s=fs.readFileSync(require('node:path').join(__dirname,'../public/apps/lifestyle.html'),'utf8');
 const begin=s.indexOf("  $('#zK').onclick = async () =>",s.indexOf('async function vZaken'));
 const einde=s.indexOf("  const nieuw=document.createElement",begin);
 const opslag=new Map(),knop={},velden={'#zK':knop,'#zT':{value:'Transfer'},'#zW':{value:''},'#zS':{value:'regulier'},'#zD':{value:'vervoer'},'#zB':{value:'0'}};
 let n=0;const bodies=[],context={zaakBedoeling:'',crypto:{randomUUID:()=> 'uuid-'+(++n)},sessionStorage:{getItem:k=>opslag.get(k)||null,setItem:(k,v)=>opslag.set(k,v),removeItem:k=>opslag.delete(k)},$:k=>velden[k],meld:()=>{},vZaken:()=>{},api:async(p,b)=>{bodies.push(b);if(bodies.length===1)throw Error('timeout');return{zaak:{beslissing:{nodig:true}}};}};
 vm.runInNewContext(s.slice(begin,einde),context);
 await knop.onclick();assert.equal(opslag.get('rtg_bureau_zaak_bedoeling'),'uuid-1');
 await knop.onclick();assert.equal(bodies[0].idem,bodies[1].idem);assert.equal(opslag.size,0);
 await knop.onclick();assert.equal(bodies[2].idem,'uuid-2');
});
