'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const uitvoer=fs.readFileSync('public/shared/uitvoer/uitvoer-02.js','utf8');
const uitvoerBasis=fs.readFileSync('public/shared/uitvoer/uitvoer-01b.js','utf8');
const sprong=fs.readFileSync('public/shared/sprong/sprong-02.js','utf8');
// Werkelijke injectiecode, zonder de overige UI te vervangen door een tweede owner.
const blokken=[['uitvoer',uitvoerBasis.slice(uitvoerBasis.indexOf('  function laadUitvoerPresentatie('),uitvoerBasis.indexOf('\n\n  var knop'))+'\n'+uitvoer.slice(uitvoer.indexOf('  function start() {'),uitvoer.indexOf('    herzie();',uitvoer.indexOf('  function start() {')))+'\n}\nstart();'],['sprong',sprong.slice(sprong.indexOf('  function laadSprongPresentatie('),sprong.indexOf('  /* De zoeklade'))+'\nstijl();']];
for(const [naam,code] of blokken)test(naam+': actuele DS-grens gaat voor eerder vastgelegde stand',()=>{
 for(const captured of [false,true])for(const actueel of [false,true]){
  const laden=[],document={documentElement:{hasAttribute:k=>k==='data-ds'&&actueel},createElement:tag=>({tag}),getElementById:()=>null,head:{appendChild:n=>laden.push(n)}};
  vm.runInNewContext(code,{document,d:document,ds:captured,dsBijStart:captured,css:'ongewijzigde legacy CSS'});
  const geblokkeerd=naam==='sprong'&&(captured||actueel);
  assert.equal(laden.length,geblokkeerd||naam==='uitvoer'&&actueel?0:1);
  if(!actueel&&naam==='uitvoer'){
   assert.equal(laden[0].tag,'link');assert.equal(laden[0].href,'/ds/rtg-ds.css');
  }
  if(!geblokkeerd&&naam==='sprong'){assert.equal(laden[0].tag,'link');assert.equal(laden[0].href,'/ds/rtg-ds.css');}
 }
});
test('actuele bronparts houden legacy CSS buiten het DS-injectiepad',()=>{
 const {bundel}=require('../scripts/bundel'),{scriptLaadAnalyse}=require('../scripts/ontwerpsysteem');
 for(const naam of ['uitvoer','sprong']){
  const a=scriptLaadAnalyse(bundel('shared/'+naam+'.js').toString(),{ds:true});
  assert.equal(a.injecties+a.mogelijkeInjecties,0,naam+': '+JSON.stringify(a));
 }
});
test('gesloten DS-eigenaars hebben geen stijlinjectie-uitzondering meer',()=>{
 const {scriptLaadAnalyse}=require('../scripts/ontwerpsysteem');
 const contract=JSON.parse(fs.readFileSync('public/ds/contract.json','utf8'));
 const paden=['i18n','cookie','uitvoer','sprong','poortgesprek','basis','plek','plaatsnadering'].map(n=>'public/shared/'+n+'.js');
 paden.push('public/apps/magnaat-sandbox.js');
 for(const pad of paden){
  assert.ok(!contract.overgangsscripts.some(s=>s.pad===pad),pad);
  const a=scriptLaadAnalyse(fs.readFileSync(pad,'utf8'),{ds:true});
  assert.equal(a.injecties+a.mogelijkeInjecties,0,pad+': '+JSON.stringify(a));
 }
});
