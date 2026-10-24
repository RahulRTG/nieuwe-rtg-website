'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const kantoor=require('../server/kern/assets/kantoor');
const tijdzone=require('../server/kern/tijdzone');

for(const ververs of [false,true])test('gelijktijdige fee-rondes boeken eenmaal, vervangen werkkopie: '+ververs,{timeout:10000},async()=>{
 const ticket={id:'ticket-test',assetId:'object-test',codenaam:'LID-TEST',status:'actief',feeJaar:tijdzone.jaarIn()-1};
 const db={data:{assetTickets:[ticket],assetKas:{}}};
 let vrij,bereikt;const beide=new Promise(r=>{bereikt=r;}),betaling=new Promise(r=>{vrij=r;});
 const verzoeken=[];const a={id:'object-test',naam:'Testobject'};
 const module=kantoor({db,save(){},vastleggen:async f=>{f();return null;},schoon:x=>x,lijsten(){},objectVan:()=>a,
  serviceFeeVan:()=>7,pay:{huisIn:async req=>{verzoeken.push(req);if(verzoeken.length===2)bereikt();await betaling;return {ok:true};}},
  kasAdd:(id,n)=>{db.data.assetKas[id]=(db.data.assetKas[id]||0)+n;}});
 const eerste=module.assetFeesInnen('test'),tweede=module.assetFeesInnen('test');
 await beide;if(ververs)db.data.assetTickets=[{...ticket}];vrij();const antwoorden=await Promise.all([eerste,tweede]);
 assert.equal(verzoeken[0].idem,verzoeken[1].idem,'betaling heeft dezelfde ticketjaarsleutel');
 assert.equal(db.data.assetKas[a.id],700,'de betaal-idempotentie mag geen dubbele poolboeking maskeren');
 assert.equal(db.data.assetTickets[0].feeJaar,tijdzone.jaarIn());
 assert.equal(antwoorden.reduce((n,r)=>n+r.geind,0),1);
});

test('geweigerde betaling en mislukte vastlegging blijven herstelbaar zonder succesclaim',async()=>{
 const jaar=tijdzone.jaarIn(),ticket={id:'ticket-herstel',assetId:'object-test',codenaam:'LID-TEST',status:'actief',feeJaar:jaar-1};
 const db={data:{assetTickets:[ticket],assetKas:{}}};
 let betaalbaar=false,opslagbaar=false;const sleutels=[];
 const module=kantoor({db,save(){},lijsten(){},schoon:x=>x,objectVan:()=>({id:'object-test',naam:'Testobject'}),
  serviceFeeVan:()=>7,pay:{huisIn:async req=>{sleutels.push(req.idem);return betaalbaar?{ok:true}:{error:'betaling geweigerd'};}},
  kasAdd:(id,n)=>{db.data.assetKas[id]=(db.data.assetKas[id]||0)+n;},
  vastleggen:async f=>{const voor=structuredClone(db.data);f();if(opslagbaar)return null;db.data=voor;return {status:503,error:'opslag geweigerd'};}});
 let r=await module.assetFeesInnen('test');
 assert.equal(r.geind,0);assert.equal(r.mislukt,1);assert.equal(db.data.assetTickets[0].feeJaar,jaar-1);
 assert.deepEqual(db.data.assetKas,{});
 betaalbaar=true;r=await module.assetFeesInnen('test');
 assert.equal(r.geind,0);assert.equal(r.totaal,0);assert.equal(r.mislukt,1);
 assert.match(r.reden,/niet vastgelegd/);assert.deepEqual(db.data.assetKas,{});
 assert.equal(db.data.assetTickets[0].feeJaar,jaar-1);
 opslagbaar=true;r=await module.assetFeesInnen('test');
 assert.equal(r.geind,1);assert.equal(r.totaal,7);assert.equal(r.mislukt,0);
 assert.equal(db.data.assetKas['object-test'],700);assert.equal(db.data.assetTickets[0].feeJaar,jaar);
 assert.equal(new Set(sleutels).size,1,'herstel gebruikt dezelfde betaalidentiteit');
 r=await module.assetFeesInnen('test');assert.equal(r.geind,0);assert.equal(sleutels.length,3);
});

test('assetinitialisatie schrijft eenmaal; volledig lezen blijft zonder save', () => {
 const db={data:{}};let saves=0;
 const assets=require('../server/kern/assets')({db,save(){saves++;},crypto:require('node:crypto'),schoon:x=>String(x||''),notify(){},pay:null});
 const eerste=assets.assetsOverzicht('fixture-lid');
 assert.equal(eerste.ok,true);assert.equal(saves,1);
 const volledig=structuredClone(db.data);
 assert.deepEqual(assets.assetsOverzicht('fixture-lid'),eerste);
 assert.deepEqual(db.data,volledig);assert.equal(saves,1,'volledige collecties zijn geen mutatie');
 delete db.data.sharedAssets[0].entiteit;
 const ouder=assets.assetsOverzicht('fixture-lid');
 assert.equal(saves,2,'ontbrekende entiteit wordt eenmaal duurzaam gemarkeerd');
 assert.ok(ouder.assets[0].entiteit);
 assert.deepEqual(assets.assetsOverzicht('fixture-lid'),ouder);
 assert.equal(saves,2,'herhaald lezen na upgrade schrijft niets');
});
