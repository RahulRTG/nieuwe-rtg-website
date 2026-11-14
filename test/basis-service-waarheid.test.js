'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bron=fs.readFileSync('public/shared/basis/basis-02b.js','utf8');
function omgeving(){let token='A',antwoord={ok:true,json:async()=>({ok:true})},calls=[];const sheet={},blok={isConnected:true,_sheet:sheet,_token:'A',remove(){this.isConnected=false;}};
 const c={sheet,localStorage:{getItem:()=>token},fetch:(...a)=>{calls.push(a);return Promise.resolve(antwoord);}};vm.createContext(c);vm.runInContext(bron.slice(bron.indexOf('    function tok()'),bron.indexOf('    function el(')),c);
 return {c,blok,calls,token:t=>token=t,antwoord:a=>antwoord=a};}
test('werkelijke service-helper weigert HTTP-, payload- en onleesbare fouten',async()=>{
 for(const r of [{ok:true,json:async()=>({})},{ok:true,json:async()=>({ok:'true'})},{ok:false,json:async()=>({ok:true})},{ok:true,json:async()=>({error:'nee'})},{ok:true,json:async()=>({ok:false})},{ok:true,json:async()=>null},{ok:true,json:async()=>{throw Error('json');}}]){const e=omgeving();e.antwoord(r);await assert.rejects(e.c.svc('/api/service/bevestig',{id:'x'},e.blok));}
 const e=omgeving();assert.equal((await e.c.svc('/api/service/bevestig',{id:'x'},e.blok)).ok,true);assert.equal(e.calls[0][1].headers.Authorization,'Bearer A');assert.equal(e.calls[0][1].body,'{"id":"x"}');
});
test('oude actor of gesloten gids kan niet verzenden; late servicegegevens worden verworpen',async()=>{
 for(const wijzig of [e=>e.token('B'),e=>e.c.sheet={},e=>e.blok.isConnected=false]){
  const e=omgeving();wijzig(e);await assert.rejects(e.c.svc('/api/service/weiger',{},e.blok));assert.equal(e.calls.length,0);
  const f=omgeving();let vrij;f.antwoord({ok:true,json:()=>new Promise(r=>vrij=r)});const p=f.c.svc('/api/service/bevestiging/toon',{},f.blok);await Promise.resolve();wijzig(f);vrij({code:'GEHEIM'});await assert.rejects(p);assert.equal(f.blok.isConnected,false);
 }
});
test('misleidend succes en onbehandelde afwijzingen krijgen bestaande UI-foutpad',()=>{
 for(const route of ['bevestig','weiger','bevestiging/toon','mens','open'])assert.match(bron,new RegExp("svc\\('/api/service/"+route+"'[\\s\\S]*?\\.catch\\(function \\(\\) \\{ hulpFout"));
 const e=omgeving(),doel={textContent:'wacht'};e.c.hulpFout(e.blok,doel);assert.equal(doel.textContent,'Niet gelukt. Probeer opnieuw.');e.token('B');doel.textContent='wacht';e.c.hulpFout(e.blok,doel);assert.equal(doel.textContent,'wacht');assert.equal(e.blok.isConnected,false);
});
