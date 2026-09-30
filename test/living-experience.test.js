/* De ervaringscompiler wijst kapotte bestemming, toestand, wereld en overdracht af.
   Ontbrekend, veranderd of overgeslagen bewijs kan nooit groen worden. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {compile}=require('../scripts/lib/experience/compiler');
const {state,outcome}=require('../scripts/lib/experience/evidence');
const {render}=require('../scripts/lib/experience/observatory');
const root=path.join(__dirname,'..'),constitution=require('../experience/constitution.json'),dinner=require('../experience/dinner.json');
const travel=require('../experience/travel.json');
function contract(change){const j=structuredClone(dinner);if(change)change(j);return compile(root,constitution,[j]);}
test('de echte reis verbindt bronnen, schermen, wereld, bevoegdheid en bewijs zonder alle schermen bewezen te noemen',()=>{
  const r=contract();assert.deepEqual(r.errors,[]);assert.ok(r.nodes.filter(n=>n.route).length>250);
  assert.equal(r.nodes.find(n=>n.route==='/apps/foodcourt.html').coverage,'CONTRACT_ONLY');
  assert.ok(r.nodes.some(n=>n.coverage==='NOT_MODELED'));
  assert.ok(r.edges.some(e=>e.to==='object:dinner'));
});
for(const [name,change,code] of [
  ['kapotte bestemming',j=>j.steps[1].destination='/api/bestaat-niet','ACTION_DESTINATION_MISSING'],
  ['ontbrekende fouttoestand',j=>j.steps[1].states=j.steps[1].states.filter(s=>s!=='error'),'STATE_MISSING'],
  ['geen herstel',j=>j.steps[1].recovery='','RECOVERY_MISSING'],
  ['verkeerde wereld',j=>j.steps[1].world='travel','WORLD_MISMATCH'],
  ['geen resultaat',j=>j.steps[1].result='','RESULT_MISSING'],
  ['geen bevoegdheid',j=>j.steps[1].authority='','AUTHORITY_MISSING'],
  ['verloren overdracht',j=>j.handoffs=[],'HANDOFF_MISSING'],
  ['bevoegdheid meenemen',j=>j.handoffs[0].carry=['credentials'],'AUTHORITY_TRANSFER'],
  ['lege toestandeneis',j=>j.requiredStates=[],'REQUIRED_STATES_MISSING'],
  ['ontbrekende test',j=>j.proofs[0].test='test/absent.js','TEST_MISSING']
])test('compiler weigert '+name,()=>assert.ok(contract(change).errors.some(e=>e.code===code)));
test('bewijs ontbreekt, verloopt, verandert of wordt overgeslagen en wordt nooit stil groen',()=>{
  const now=Date.parse('2026-09-29T12:00:00Z'),r={version:1,test:'test/x.js',at:new Date(now).toISOString(),sourceHash:'a',logHash:'b',tests:4,skipped:0,exitCode:0,passed:true};
  assert.equal(state(null,'a','test/x.js',now),'NOT_TESTED');
  assert.equal(state(r,'a','test/x.js',now),'PROVEN');
  assert.equal(state(r,'changed','test/x.js',now),'STALE');
  assert.equal(state(r,'a','test/x.js',now+86400001),'STALE');
  assert.equal(state({...r,skipped:1},'a','test/x.js',now),'BLOCKED');
  assert.equal(state({...r,passed:false,exitCode:1},'a','test/x.js',now),'FAILED');
  assert.equal(state({...r,sourceChanged:true},'a','test/x.js',now),'STALE');
  assert.equal(state({...r,at:'bad'},'a','test/x.js',now),'BLOCKED');
});
test('testproces moet daadwerkelijk alle proeven uitvoeren; nul, skip, todo en crash zijn rood',()=>{
  const tap='# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(outcome(0,tap),true);
  for(const broken of ['',tap.replace('# pass 2','# pass 1'),tap.replace('# skipped 0','# skipped 1'),tap.replace('# todo 0','# todo 1')])assert.equal(outcome(0,broken),false);
  assert.equal(outcome(1,tap),false);
});
test('observatorium ontsnapt contractinhoud en presenteert menselijke beoordeling niet als bewezen',()=>{
  const graph=contract(j=>j.humanIntent='<img src=x onerror=alert(1)>');
  const html=render({graph,proofs:[],status:'INCOMPLETE',at:'now',commit:'x'});
  assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('Menselijke beoordeling: <strong>NOT_TESTED'));
});
test('twee reizen verbinden de gedeelde proeven zonder dubbele uitvoer of stil ontbrekende verwijzingen',()=>{
 const graph=compile(root,constitution,[dinner,travel]);assert.deepEqual(graph.errors,[]);
 assert.ok(graph.edges.some(e=>e.from==='intent:travel'&&e.to==='proof:dinner:intent'));
 assert.equal(graph.nodes.filter(n=>n.type==='proof'&&n.test==='test/experience-intent.test.js').length,1);
 const broken=structuredClone(travel);broken.proofRefs=['missing'];
 assert.ok(compile(root,constitution,[dinner,broken]).errors.some(e=>e.code==='SHARED_PROOF_MISSING'));
});
test('een gedeelde rode intentproef houdt beide reizen onvolledig in het observatorium',()=>{
 const graph=compile(root,constitution,[dinner,travel]);
 const proofs=[...dinner.proofs,...travel.proofs].map(p=>({...p,state:p.id==='intent'?'FAILED':'PROVEN'}));
 const html=render({graph,proofs,status:'INCOMPLETE',at:'now',commit:'x'});
 assert.match(html,/data-status="FAILED" data-journeys="dinner travel"/);
 for(const id of ['dinner','travel'])assert.match(html,new RegExp('<article id="journey-'+id+'">[^]*?<strong>INCOMPLETE</strong>'));
 assert.ok(!html.includes('<strong>PROVEN_IN_SCOPE</strong>'));
});
