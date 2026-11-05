const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { bundel } = require('../scripts/bundel');
const source = bundel('shared/bureaupda.js').toString('utf8');
function fixture(bureau, token = 'office-test') {
  const nodes = Object.fromEntries(['main','pCat','pFilters','pLijst','pMaak','pNaam','pBrief','melding'].map(id => [id, {
    innerHTML:'', value:'', options:[], listeners:{}, classList:{add(){},remove(){}},
    addEventListener(event, fn){this.listeners[event]=fn;}, querySelectorAll(){return [];}
  }]));
  const calls=[], doors=[], timers=[]; let exportSource;
  const design={id:'one',naam:'<Concept>',discipline:'a',disciplineLabel:'Discipline',status:'concept',concept:null};
  const window={RTGDeur:{toon:(el, options)=>doors.push(options)}, RTGUitvoer:{bron:fn=>{exportSource=fn;}}};
  const document={querySelector:s=>nodes[s.slice(1)],querySelectorAll:()=>[],getElementById:id=>nodes[id],
    createElement(){throw Error('PDA mag geen eigen stylesheet injecteren');}};
  const context={window,document,localStorage:{getItem:()=>token},location:{pathname:'/apps/'+bureau+'-pda.html'},
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    fetch:async(url,options)=>{calls.push({url,options}); return {ok:true,status:200,json:async()=> url.endsWith('/maak') ? {ontwerp:design} : url.endsWith('/concept') ? {ontwerp:{...design,concept:{}}} : {disciplines:[{id:'a',label:'Discipline'}],ontwerpen:[design],statussen:['concept','productie']}};}};
  vm.runInNewContext(source,context);window.RTGBureauPDA.start(bureau);
  return {nodes,calls,doors,timers,exportSource:()=>exportSource()};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const bureau of ['studio','hardware','architect']) {
  test(bureau+': eigen kantoorroute, tekstescaping, statusactie en modeluitvoer blijven werken',async()=>{
    const f=fixture(bureau);await settle();
    assert.equal(f.calls[0].url,'/api/office/'+bureau);
    assert.equal(f.calls[0].options.headers.Authorization,'Bearer office-test');
    assert.match(f.nodes.pLijst.innerHTML,/&lt;Concept&gt;/);
    assert.match(f.nodes.pLijst.innerHTML,/data-next="one" data-s="productie"/);
    assert.match(f.nodes.pFilters.innerHTML,/aria-pressed="true"/);
    assert.doesNotMatch(f.nodes.pLijst.innerHTML,/style=/);
    assert.equal(f.exportSource().rijen.length,1);
    f.nodes.pNaam.value='Nieuw';f.nodes.pBrief.value='Een echte brief';f.nodes.pCat.value='a';
    f.nodes.pMaak.listeners.click();await settle();
    assert.deepEqual(f.calls.slice(1).map(x=>x.url),['/api/office/'+bureau+'/maak','/api/office/'+bureau+'/concept']);
    assert.deepEqual(JSON.parse(f.calls[1].options.body),{discipline:'a',naam:'Nieuw',brief:'Een echte brief'});
  });
  test(bureau+': zonder sessie alleen bestaande deur, geen kantoorverzoek',()=>{
    const f=fixture(bureau,null);f.timers.forEach(fn=>fn());
    assert.equal(f.calls.length,0);assert.equal(f.doors[0].soort,'personeel');
    assert.match(f.doors[0].naar,new RegExp(bureau+'-pda'));
  });
  test(bureau+': lokale stijlkopie verwijderd; gedeelde werkruimte behoudt oorspronkelijke eigenaar',()=>{
    const html=fs.readFileSync('public/apps/'+bureau+'-pda.html','utf8');
    assert.doesNotMatch(html,/<style|\sstyle=/);
    const sharedStyles=[...html.matchAll(/<link\b[^>]*href="(\/shared\/[^\"]+\.css)"[^>]*>/g)].map(match=>match[1]);
    assert.deepEqual(sharedStyles,[]);
    assert.match(html,/<script src="\/shared\/rtg-world-desktop\.js" defer><\/script>/);
    assert.match(html,/data-rtg-world="work" data-rtg-skin="heritage" data-rtg-layout="standard"/);
    for(const id of ['pCat','pNaam','pBrief','pMaak','pFilters','pLijst','melding']) assert.ok(html.includes('id="'+id+'"'));
    for(const owner of ['uitvoer','deur','bureaupda','metgezel']) assert.ok(html.includes('/shared/'+owner+'.js'));
    for(const route of ['werk.html','werkruimte.html','leverancier.html','comm.html','ik.html']) assert.ok(html.includes('/apps/'+route));
  });
}
test('gebundelde PDA komt exact overeen met de bronparts',()=>assert.equal(fs.readFileSync('public/shared/bureaupda.js','utf8'),source));
