'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const a11y=require('../scripts/lib/experience/a11y');

const routeResult=()=>({
  states:Object.fromEntries(a11y.STATES.map(name=>[name,{measured:true,structural:0,contrast:0}])),
  mobile:{},touchTargets:{},tablet:null,
  themes:Object.fromEntries(a11y.THEMES.map(name=>[name,{measured:true,structural:0,contrast:0}]))
});
const measurement=()=>({schemaVersion:2,browser:{name:'chromium',version:'145.0.1'},paginas:3,
  routes:{'/apps/a.html':routeResult(),'/apps/b.html':routeResult(),'/site/404.html':routeResult()}});

test('volledige nulmeting projecteert exacte schermwaarnemingen',()=>{
  const out=a11y.validate(measurement(),['/apps/a.html','/apps/b.html']);
  assert.equal(out.status,'PROVEN');assert.deepEqual(out.blockers,[]);
  assert.deepEqual(out.observations['/apps/a.html'],a11y.expected());
});

for(const [name,change,reason] of [
  ['ontbrekende route',m=>{delete m.routes['/apps/b.html'];m.paginas--;},'A11Y_ROUTE_MISSING:/apps/b.html'],
  ['onbekende route',m=>{m.routes['/apps/x.html']=routeResult();m.paginas++;},'A11Y_ROUTE_UNKNOWN:/apps/x.html'],
  ['niet gemeten staat',m=>{m.routes['/apps/a.html'].states.zaak.measured=false;},'A11Y_STATE_NOT_MEASURED:/apps/a.html:zaak'],
  ['contrastfout',m=>{m.routes['/apps/a.html'].themes.royal.contrast=1;},'A11Y_CONTRAST_OR_STRUCTURE_FAILED:/apps/a.html'],
  ['browser zonder versie',m=>{m.browser.version='';},'A11Y_BROWSER_IDENTITY_INVALID']
]) test('a11y-adapter weigert '+name,()=>{
  const m=measurement();change(m);const out=a11y.validate(m,['/apps/a.html','/apps/b.html']);
  assert.equal(out.status,'BLOCKED');assert.ok(out.blockers.includes(reason),out.blockers.join('\n'));
});
