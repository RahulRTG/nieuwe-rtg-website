'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createRequire}=require('node:module');
const bestand=path.resolve(__dirname,'../scripts/lib/voltooiwereld.js');
function wereldMaker(){
 const proc=new EventEmitter();proc.env={};
 const kinderen=[],mappen=[],echt=createRequire(bestand),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(bestand,'utf8'),{module,process:proc,require(id){
  if(id!=='./wegwerpserver')return echt(id);
  return {...echt(id),start:async({datamap})=>{
   const kind={signalen:[],kill(sig){this.signalen.push(sig);}};
   kinderen.push(kind);mappen.push(datamap);return {kind,basis:'http://127.0.0.1:1'};
  }};
 }},{filename:bestand});
 return {maak:module.exports.maakWereld,proc,kinderen,opruimen(){for(const p of mappen)fs.rmSync(p,{recursive:true,force:true});}};
}
test('opeenvolgende voltooiscenario’s laten geen exit-listeners achter',async()=>{
 const h=wereldMaker();
 try{
  for(let i=0;i<12;i++){
   const w=await h.maak('lifecycle');
   assert.equal(h.proc.listenerCount('exit'),1,'alleen de actieve wereld');
   w.klaar();
   assert.equal(h.proc.listenerCount('exit'),0,'afgeronde wereld laat listener los');
   assert.equal(fs.existsSync(w.datamap),false);
  }
 }finally{h.proc.emit('exit');h.opruimen();}
});
test('procesafsluiting ruimt alleen nog actieve werelden op',async()=>{
 const h=wereldMaker();
 try{
  const gesloten=await h.maak('gesloten'),actief=await h.maak('actief');
  gesloten.klaar();
  assert.equal(h.proc.listenerCount('exit'),1);
  h.proc.emit('exit');
  assert.deepEqual(h.kinderen.map(k=>k.signalen),[['SIGKILL'],['SIGKILL']]);
  assert.equal(h.proc.listenerCount('exit'),0);
  assert.equal(fs.existsSync(actief.datamap),false);
 }finally{h.opruimen();}
});
