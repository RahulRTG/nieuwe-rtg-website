'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bron=fs.readFileSync('public/shared/cookie.js','utf8');
function draai({ds=true,iframe=false,bewaard=false,taal='nl',canvas=false}={}){
 class N{constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.style={waarden:{},setProperty(k,v){this.waarden[k]=v;},getPropertyValue(k){return this.waarden[k]||'';},removeProperty(k){delete this.waarden[k];}};this.isConnected=true;this.listeners={};this.klassen=new Set();this.classList={add:k=>this.klassen.add(k),remove:k=>this.klassen.delete(k),contains:k=>this.klassen.has(k)};}appendChild(n){n.parentNode=this;this.children.push(n);}insertBefore(n){n.parentNode=this;this.children.unshift(n);}setAttribute(k,v){this[k]=v;}addEventListener(k,f){this.listeners[k]=f;}remove(){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.isConnected=false;}contains(n){return n===this||this.children.includes(n);}getBoundingClientRect(){return {height:60,width:300,left:0,top:0};}}
 const body=new N('body'),head=new N('head'),vlak=canvas?new N('main'):null,html=new N('html');html.hasAttribute=()=>ds;
 const saved=[],document={body,head,documentElement:html,querySelector:()=>vlak,createElement:t=>new N(t)};
 let listeners=0;const window={document,addEventListener(){listeners++;}};window.self=window;window.top=iframe?{}:window;
 const ctx={window,document,navigator:{language:taal},localStorage:{getItem:()=>bewaard?'ja':null,setItem:(k,v)=>saved.push([k,v])},Date,innerHeight:900,getComputedStyle:()=>({position:'static'})};
 vm.runInNewContext(bron,ctx);return {head,body,vlak,saved,listeners,html};
}
test('DS cookiemelding behoudt taal, privacy en opslag zonder stijlinjectie/meting',()=>{
 for(const canvas of [false,true])for(const taal of ['nl','en']){const e=draai({canvas,taal}),n=(e.vlak||e.body).children[0];assert.equal(e.head.children.length,0);assert.equal(n.className,'ds-cookie');assert.equal(n.children[0].textContent,taal==='en'?'Functional storage only':'Alleen functionele opslag');assert.equal(n.children[1].href,'/apps/juridisch/privacy.html');assert.equal(e.listeners,0);n.children[2].listeners.click();assert.equal((e.vlak||e.body).children.length,0);assert.equal(e.saved[0][0],'rtg_cookieinfo_v1');assert.ok(!Number.isNaN(Date.parse(e.saved[0][1])));}
});
test('geen tweede melding in iframe of bij opslag; legacy host gebruikt dezelfde centrale klasse',()=>{
 for(const opts of [{iframe:true},{bewaard:true}]){const e=draai(opts);assert.equal(e.body.children.length+e.head.children.length,0);}
 const e=draai({ds:false}),n=e.body.children[0];assert.equal(e.head.children.length,0);assert.equal(n.className,'ds-cookie ds-cookie--overlay');assert.equal(e.body.classList.contains('ds-cookie-host'),true);assert.equal(e.html.style.waarden['--rtg-cookieruimte'],'72px');assert.equal(e.listeners,1);for(const doel of n.children.slice(1))assert.equal(doel.style.waarden['min-block-size'],'var(--ds-doel)');n.children[2].listeners.click();assert.equal(e.body.classList.contains('ds-cookie-host'),false);assert.equal(e.html.style.waarden['--rtg-cookieruimte'],undefined);
});
test('cookiebundel volgt alleen eigen delen; DS-tokengebruik en doelen blijven toetsbaar',()=>{
 assert.equal(bron,require('../scripts/bundel').bundel('shared/cookie.js').toString('utf8'));
 const css=fs.readFileSync('public/ds/componenten/cookie.css','utf8'),tokens=fs.readFileSync('public/ds/tokens.css','utf8');for(const m of css.matchAll(/var\((--ds-[\w-]+)/g))if(!m[1].startsWith('--ds-cookie-'))assert.ok(tokens.includes(m[1]+':'),m[1]);assert.match(css,/min-block-size: var\(--ds-doel\)/);assert.match(css,/\.ds-cookie--overlay/);assert.doesNotMatch(css,/!important|#[0-9a-f]{3,8}\b/);assert.doesNotMatch(bron,/createElement\(['"]style|#[\w-]+\s*\{/);
});

test('alle cookiehosts declareren hun centrale presentatiebron',()=>{
 const hosts=[];function loop(map){for(const e of fs.readdirSync(map,{withFileTypes:true})){const p=map+'/'+e.name;if(e.isDirectory())loop(p);else if(e.name.endsWith('.html')){const s=fs.readFileSync(p,'utf8');if(s.includes('shared/cookie.js'))hosts.push([p,s]);}}}loop('public');
 assert.equal(hosts.length,255);
 for(const [pad,s] of hosts){const volledig=s.includes('/ds/rtg-ds.css')||s.includes('/ds/bediening.css');const minimaal=s.includes('/ds/tokens.css')&&s.includes('/ds/componenten/cookie.css');assert.ok(volledig||minimaal,pad);assert.ok(!s.includes('/ds/componenten/cookie.css')||s.match(/\/ds\/componenten\/cookie\.css/g).length===1,pad);}
});
