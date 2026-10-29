'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const maak=require('../server/lib/idem');
const sleutel='rekopen-kantoor:test';
for(const afdruk of [undefined,null,{},'']) test('beschermde ontvangst weigert ongeldige afdruk '+String(afdruk),async()=>{
 const data={bankIdem:{_keys:[sleutel],[sleutel]:{ok:true}},bankIdemAfdruk:{[sleutel]:afdruk}};
 const idem=maak({d:()=>data,save(){assert.fail('geen migratie');},naam:'bankIdem',behoudSleutel:()=>true});
 assert.equal((await idem(sleutel,'a',()=>assert.fail('geen nieuw werk'))).status,503);
});
for(const antwoord of [null,'succes',[],{}, {ok:false}]) test('beschermde ontvangst weigert ongeldig antwoord '+JSON.stringify(antwoord),async()=>{
 const data={bankIdem:{_keys:[sleutel],[sleutel]:antwoord},bankIdemAfdruk:{[sleutel]:'a'}};
 const idem=maak({d:()=>data,save(){assert.fail('geen migratie');},naam:'bankIdem',behoudSleutel:()=>true});
 assert.equal((await idem(sleutel,'a',()=>assert.fail('geen nieuw werk'))).status,503);
});
test('beschermde migratie wacht op echte bundelcommit; rollback sluit beide retries',async()=>{
 const data={bankIdem:{_keys:[sleutel],[sleutel]:{ok:true,id:1}},bankIdemAfdruk:{[sleutel]:'a'}};
 let vrij,gestart;const ingang=new Promise(r=>gestart=r);let falen=true,schijf=structuredClone(data);
 const pg=require('../server/db/postgres'),origineel=pg.flushVoorrangDirect;
 test.after(()=>{pg.flushVoorrangDirect=origineel;});
 pg.flushVoorrangDirect=async()=>{gestart();await new Promise(r=>vrij=r);if(falen)throw Error('opslaguitval');schijf=structuredClone(data);};
 const bundel=require('../server/db/bijeen')({save(){assert.fail('geen gewone commit');},saveDuurzaam:()=>({duurzaam:true,bevestigbaar:true})});
 const idem=maak({d:()=>data,save(){bundel.bundelDoos().nodig=true;},naam:'bankIdem',behoudSleutel:()=>true,bijeen:bundel.bijeen,duurzaam:true});
 let klaar=0;const run=()=>idem(sleutel,'a',()=>assert.fail('geen nieuw werk')).then(x=>{klaar++;return x;});
 const eerste=run();await ingang;const tweede=run();await new Promise(r=>setImmediate(r));assert.equal(klaar,0);
 vrij();assert.equal((await eerste).status,503);assert.equal((await tweede).status,503);
 assert.deepEqual(data.bankIdem._keys,[sleutel]);assert.deepEqual(schijf.bankIdem._keys,[sleutel]);
 falen=false;const derde=run();await new Promise(r=>setImmediate(r));assert.equal(klaar,2);vrij();assert.equal((await derde).ok,true);
 assert.deepEqual(schijf.bankIdem._keys,[]);
 const naHerstart=maak({d:()=>schijf,save(){assert.fail('al gemigreerd');},naam:'bankIdem',behoudSleutel:()=>true});
 assert.equal((await naHerstart(sleutel,'a',()=>assert.fail('geen uitvoering'))).id,1);
});
