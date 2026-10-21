'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {maakJournaal}=require('../server/kern/command/journaal');
const {mergeApiSpoor,commandHeel}=require('../server/pg/verzoeksporen');
const {commandHash}=require('../server/pg/spoorketen');
const kopie=structuredClone;
function werk(bron={}){const v=kopie(bron);return{v,j:maakJournaal({db:{data:{}},save(){},crypto,vak:()=>v})};}
function zegelOpnieuw(v,vorig=null){for(const r of v.commandJournaal){delete r.zegel;r.vorig=vorig;r.zegel=commandHash(r);vorig=r.zegel;}}
function klaar(n=3){const w=werk();for(let i=0;i<n;i++)w.j.noteer({actor:i<2?'user-1':'user-2',actie:'basis-'+i});const b=kopie(w.v);w.j.wisActor('user-1');w.j.noteer({actor:'gewist',actie:'POST /api/privacy/delete',niveau:'api',uitslag:'200'});return{b,v:w.v};}
test('privacywissing en gewone API-eindregel vormen samen geldig bewijs',()=>{
 const {b,v}=klaar();assert.deepEqual(mergeApiSpoor(b,v,b),v);assert.equal(commandHeel(v.commandJournaal),true);
 assert.equal(v.commandJournaal.some(r=>r.actor==='user-1'),false);
 assert.equal(v.commandJournaal.at(-1).actie,'POST /api/privacy/delete');
 assert.equal(v.commandJournaalTotaal,b.commandJournaalTotaal+2);
});
test('vol venster: wissing en eindregel verantwoorden beide afgekaptte regels',()=>{
 const {b,v}=klaar(5000);assert.equal(v.commandJournaal.length,5000);
 assert.deepEqual(mergeApiSpoor(b,v,b),v);assert.equal(commandHeel(v.commandJournaal),true);
 const vals=kopie(v);vals.commandJournaal.at(-1).id=b.commandJournaal[0].id;
 zegelOpnieuw(vals,vals.commandJournaal[0].vorig);
 assert.throws(()=>mergeApiSpoor(b,vals,b),e=>e.code==='PG_REQUEST_CONFLICT','afgekapt basis-ID blijft bestaand bewijs');
});
test('wissing mag een gelijktijdige toevoeging niet vervangen',()=>{
 const {b,v}=klaar();const ander=werk(b);ander.j.noteer({actor:'user-2',actie:'gelijktijdig'});
 assert.throws(()=>mergeApiSpoor(b,v,ander.v),e=>e.code==='PG_REQUEST_CONFLICT');
});
test('geldige herzegeling rechtvaardigt geen gewijzigde inhoud, teller of wisomvang',()=>{
 const {b,v}=klaar();
 for(const vervals of [
  x=>{x.commandJournaal[0].actie='vervalst';},
  x=>{x.commandJournaal[2].actor='gewist';},
  x=>{x.commandJournaal.find(r=>r.actie==='wissing in het spoor').na.regelsGewist++;},
  x=>{x.commandJournaalTotaal++;},
  x=>{x.commandJournaal.at(-1).id=x.commandJournaal[0].id;}
  ,x=>{x.commandJournaal[0].id=[x.commandJournaal[0].id];}
  ,x=>{x.commandJournaal[1].actor='user-1';x.commandJournaal.find(r=>r.actie==='wissing in het spoor').na.regelsGewist=1;}
 ]){const vals=kopie(v);vervals(vals);zegelOpnieuw(vals);assert.throws(()=>mergeApiSpoor(b,vals,b),e=>e.code==='PG_REQUEST_CONFLICT');}
 const vals=kopie(v);zegelOpnieuw(vals,'vreemd-ketenanker');
 assert.throws(()=>mergeApiSpoor(b,vals,b),e=>e.code==='PG_REQUEST_CONFLICT');
});
