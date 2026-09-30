'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {maakReisuitnodiging}=require('../server/kern/reisuitnodiging');
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
function fixture(){const db={data:{}};const kern=maakReisuitnodiging({db,save(){},crypto,invoer:{neemOver(){throw new Error('Gastlink mag geen import uitvoeren');}},idGeverifieerd:()=>true}).reisuitnodiging;return {db,kern};}
function plan(){return {titel:'Van Amsterdam naar 東京',bestemming:'Nederland → 日本',personen:2,onderdelen:[{soort:'vlucht',titel:'Intercontinentale vlucht',datum:day(10),tijd:'23:00',zone:'Europe/Amsterdam',eindDatum:day(11),eindTijd:'18:00',eindZone:'Asia/Tokyo',status:'voorstel',vertrek:'Schiphol',aankomst:'Tokyo',instructies:'日本語 · العربية · privéservice'}],paspoort:'NEVER',email:'klant@example.test'};}
const code=r=>new URL(r.link,'http://localhost').hash.split('=')[1];
test('concept is privé, publicatie is volledig maar uitsluitend lezen, en de bron bewaart geen kale code',()=>{
 const {kern,db}=fixture();let r=kern.bewaarProgramma('adviseur',{programma:plan(),idem:'draft'});assert.equal(r.ok,true);assert.equal(r.link,undefined);const id=r.uitnodiging.id;
 assert.equal(kern.lijst('kantoor').uitnodigingen[0].programma.titel,'Van Amsterdam naar 東京');assert.equal(kern.lijst('ander').uitnodigingen.length,0);
 r=kern.bewaarProgramma('adviseur',{id,versie:1,programma:plan(),idem:'publish',publiceer:true,geldigTot:day(20)});assert.ok(r.link);
 const c=code(r),open=kern.open(c);assert.equal(open.uitnodiging.programma.onderdelen[0].eindZone,'Asia/Tokyo');assert.equal(open.uitnodiging.programma.paspoort,undefined);
 assert.equal(JSON.stringify(db).includes(c),false);assert.equal(JSON.stringify(db).includes('klant@example.test'),false);
 assert.deepEqual(kern.open(c),open,'herhaald lezen consumeert geen link');
});
test('stale collega kan niet overschrijven; oude herhaalsleutel maakt ook na wijzigingen geen duplicaat',()=>{
 const {kern}=fixture(),p=plan();const b={programma:p,idem:'create'};const r=kern.bewaarProgramma('A',b),id=r.uitnodiging.id;
 assert.equal(kern.bewaarProgramma('B',{id,versie:1,programma:{...p,titel:'Bijgewerkt'},idem:'edit'}).ok,true);
 assert.equal(kern.bewaarProgramma('A',{id,versie:1,programma:p,idem:'stale'}).status,409);
 assert.equal(kern.bewaarProgramma('A',b).status,409);assert.equal(kern.lijst('kantoor').uitnodigingen.length,1);
});
test('nieuwe link vervangt oude, intrekking en verval sluiten alle reisdetails af',()=>{
 const {kern,db}=fixture();const b={programma:plan(),idem:'a',publiceer:true,geldigTot:day(20)};let r=kern.bewaarProgramma('A',b),old=code(r),id=r.uitnodiging.id;
 r=kern.bewaarProgramma('A',{...b,id,versie:1,idem:'b'});assert.equal(kern.open(old).status,404);const current=code(r);assert.ok(kern.open(current).ok);
 assert.equal(kern.trekIn('ander',id,'ander').status,404);kern.trekIn('kantoor',id,'A');assert.equal(kern.open(current).status,409);
 r=kern.bewaarProgramma('A',{...b,id,versie:2,idem:'c'});const row=db.data.reisUitnodigingen[id];row.toegang.expires_at='2000-01-01T00:00:00Z';assert.equal(kern.open(code(r)).reden,'verlopen');
});
test('datums, tijdzones, bevestigingsbron en publicatie-eisen worden door server bewaakt',()=>{
 const {kern}=fixture();const save=p=>kern.bewaarProgramma('A',{programma:p,idem:crypto.randomUUID(),publiceer:true,geldigTot:day(20)});
 for(const change of [{datum:'2026-02-30'},{datum:''},{tijd:'25:00'},{zone:'Nergens/Stad'},{status:'bevestigd',bevestiging:''}]){const p=plan();Object.assign(p.onderdelen[0],change);assert.equal(save(p).status,400);}
 const p=plan();p.onderdelen[0].status='bevestigd';p.onderdelen[0].bevestiging='E-mail aanbieder';assert.ok(save(p).ok);
 assert.equal(kern.bewaarProgramma('A',{programma:plan(),idem:'date',publiceer:true,geldigTot:'2026-99-40'}).status,400);
 assert.equal(save({...p,onderdelen:Array(81).fill(p.onderdelen[0])}).status,400);
});
test('gastprogramma verleent geen claimrecht en verandert bestaande beperkte uitnodigingen niet',async()=>{
 const {kern}=fixture();const r=kern.bewaarProgramma('A',{programma:plan(),idem:'guest',publiceer:true,geldigTot:day(20)});
 assert.equal((await kern.eisOp({key:'member'},code(r))).status,403);
 const old=kern.zetKlaar('A',[{titel:'Privéhotel',soort:'verblijf',van:day(10),kenmerk:'SECRET'}],'legacy');
 const open=kern.open(code(old));assert.equal(open.uitnodiging.programma,undefined);assert.ok(!JSON.stringify(open).includes('SECRET'));assert.ok(!JSON.stringify(open).includes('Privéhotel'));
});
