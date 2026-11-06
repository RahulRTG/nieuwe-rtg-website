'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
/* Dit gedrag loopt over de fysieke 10 kB-naad tussen 01b en 01ba. De browser
   ontvangt hun rauwe som als basis.js; de proef moet daarom dezelfde logische
   bron uitvoeren en geen half JavaScript-fragment. */
const bron=['basis-01b.js','basis-01ba.js'].map(naam=>
 fs.readFileSync(path.join(__dirname,'../public/shared/basis',naam),'utf8')).join('');
function basis(ds){
 const events={},nodes=[],timers=[];
 const target={appendChild(n){nodes.push(n);n.parentNode=this;},removeChild(n){nodes.splice(nodes.indexOf(n),1);}};
 const document={documentElement:{hasAttribute:()=>ds,classList:{add(){}}},body:target,head:{appendChild(){}},querySelector:()=>null,
  createElement(tag){return{tag,setAttribute(k,v){this[k]=v;}};}};
 const window={addEventListener:(k,f)=>events[k]=f};
 vm.runInNewContext(bron,{window,document,ds,rtf:false,navigator:{},location:{search:''},setTimeout:fn=>timers.push(fn)});
 return{window,events,nodes,timers,setDs:v=>ds=v};
}
test('Basis geeft DS-netwerkstatus aan bestaande Verbinding, ook wanneer die later geladen is',()=>{
 const f=basis(true);f.events.offline();assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].className,'ds-melding toon');
 f.timers.shift()();assert.equal(f.nodes.length,0);
 f.window.RTGNet={status(){throw Error('Basis mag de status niet nogmaals uitvoeren');}};
 f.events.offline();f.events.online();assert.equal(f.nodes.length,0);
});
test('Basis fallback blijft bestaan en volgt actuele DS-context zonder legacy-dubbele vorm',()=>{
 const f=basis(false);f.window.RTGNet={};
 f.events.offline();assert.equal(f.nodes[0].className,'bss-net');assert.equal(f.nodes[0].role,'status');
 f.timers.shift()();f.setDs(true);f.events.offline();assert.equal(f.nodes.length,0);
 delete f.window.RTGNet;f.events.online();assert.equal(f.nodes.length,1);
 assert.equal(f.nodes[0].className,'ds-melding toon');assert.equal(f.nodes[0].textContent,'De verbinding is terug.');
});
