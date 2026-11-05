'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {herkomst}=require('../scripts/lib/bundelherkomst');
const tel=s=>(s.match(/INJECT/g)||[]).length;
function proef(actie){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-bundelherkomst-'));try{
 fs.mkdirSync(path.join(dir,'parts'));fs.writeFileSync(path.join(dir,'parts/01.js'),'INJECT;');fs.writeFileSync(path.join(dir,'parts/02.js'),'doe();');fs.writeFileSync(path.join(dir,'owner.js'),'INJECT;doe();');
 const o={publiek:dir,register:{'owner.js':'parts'},injectie:{'public/owner.js':1,'public/parts/01.js':1},norm:{'public/owner.js':1},tel,verwijzingen:new Set()};actie(o,dir);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('bytegelijke parts gebruiken alleen bestaand ownerbudget en wijzigen geen ruwe meting',()=>proef(o=>{const voor=JSON.stringify(o.injectie);const r=herkomst(o);assert.deepEqual([...r.delen],['public/parts/01.js']);assert.deepEqual(r.fouten,[]);assert.equal(JSON.stringify(o.injectie),voor);}));
for(const fout of ['mismatch','missing','dubbel','direct','nieuw','meetdrift'])test('herkomst sluit '+fout+' niet weg',()=>proef((o,d)=>{
 if(fout==='mismatch')fs.writeFileSync(path.join(d,'owner.js'),'anders');
 if(fout==='missing')fs.unlinkSync(path.join(d,'owner.js'));
 if(fout==='dubbel'){o.register['tweede.js']='parts';fs.writeFileSync(path.join(d,'tweede.js'),'INJECT;doe();');}
 if(fout==='direct')o.verwijzingen.add('public/parts/02.js');
 if(fout==='nieuw')o.norm={};
 if(fout==='meetdrift')o.injectie['public/owner.js']=0;
 const r=herkomst(o);assert.equal(r.delen.size,0);assert.ok(r.fouten.length);
}));
test('extra injectie blijft zichtbaar bij owner en krijgt geen extra budget',()=>proef((o,d)=>{
 fs.writeFileSync(path.join(d,'parts/02.js'),'INJECT;');fs.writeFileSync(path.join(d,'owner.js'),'INJECT;INJECT;');o.injectie['public/owner.js']=2;o.injectie['public/parts/02.js']=1;
 const r=herkomst(o);assert.equal(r.fouten.length,0);assert.equal(o.injectie['public/owner.js']>o.norm['public/owner.js'],true);assert.equal(r.delen.has('public/owner.js'),false);
}));
test('bronbudget vouwen maakt berekende directe partload niet DS-groen',()=>proef(o=>{
 const {scriptLaadAnalyse,contractFouten}=require('../scripts/ontwerpsysteem');
 const a=scriptLaadAnalyse("const s=document.createElement('script');s.src='/parts/'+window.deel+'.js';document.head.appendChild(s);",{ds:true});
 assert.ok(a.onzeker.length,'berekende partload blijft onbeslist');
 const h=herkomst(o);assert.equal(h.delen.has('public/parts/01.js'),true,'alleen het bytegelijke bronbudget wordt geconsolideerd');
 const fouten=contractFouten({paginas:{'public/proef.html':{ds:true,erfenis:0,mogelijkeErfenis:0,onzeker:a.onzeker,injecteert:[],mogelijkeInjectie:[]}}});
 assert.ok(fouten.some(f=>f.includes('public/proef.html: onbesliste laadgraaf')),'integrale contractcontrole blijft rood');
}));
