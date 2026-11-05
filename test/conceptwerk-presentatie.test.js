'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../public/shared/edge/conceptwerk');
function documentje(ds = true) {
  const nodes = [], elements = [];
  function createElement(tag) {
    if (ds) assert.notEqual(tag, 'style', 'geen dynamische stijlbron op DS');
    const e = { tag, children: [], attrs: {}, events: {},
      appendChild(x) { this.children.push(x); }, setAttribute(k,v) { this.attrs[k]=v; },
      removeAttribute(k) { delete this.attrs[k]; }, addEventListener(k,v) { this.events[k]=v; } };
    elements.push(e); return e;
  }
  return { elements, nodes, createElement, documentElement: { hasAttribute: key => ds && key === 'data-ds' }, head: { appendChild: e => nodes.push(e) }, getElementById: id => nodes.find(e => e.id === id) };
}
const concept = (versie=1, waarde=2) => ({ id:'c1', soort:'reiswens', versie, titel:'<script>tekst</script>', waarden:{aantal:waarde}, bewerkbaar:[{naam:'aantal',label:'Aantal',soort:'getal',min:1,max:10}] });
const tick = () => new Promise(resolve => setImmediate(resolve));
test('conceptwerk: gedeelde loader eenmaal, geen style-element, hooks en tekst behouden', () => {
  const d=documentje(), a=C.maak(concept(),d), b=C.maak(concept(),d);
  assert.equal(d.nodes.length,0, 'DS gebruikt de canonieke import');
  assert.equal(a.element.className,'rtg-conceptwerk ds-conceptwerk');
  assert.equal(a.element.children[1].textContent,'<script>tekst</script>');
  assert.equal(b.concept().versie,1);
});
test('conceptwerk: coalescing gebruikt pas de door server bevestigde versie', async () => {
  const d=documentje(), requests=[];
  const card=C.maak(concept(),d,{verstuur:body=>new Promise(resolve=>requests.push({body,resolve}))});
  const input=d.elements.find(e=>e.tag==='input');
  input.value='3';input.events.change();input.value='4';input.events.change();
  assert.equal(requests.length,1);assert.equal(card.concept().waarden.aantal,2);
  requests[0].resolve({status:200,body:{concept:concept(2,3)}});await tick();
  assert.deepEqual(requests[1].body,{id:'c1',versie:2,velden:{aantal:4}});
  requests[1].resolve({status:409,body:{concept:concept(3,5)}});await tick();
  assert.equal(card.concept().waarden.aantal,5);
  assert.ok(d.elements.some(e=>String(e.textContent).includes('elders aangepast')));
});
test('conceptwerk: veldweigering blijft tekstueel en toegankelijk zichtbaar', async () => {
  const d=documentje();C.maak(concept(),d,{verstuur:async()=>({status:400,body:{veld:'aantal',error:'Te groot',concept:concept()}})});
  const input=d.elements.find(e=>e.tag==='input');input.value='99';input.events.change();await tick();
  assert.equal(input.value,'99');assert.equal(input.attrs['aria-invalid'],'true');
  assert.ok(d.elements.some(e=>e.textContent==='Te groot'));
});

test('conceptwerk: oudere host krijgt eenmaal de centrale DS-presentatie', () => {
 const d=documentje(false), oud=global.document;
 try {
  global.document=d;
  const a=C.maak(concept(),d); C.maak(concept(),d);
  assert.equal(d.nodes.length,1); assert.equal(d.nodes[0].tag,'link');
  assert.equal(d.nodes[0].id,'rtgDsRuntimeCss');
  assert.equal(d.nodes[0].rel,'stylesheet');
  assert.equal(d.nodes[0].href,'/ds/rtg-ds.css');
  assert.equal(a.element.className,'rtg-conceptwerk ds-conceptwerk');
 } finally { if (oud === undefined) delete global.document; else global.document=oud; }
});

test('conceptwerk: JavaScript bezit geen runtime-presentatie meer', () => {
 const fs=require('node:fs'), ontwerp=require('../scripts/ontwerpsysteem');
 const bron=fs.readFileSync('public/shared/edge/conceptwerk.js','utf8');
 const analyse=ontwerp.scriptLaadAnalyse(bron,{ds:false});
 assert.deepEqual(analyse.onzeker,[]);
 assert.deepEqual(analyse.verwijzingen,[{href:'/ds/rtg-ds.css',soort:'dom'}]);
 assert.equal(analyse.injecties+analyse.mogelijkeInjecties,0);
 const ds=ontwerp.scriptLaadAnalyse(bron,{ds:true});
 assert.deepEqual(ds.onzeker,[]);
 assert.deepEqual(ds.verwijzingen,[]);
 assert.deepEqual(ds.uitgesloten,['/ds/rtg-ds.css']);
 assert.doesNotMatch(bron,/conceptwerk-legacy\.css/);
});
