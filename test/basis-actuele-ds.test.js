'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const lees=n=>fs.readFileSync('public/shared/basis/'+n+'.js','utf8');
function env(ds=false){const loaded=[],children=[];let actueel=ds,focus=0;const doel={id:'inhoud',hasAttribute:()=>true,focus(){focus++;}};
 const document={documentElement:{hasAttribute:()=>actueel},body:{getAttribute:()=> 'work',insertBefore:n=>children.push(n)},head:{appendChild:n=>loaded.push(n)},getElementById:()=>null,querySelector:s=>s.startsWith('#main')?doel:null,querySelectorAll:()=>[],createElement:tag=>({tag,attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.events[k]=f;}})};
 const c={document,ds,window:{},location:{href:'http://rtg.test/apps/wonen.html'}};vm.createContext(c);return {c,loaded,children,set:v=>actueel=v,focus:()=>focus};}
test('late identiteit load/error behoudt toepassing maar injecteert geen legacy na DS-activatie',()=>{
 const b=lees('basis-01'),code=b.slice(b.indexOf('  function voegBasisStijlToe'),b.indexOf('  /* ---- taal:'));
 for(const event of ['load','error'])for(const ds of [false,true]){
  const e=env(false);let toegepast=0;vm.runInContext(code,e.c);const script=e.loaded[0];assert.equal(script.src,'/shared/rtg-world-identity.js');
  e.c.window.RTGWorldIdentity={apply(){toegepast++;}};e.set(ds);script.events[event]();
  assert.equal(toegepast,event==='load'?1:0);assert.equal(e.loaded.filter(n=>n.tag==='link').length,ds?1:3);
 }
});
test('late skiplink krijgt actuele DS-class en behoudt echte focusactie',()=>{
 const b=lees('basis-02'),code=b.slice(b.indexOf('  function springNaarInhoud'),b.indexOf('  function start()'))+'\nspringNaarInhoud();';
 for(const ds of [false,true]){const e=env(false);e.set(ds);vm.runInContext(code,e.c);assert.equal(e.loaded.length,0);assert.equal(e.children.length,1);assert.equal(e.children[0].className,ds?'rtg-spring ds-basis__spring':'rtg-spring');assert.equal(e.children[0].attrs.href,'#inhoud');e.children[0].events.click();assert.equal(e.focus(),1);}
});
test('private centrale loaders lezen actuele DS en behouden legacy-laadpaden',()=>{
 for(const part of ['basis-01ad-intelligence','basis-01ac-edge'])for(const ds of [false,true]){const e=env(false);e.set(ds);vm.runInContext(lees(part),e.c);assert.equal(e.loaded.length>0,!ds,part);}
});
test('bestaande identiteitnode wordt hergebruikt; nieuw script houdt volgorde en callbacks',()=>{
 const b=lees('basis-01'),code=b.slice(b.indexOf('  function voegBasisStijlToe'),b.indexOf('  /* ---- taal:'));
 for(const bestaand of [false,true])for(const event of ['load','error']){
  const e=env(true),node=e.c.document.createElement('script');node.parentNode={};node.src='/shared/rtg-world-identity.js';
  if(bestaand)e.c.document.getElementById=id=>id==='rtgWorldIdentityJs'?node:null;
  let toegepast=0;vm.runInContext(code,e.c);const actief=bestaand?node:e.loaded[0];
  assert.equal(e.loaded.length,bestaand?0:1);assert.equal(actief.src,'/shared/rtg-world-identity.js');if(!bestaand)assert.equal(actief.async,false);
  e.c.window.RTGWorldIdentity={apply(){toegepast++;}};actief.events[event]();assert.equal(toegepast,event==='load'?1:0);assert.equal(e.loaded.filter(n=>n.tag==='link').length,0);
 }
 const e=env(true);let toegepast=0;e.c.window.RTGWorldIdentity={apply(){toegepast++;}};vm.runInContext(code,e.c);assert.equal(e.loaded.length,0);assert.equal(toegepast,1);
});
test('wereldidentiteit behoudt exacte bundelroute als bewezen native DOMload',()=>{
 const s=require('../scripts/ontwerpsysteem'),b=require('../scripts/bundel').bundel('shared/basis.js').toString();
 const a=s.scriptLaadAnalyse(b,{ds:true});assert.ok(a.verwijzingen.some(v=>v.href==='/shared/rtg-world-identity.js'&&v.soort==='dom'));assert.ok(!a.onzeker.some(v=>v.includes('/shared/rtg-world-identity.js')));
});
