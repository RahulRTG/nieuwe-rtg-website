/* Uitvoering van de bestaande eigenaar; geen browsergeometrie-bewijs. */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('public/shared/ios.js','utf8');
function fixture({ds=true,history=2,frame=false}={}){
 const all=[],timers=[],events={};let back=0;
 function node(tag){const n={tagName:tag.toUpperCase(),className:'',style:{},attrs:{},children:[],listeners:{},
 setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},hasAttribute(k){return k in this.attrs;},removeAttribute(k){delete this.attrs[k];},
 appendChild(c){this.children.push(c);c.parentNode=this;return c;},
 addEventListener(k,f){this.listeners[k]=f;},remove(){this.removed=true;},
 querySelectorAll(){return [];},querySelector(selector){return this.children.find(c=>c.className.split(' ').includes(selector.slice(1)))||null;}};
 n.classList={add(c){if(!n.className.split(' ').includes(c))n.className+=' '+c;},remove(c){n.className=n.className.split(' ').filter(x=>x!==c).join(' ');},contains(c){return n.className.split(' ').includes(c);}};all.push(n);return n;}
 const body=node('body'),head=node('head'),html=node('html');if(ds)html.setAttribute('data-ds','');body.setAttribute('data-osbar','');
 const header={className:'ds-kop',querySelectorAll(){throw Error('DS-header mag niet worden ontleed');}};
 const document={body,head,documentElement:html,createElement:node,getElementById:id=>all.find(x=>x.id===id),
 querySelector:s=>ds&&s.includes('header')?header:null,addEventListener:(k,f)=>events[k]=f,removeEventListener:(k,f)=>{if(events[k]===f)delete events[k];}};
 const location={href:'unchanged',assign(v){this.href=v;}},window={history:{length:history,back(){back++;}},matchMedia:()=>({matches:false}),addEventListener(){},requestAnimationFrame:f=>f()};window.self=window;window.top=frame?{}:window;
 vm.runInNewContext(source,{window,document,location,requestAnimationFrame:f=>f(),setTimeout:f=>timers.push(f)});
 return {all,body,head,header,events,timers,location,api:window.RTGiOS,back:()=>back};
}
for(const ds of [true,false]){
 test((ds?'DS':'legacy')+': zelfde randveeg en bladcontract, menu blijft geladen',()=>{
  const f=fixture({ds});assert.ok(f.api.blad);assert.equal(f.api.THUIS,'/apps/app.html');
  assert.equal(f.head.children.filter(n=>n.tagName==='STYLE').length,0);
  assert.equal(f.head.children.filter(n=>n.tagName==='LINK'&&n.href==='/shared/ios.css').length,ds?0:1);
  assert.equal(f.head.children.filter(n=>n.src==='/shared/appmenu.js').length,1);
  if(ds){assert.equal(f.header.className,'ds-kop');assert.equal(f.body.hasAttribute('data-ios'),false);assert.equal(f.body.hasAttribute('data-osbar'),true);}
  else{assert.equal(f.body.hasAttribute('data-ios'),true);assert.equal(f.body.hasAttribute('data-osbar'),false);}
  f.events.touchstart({touches:[{clientX:10}]});f.events.touchmove({touches:[{clientX:80}]});f.events.touchend();assert.equal(f.back(),1);
  const b=f.api.blad('<tekst>',{label:'Taak'});assert.equal(b.element.attrs.role,'dialog');assert.equal(b.element.attrs['aria-label'],'Taak');
  assert.ok(b.element.children.some(n=>n.textContent==='<tekst>'),'strings blijven tekst, geen HTML');
  assert.equal(b.element.className.includes('ds-ios-blad'),ds);
  f.events.keydown({key:'Escape'});f.timers.forEach(fn=>fn());assert.equal(b.element.removed,true);assert.equal(f.events.keydown,undefined);
 });
 test((ds?'DS':'legacy')+': homeveeg heeft dezelfde drempel; DS heeft geen extra Home-knop of bodytransformatie',()=>{
  const f=fixture({ds}),pil=f.all.find(n=>n.className.split(' ').includes('ios-thuis'));
  assert.equal(pil.tagName,ds?'DIV':'BUTTON');
  pil.listeners.pointerdown({clientY:200,pointerId:1});pil.listeners.pointermove({clientY:180});pil.listeners.pointerup({});
  assert.equal(f.location.href,'unchanged');
  pil.listeners.pointerdown({clientY:200,pointerId:1});pil.listeners.pointermove({clientY:100});
  if(ds)assert.equal(f.body.style.transform,undefined);
  pil.listeners.pointerup({});f.timers.forEach(fn=>fn());assert.equal(f.location.href,'/apps/app.html');
 });
 test((ds?'DS':'legacy')+': ingebed geen tweede home/randveeg/menu, publieke blad API blijft',()=>{
  const f=fixture({ds,frame:true});assert.equal(f.events.touchstart,undefined);assert.equal(f.head.children.length,0);assert.ok(f.api.blad);
 });
}
test('iOS-bundel komt overeen met bronparts',()=>assert.equal(source,require('../scripts/bundel').bundel('shared/ios.js').toString('utf8')));
test('DS-greep gebruikt uitsluitend de vrije strook onder de Edge (broncontract, geen geometrieclaim)',()=>{
 const css=fs.readFileSync('public/ds/componenten/ios.css','utf8');
 const grip=css.slice(css.indexOf('.ds-ios-thuis {'),css.indexOf('.ds-ios-thuis::after'));
 assert.match(grip,/inset-block-end: 0;/);
 assert.match(grip,/block-size: max\(var\(--ds-ruimte-3\), env\(safe-area-inset-bottom, 0px\)\)/);
 assert.doesNotMatch(grip,/min-block-size/);
 assert.match(fs.readFileSync('public/ds/componenten/edge.css','utf8'),/inset-block-end: max\(var\(--ds-ruimte-3\), env\(safe-area-inset-bottom\)\)/);
});
