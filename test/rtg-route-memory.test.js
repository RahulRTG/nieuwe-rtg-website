'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const memory = require('../public/shared/rtg-route-memory.js');
const core = require('../public/shared/rtg-route-memory-core.js');
class Target {
  constructor() { this.events = {}; this.attrs = {}; }
  addEventListener(n, f) { (this.events[n] ||= []).push(f); }
  removeEventListener(n, f) { this.events[n] = (this.events[n] || []).filter(x => x !== f); }
  dispatchEvent(e) { (this.events[e.type] || []).slice().forEach(f => f(e)); }
  getAttribute(n) { return this.attrs[n] ?? null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  hasAttribute(n) { return n in this.attrs; }
}
function env(state, options = {}) {
  const win = new Target(), doc = new Target(), body = new Target(), values = new Map();
  const root = {scrollHeight: 2000, scrollWidth: 390};
  doc.body = body; doc.documentElement = root; doc.scrollingElement = root; doc.readyState = 'complete';
  doc.scrolls = []; doc.key = null;
  doc.querySelectorAll = selector => selector === '[data-rtg-scroll]' ? doc.scrolls : [];
  doc.querySelector = selector => selector.startsWith('[data-rtg-continue-key]') ? doc.key : null;
  win.location = {href: 'https://rtg.test/apps/agenda.html', hash: ''};
  win.performance = {getEntriesByType: () => [{type: options.type || 'navigate'}]};
  win.sessionStorage = {getItem: k => values.get(k), setItem: (k,v) => values.set(k,v)};
  win.innerWidth = 390; win.innerHeight = 800; win.scrollX = 0; win.scrollY = 0;
  win.scrollTo = p => { win.scrollX = p.left; win.scrollY = p.top; };
  win.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts.detail; } };
  let id = 0; const timers = new Map();
  win.setTimeout = f => { timers.set(++id,f); return id; }; win.clearTimeout = i => timers.delete(i);
  if (state) values.set(memory.storageKey, JSON.stringify([{key:'/apps/agenda.html', at:Date.now(),state}]));
  const api = memory.create(win, doc);
  return {api,win,doc,root,values,timers};
}
test('route identity ignores tokens/fragments and canonicalizes allowed query', () => {
  assert.equal(memory.routeKey({href:'https://a.test/app?token=secret&view=week&id=42#private'}), '/app?id=42&view=week');
  assert.equal(memory.routeKey({href:'https://a.test/app?view=%3Cscript%3E&tab=now'}), '/app?tab=now');
});
test('explicit adapter restores once and does not capture arbitrary fields', () => {
  const e = env({adapters:{agenda:{view:'week'}}}); let view='month', count=0;
  e.api.register('agenda',{capture:()=>({view}),restore:x=>{view=x.view; count++;}});
  e.api.start(); e.api.ready('agenda');
  assert.equal(view,'week'); assert.equal(count,1);
  assert.equal(e.api.register('credentials',{capture:()=>({token:'secret'}),restore:()=>{}}),false);
  e.api.destroy();
});
test('deferred adapter and saved scroll wait for data/render readiness', () => {
  const e=env({window:{x:0,y:900},adapters:{agenda:{view:'week'}}}); let view='month', ready=false;
  e.api.register('agenda',{capture:()=>({view}),restore:x=>{if(!ready)return false;view=x.view;return true;}});
  e.api.start(); assert.equal(e.win.scrollY,0);
  ready=true; e.api.ready('agenda'); assert.equal(view,'week'); assert.equal(e.win.scrollY,900);
  e.api.destroy();
});
test('late readiness cannot overwrite an edit after keyboard input', () => {
  const e=env({adapters:{files:{q:'saved'}}}); let q='', ready=false;
  e.api.register('files',{capture:()=>({q}),restore:x=>{if(!ready)return false;q=x.q;return true;}});
  e.api.start(); e.doc.dispatchEvent({type:'keydown'}); q='new'; ready=true;
  e.api.ready('files'); assert.equal(q,'new'); e.api.destroy();
});
test('changed adapter baseline is not overwritten even without DOM events', () => {
  const e=env({adapters:{files:{q:'saved'}}}); let q='', ready=false;
  e.api.register('files',{capture:()=>({q}),restore:x=>{if(!ready)return false;q=x.q;return true;}});
  e.api.start(); q='host-change'; ready=true; e.api.ready('files');
  assert.equal(q,'host-change'); e.api.destroy();
});
test('content growth restores progressively, then wheel cancels corrections', () => {
  const e=env({window:{x:0,y:900}}); e.root.scrollHeight=1000;
  e.api.start(); assert.equal(e.win.scrollY,200);
  e.root.scrollHeight=2000; e.api.ready(); assert.equal(e.win.scrollY,900);
  e.doc.dispatchEvent({type:'wheel'}); e.win.scrollY=400; e.api.ready();
  assert.equal(e.win.scrollY,400); e.api.destroy();
});
test('browser history owns window scrolling and BFCache preserves current UI', () => {
  const e=env({window:{x:0,y:900}}, {type:'back_forward'});
  e.api.start(); assert.equal(e.win.scrollY,0);
  e.win.scrollY=650; e.win.dispatchEvent({type:'pageshow',persisted:true}); e.api.ready();
  assert.equal(e.win.scrollY,650); e.api.destroy();
});
test('named scroll containers restore; unnamed controls are not read', () => {
  const e=env({scroll:{timeline:{x:0,y:80}}});
  const el=new Target(); el.setAttribute('data-rtg-scroll','timeline');
  Object.assign(el,{scrollHeight:500,clientHeight:200,scrollWidth:390,clientWidth:390,scrollTop:0,scrollLeft:0});
  e.doc.scrolls=[el]; e.api.start(); assert.equal(el.scrollTop,80); e.api.destroy();
});
test('Continue anchor waits for enhanced Key instead of racing its default', () => {
  const e=env({anchor:'links'}); let calls=0;
  e.win.RTGContinueKey={setPosition:x=>{assert.equal(x,'links');calls++;}};
  e.api.start(); assert.equal(calls,0);
  e.doc.key=new Target(); e.api.ready('continue'); assert.equal(calls,1);
  e.api.ready(); assert.equal(calls,1); e.api.destroy();
});
test('session storage holds only 24 route entries', () => {
  const e=env(); e.values.set(memory.storageKey,JSON.stringify(Array.from({length:24},(_,i)=>({
    key:'/route/'+i,at:Date.now(),state:{window:{x:0,y:0}}
  }))));
  e.api.start(); e.api.save();
  const rows=JSON.parse(e.values.get(memory.storageKey)); assert.equal(rows.length,24);
  assert.equal(rows.at(-1).key,'/apps/agenda.html'); e.api.destroy();
});
test('closed state strips undeclared top-level data and rejects secret adapter fields', () => {
  const result=core.normalizeState({source:{customer:'private'},anchor:'free',density:'invented',
    window:{x:-10,y:Infinity},adapters:{safe:{view:'week'},bad:{token:'secret'}},scroll:{timeline:{x:4,y:5}}});
  assert.deepEqual(result,{window:{x:0,y:0},scroll:{timeline:{x:4,y:5}},adapters:{safe:{view:'week'}}});
  assert.equal(core.closed({password:'secret'}),null);
  assert.equal(core.closed({a:{b:{c:{d:{e:1}}}}}),null);
  assert.equal(core.closed({a:'x'.repeat(500)}).a.length,256);
});
test('pure storage validates route, expiry, payload and total bounds', () => {
  let value=null; const store={getItem:()=>value,setItem:(_,v)=>value=v}, now=Date.now();
  value=JSON.stringify([{key:'/valid',at:now,state:{}},{key:'/old',at:now-core.maxAge,state:{}},
    {key:'/bad?token=secret',at:now,state:{}},{key:'/future',at:now+120000,state:{}}]);
  assert.deepEqual(core.readStorage(store,now).map(x=>x.key),['/valid']);
  assert.equal(core.writeStorage(store,'/bad?token=secret',{},now),false);
  for(let i=0;i<40;i++) assert.equal(core.writeStorage(store,'/route/'+i,{adapters:{filters:{q:'x'.repeat(250)}}},now),true);
  assert.equal(core.readStorage(store,now).length,24); assert.ok(value.length<=core.maxStorageLength);
  value='x'.repeat(core.maxStorageLength+1); assert.deepEqual(core.readStorage(store,now),[]);
  assert.equal(core.writeStorage({getItem(){throw Error('denied');},setItem(){throw Error('denied');}},'/ok',{},now),false);
});
test('native scroll fallback waits, then restores zero position after content readiness', () => {
  const original=Date.now; let now=original(); Date.now=()=>now;
  try {
    const e=env({window:{x:0,y:900}},{type:'back_forward'});
    e.api.start(); assert.equal(e.win.scrollY,0); now+=300;
    e.api.ready(); assert.equal(e.win.scrollY,900); e.api.destroy();
    const f=env({window:{x:0,y:900}},{type:'back_forward'});
    f.api.start(); f.win.scrollY=250; now+=300; f.api.ready();
    assert.equal(f.win.scrollY,250); f.api.destroy();
  } finally { Date.now=original; }
});
test('production runtime and core stay below ten KiB', () => {
  const fs=require('node:fs'),path=require('node:path');
  ['rtg-route-memory.js','rtg-route-memory-core.js'].forEach(file=>assert.ok(fs.statSync(path.join(__dirname,'../public/shared',file)).size<10240));
});

test('native restored form fields allow route flags to restore, but user input still wins', () => {
  const e=env({adapters:{files:{q:'saved',trash:true}}}); let q='',trash=false,ready=false;
  e.api.register('files',{nativeFields:true,capture:()=>({q,trash}),restore:x=>{if(!ready)return false;q=x.q;trash=x.trash;return true;}});
  e.api.start(); q='browser-restored';ready=true;e.api.ready('files');
  assert.equal(q,'saved');assert.equal(trash,true);e.api.destroy();
  const f=env({adapters:{files:{q:'saved'}}});q='';ready=false;
  f.api.register('files',{nativeFields:true,capture:()=>({q}),restore:x=>{if(!ready)return false;q=x.q;return true;}});
  f.api.start();f.doc.dispatchEvent({type:'input'});q='new typing';ready=true;f.api.ready('files');
  assert.equal(q,'new typing');f.api.destroy();
});
