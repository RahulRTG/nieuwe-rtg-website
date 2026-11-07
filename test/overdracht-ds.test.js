'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bron=fs.readFileSync('public/shared/overdracht.js','utf8');
function omgeving({ds=true,loading=false}={}){
 class Node{constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.textContent='';}appendChild(n){this.children.push(n);n.parentNode=this;return n;}insertBefore(n){this.children.unshift(n);n.parentNode=this;}removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null;}setAttribute(k,v){this[k]=v;}addEventListener(k,f){this.listeners[k]=f;}}
 const head=new Node('head'),body=new Node('body'),documentElement=new Node('html');documentElement.hasAttribute=()=>ds;
 const doc={head,body,documentElement,readyState:loading?'loading':'complete',createElement:t=>new Node(t),createTextNode:t=>Object.assign(new Node('#text'),{textContent:t}),getElementById:id=>head.children.find(n=>n.id===id),addEventListener(k,f){this[k]=f;}};
 let token='actor-A',resolve;const calls=[],pending=new Promise(r=>resolve=r);
 const c={document:doc,location:{search:'?overdracht=briefje-1'},URLSearchParams,localStorage:{getItem:()=>token},fetch:(url,opts)=>{calls.push({url,opts});return pending;}};c.window=c;vm.runInNewContext(bron,c);
 return {doc,calls,token:t=>token=t,dsMarker:v=>ds=v,async klaar(status,body){resolve({ok:status>=200&&status<300,json:async()=>body});await new Promise(r=>setImmediate(r));},tekst(n=body){return String(n.textContent||'')+n.children.map(x=>this.tekst(x)).join('');}};
}
const overdracht={verkoper:{naam:'Eigen zaak'},regels:[{titel:'<img onerror=evil()>',aantal:2,totaalCenten:1234},{titel:'Gift',aantal:1,gratis:true}],brutoCenten:1234,btw:{btwCenten:214,tariefProcent:21},at:0,bedragVan:'Bronbedrag',rtgBevestigtNiet:'RTG bevestigt dit niet.'};
for(const ds of [true,false])test('bestaande overdracht, bedragen, escaping en sluiten op '+(ds?'DS':'legacy'),async()=>{
 const e=omgeving({ds});await e.klaar(200,{ok:true,overdracht});const balk=e.doc.body.children[0];assert.ok(balk);assert.equal(balk.className,'ovd ds-overdracht');
 assert.equal(e.doc.head.children.length,ds?0:1);if(!ds){const link=e.doc.head.children[0];assert.equal(link.tagName,'link');assert.equal(link.rel,'stylesheet');assert.equal(link.href,'/ds/rtg-ds.css');assert.equal(link.id,'rtgDsRuntimeCss');}
 assert.match(e.tekst(),/€ 12,34/);assert.match(e.tekst(),/€ 2,14/);assert.match(e.tekst(),/zonder bedrag/);assert.match(e.tekst(),/<img onerror=evil\(\)>/);assert.match(e.tekst(),/RTG bevestigt dit niet\./);
 const nodes=[];function bezoek(n){nodes.push(n);n.children.forEach(bezoek);}bezoek(balk);assert.equal(nodes.filter(n=>n.tagName==='img').length,0);assert.equal(nodes.find(n=>n.tagName==='a').href,'/apps/commerce.html');
 assert.equal(e.calls.length,1);assert.equal(e.calls[0].url,'/api/commerce/overdracht/lees');assert.equal(e.calls[0].opts.method,'POST');assert.equal(e.calls[0].opts.headers.Authorization,'Bearer actor-A');assert.equal(e.calls[0].opts.body,'{"id":"briefje-1"}');
 nodes.find(n=>n.tagName==='button').listeners.click();assert.equal(e.doc.body.children.length,0);
});
test('HTTP-fout, payloadfout en oude actor publiceren geen overdracht',async()=>{
 for(const [status,data]of [[503,{ok:true,overdracht}],[200,{ok:false,overdracht}],[200,{ok:'true',overdracht}],[200,{ok:true,error:'nee',overdracht}]]){const e=omgeving();await e.klaar(status,data);assert.equal(e.doc.body.children[0],undefined);assert.equal(e.doc.head.children.length,0);}
 const e=omgeving();e.token('actor-B');await e.klaar(200,{ok:true,overdracht});assert.equal(e.doc.body.children[0],undefined);
 const f=omgeving({loading:true});f.token('actor-B');f.doc.DOMContentLoaded();assert.equal(f.calls.length,0);
});
test('DS-marker na ophalen maar vóór antwoord behoudt de bestaande dynamische stijlgrens',async()=>{
 const e=omgeving({ds:false});e.dsMarker(true);await e.klaar(200,{ok:true,overdracht});
 assert.equal(e.doc.head.children.length,0);assert.equal(e.doc.body.children[0].className,'ovd ds-overdracht');
 assert.equal(e.calls.length,1);assert.equal(e.calls[0].opts.headers.Authorization,'Bearer actor-A');
});
test('legacy-owner verwijst niet meer naar een tweede presentatieblad',()=>{
 assert.doesNotMatch(bron,/overdracht-legacy\.css|rtg-ovd-stijl/);assert.match(bron,/rtgDsRuntimeCss/);
});
test('component gebruikt bestaande tokens, logische uitlijning en geen animatiedwang',()=>{
 const css=fs.readFileSync('public/ds/componenten/overdracht.css','utf8'),tokens=fs.readFileSync('public/ds/tokens.css','utf8');for(const m of css.matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(m[1]+':'),m[1]);assert.match(css,/min-block-size: var\(--ds-doel\)/);assert.match(css,/text-align: end/);assert.doesNotMatch(css,/!important|#[0-9a-f]{3,8}\b|animation:|transition:/i);
});
