'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const lees=p=>fs.readFileSync(path.join(__dirname,'../public/apps',p),'utf8');
const beurt=()=>new Promise(r=>setImmediate(r));
function omgeving(){const store=new Map(),calls=[];let n=0;return{store,calls,
 sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
 crypto:{randomUUID:()=> 'K'+(++n)},api:(p,b)=>new Promise((resolve,reject)=>calls.push({p,b,resolve,reject}))};}
function bureau(o){const s=lees('lifestyle.html'),knop={},nodes={'#zK':knop,'#zT':{value:'Taak'},'#zW':{value:''},'#zS':{value:'regulier'},'#zD':{value:'vervoer'},'#zB':{value:'0'}};
 const ctx={...o,zaakBedoeling:'',$:k=>nodes[k],meld(){},vZaken(){}};
 const a=s.indexOf("  $('#zK').onclick = async () =>",s.indexOf('async function vZaken'));vm.runInNewContext(s.slice(a,s.indexOf('  const nieuw=document.createElement',a)),ctx);
 return{submit:()=>knop.onclick(),ok:{zaak:{beslissing:{nodig:false}}}};}
function bank(o){const s=lees('kantoren.html');let klik;const nodes={bankOpenCode:{value:'A'},bankOpenSoort:{value:'betaal'},bankRekOpen:{},bankOpenZet:{addEventListener:(_,fn)=>klik=fn}};
 const ctx={...o,$:k=>nodes[k.slice(1)],meld(){},bankVervers(){}};
 vm.runInNewContext(s.slice(s.indexOf('let bankOpenBedoeling ='),s.indexOf('function bankRenderRek(rij)'))+'\nbankRenderRekOpen();',ctx);
 return{submit:()=>{nodes.bankOpenCode.value='A';return klik();},ok:{rekening:{iban:'test'}}};}
function werkplek(o){const s=lees('werkplek-campus.js');let submit;
 const ctx={...o,MODEL:{code:'rtg'},k:{id:'finance'},ACT:{api:o.api},shell(){},alert(){},
 document:{querySelector:k=>k==='#campusTaakForm'?{addEventListener:(_,fn)=>submit=fn}:k==='#campusTaakNieuw'?{addEventListener(){}}:{value:'Taak'}}};ctx.window=ctx;
 vm.runInNewContext(lees('werkplek-taken.js')+s.slice(s.indexOf('  function verander('),s.indexOf('  function bindNav('))+'\nRTGWerkplekTaken.bind(MODEL,k,verander);',ctx);
 return{submit:()=>submit({preventDefault(){}}),ok:{taken:[]}};}
for(const [naam,maak] of Object.entries({bureau,bank,werkplek}))for(const laat of ['succes','fout']){
 test(naam+': laat K1-'+laat+' bewaart de al begonnen K2',async()=>{
  const o=omgeving(),client=maak(o);
  client.submit();client.submit();assert.deepEqual(o.calls.map(c=>c.b.idem),['K1','K1']);
  o.calls[0].resolve(client.ok);await beurt();client.submit();assert.equal(o.calls[2].b.idem,'K2');
  if(laat==='succes')o.calls[1].resolve(client.ok);else o.calls[1].reject(Error('laat mislukt'));
  await beurt();assert.ok([...o.store.values()].includes('K2'),'laat K1 antwoord mag K2 niet wissen');
  o.calls[2].reject(Error('K2 onzeker'));await beurt();client.submit();assert.equal(o.calls[3].b.idem,'K2','retry behoudt onzekere K2');
  o.calls[3].resolve(client.ok);await beurt();assert.equal(o.store.size,0);
 });
}
for(const [naam,maak] of Object.entries({bureau,bank}))for(const fout of ['schrijven','teruglezen']){
 test(naam+': opslag '+fout+' faalt dicht bij eerste en tweede klik, herstel behoudt sleutel',async()=>{
  const o=omgeving();let stuk=true;const normaal=o.sessionStorage;
  o.sessionStorage={...normaal,setItem(k,v){if(stuk&&fout==='schrijven')throw Error('opslag geweigerd');normaal.setItem(k,v);},
   getItem(k){if(stuk&&fout==='teruglezen')return null;return normaal.getItem(k);}};
  const client=maak(o);client.submit();await beurt();assert.equal(o.calls.length,0,'eerste klik verstuurt niets');
  client.submit();await beurt();assert.equal(o.calls.length,0,'tweede klik omzeilt opslag niet');
  stuk=false;client.submit();await beurt();assert.equal(o.calls.length,1);assert.equal(o.calls[0].b.idem,'K1');
  o.calls[0].resolve(client.ok);await beurt();
 });
}
