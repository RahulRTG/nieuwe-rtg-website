'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createRequire}=require('node:module');
const bestand=path.resolve(__dirname,'../scripts/lib/voltooiwereld.js');
function wereldMaker(opties={}){
 const proc=new EventEmitter();proc.env={};
 const kinderen=[],mappen=[],echt=createRequire(bestand),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(bestand,'utf8'),{module,process:proc,AbortSignal,
  fetch:async()=>({ok:true,json:async()=>({pid:opties.antwoordPid ?? 321})}),require(id){
  if(id!=='./wegwerpserver')return echt(id);
  return {...echt(id),start:async({datamap})=>{
   const kind={pid:321,exitCode:null,signalCode:null,signalen:[],kill(sig){this.signalen.push(sig);}};
   kinderen.push(kind);mappen.push(datamap);
   if(opties.startFout)throw new Error('testserver kon niet starten');
   return {kind,basis:'http://127.0.0.1:1',klaar(){kind.kill('SIGKILL');}};
  }};
 }},{filename:bestand});
 return {maak:module.exports.maakWereld,proc,kinderen,mappen,opruimen(){for(const p of mappen)fs.rmSync(p,{recursive:true,force:true});}};
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

test('vaste browserorigin wordt uitsluitend aan het eigen testproces gebonden',async()=>{
 const h=wereldMaker();
 try{
  const w=await h.maak('eigen-origin',undefined,{behoudAdres:true});
  assert.equal(w.basis,'http://127.0.0.1:1');
  w.klaar();
  assert.equal(fs.existsSync(w.datamap),false);
 }finally{h.opruimen();}
});
test('een andere server op de vaste origin levert geen bewijswereld en geen achtergebleven datamap',async()=>{
 const h=wereldMaker({antwoordPid:987});
 try{
  await assert.rejects(h.maak('verkeerde-origin',undefined,{behoudAdres:true}),/eigen testproces/);
  assert.equal(h.proc.listenerCount('exit'),0);
  assert.equal(h.kinderen[0].signalen.includes('SIGKILL'),true);
  assert.equal(h.mappen.every(p=>!fs.existsSync(p)),true);
 }finally{h.opruimen();}
});
test('mislukte serverstart ruimt de eigen tijdelijke datamap op',async()=>{
 const h=wereldMaker({startFout:true});
 try{
  await assert.rejects(h.maak('startfout'),/kon niet starten/);
  assert.equal(h.proc.listenerCount('exit'),0);
  assert.equal(h.mappen.length,1);
  assert.equal(h.mappen.every(p=>!fs.existsSync(p)),true);
 }finally{h.opruimen();}
});
