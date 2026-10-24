'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
function kern() {
 const db={data:{}};const rekeningen={};const zaken=new Map([['MAISON',{code:'MAISON'}]]);
 const metIdem=require('../server/lib/idem')({d:()=>db.data,save(){},naam:'bankIdem',behoudSleutel:k=>k.startsWith('rekopen-kantoor:'),
  geldigeOntvangst:(k,r)=>!k.startsWith('rekopen-kantoor:')||!!(r&&r.rekening&&typeof r.rekening.iban==='string'&&r.rekening.iban.trim())});
 const bank=require('../server/kern/bank/rekeningen')({db,save(){},crypto,nu:()=>1,
  SOORTEN:{betaal:'Betalen',spaar:'Sparen'},rekeningen:()=>rekeningen,rekMeta:i=>rekeningen[i],saldoVan:()=>0,
  bankregie:{bankIbanParams:()=>({landcode:'NL',bankcode:'RTGB'}),bankRoodStandaard:()=>0},
  findSupplier:c=>zaken.get(String(c).toUpperCase())||null,
  keyVanCodenaam:async c=>({codename:c}),seintje(){},metIdem});
 return {bank,rekeningen,zaken,db,metIdem};
}
test('kantoor gebruikt actor/sleutel, andere eigenaar met dezelfde sleutel is conflict',async()=>{
 const {bank,rekeningen}=kern();const body={codenaam:'A',soort:'betaal',wie:'kantoor',kantoorActor:'user-1',idem:'intent-1'};
 const eerste=await bank.rekeningOpen(body);assert.equal(eerste.ok,true);
 const herhaald=await bank.rekeningOpen(body);assert.equal(herhaald.herhaald,true);assert.equal(herhaald.rekening.iban,eerste.rekening.iban);
 for(const anders of [{codenaam:'B'},{soort:'spaar'},{naam:'Anders'}]) assert.equal((await bank.rekeningOpen({...body,...anders})).status,409);
 assert.equal(Object.keys(rekeningen).length,1);
 assert.equal((await bank.rekeningOpen({...body,kantoorActor:'user-2'})).ok,true);
 assert.equal(Object.keys(rekeningen).length,2);
});
test('kantoor mist sleutel/actor: geen rekening; ledencontract blijft behouden',async()=>{
 const {bank,rekeningen}=kern();
 for(const x of [{},{idem:'x'},{kantoorActor:'user-1'},{idem:' ',kantoorActor:'user-1'}])
  assert.equal((await bank.rekeningOpen({codenaam:'A',wie:'kantoor',...x})).status,400);
 assert.equal(Object.keys(rekeningen).length,0);
 assert.equal((await bank.rekeningOpen({codenaam:'A',wie:'lid'})).ok,true);
});
test('office autoriseert vóór iedere replay en auditeert een herhaling niet nogmaals',async()=>{
 const {bank}=kern();const routes=new Map();let bevoegd=true,audits=0;
 const kluisAuth=(req,res,next)=>{if(!bevoegd)return res.status(403).json({error:'ingetrokken'});req.officeKey='user-1';return next();};
 require('../server/routes/kantoren/bank-rekeningen')({app:{post:(p,...h)=>routes.set(p,h)},kluisAuth,
  kern:{bank},afdelingen:{audit(){audits++;}},sseToOffice(){},naam:()=> 'medewerker'});
 const run=async body=>{let status=200,out;const res={status(n){status=n;return this;},json(x){out=x;return this;}};
  const req={body};const h=routes.get('/api/office/bank/rekening/open');await h[0](req,res,()=>h[1](req,res));return {status,out};};
 const b={codenaam:'A',idem:'intent-1',kantoorActor:'vervalst'};
 assert.equal((await run({codenaam:'A'})).status,400);
 assert.equal((await run(b)).status,200);assert.equal((await run(b)).out.herhaald,true);assert.equal(audits,1);
 bevoegd=false;assert.equal((await run(b)).status,403);assert.equal(audits,1);
});
test('kantoorclient bewaart bedoeling bij timeout, payloadwijziging en herladen',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const html=fs.readFileSync(require('node:path').join(__dirname,'../public/apps/kantoren.html'),'utf8');
 const bron=html.slice(html.indexOf('let bankOpenBedoeling ='),html.indexOf('function bankRenderRek(rij)'));
 const opslag=new Map(),verzoeken=[];let antwoord='timeout',volgnummer=0;
 const sessionStorage={getItem:k=>opslag.get(k)||null,setItem:(k,v)=>opslag.set(k,v),removeItem:k=>opslag.delete(k)};
 function laad(){let klik;const nodes={bankOpenCode:{value:'A'},bankOpenSoort:{value:'betaal'},bankRekOpen:{},bankOpenZet:{addEventListener:(_e,fn)=>{klik=fn;}}};
  const ctx={$:s=>nodes[s.slice(1)],sessionStorage,crypto:{randomUUID:()=> 'intent-'+(++volgnummer)},meld(){},bankVervers(){},
    api:async(_p,b)=>{verzoeken.push({...b});if(antwoord!=='succes')throw new Error(antwoord);return{rekening:{iban:'test-iban'}};}};
  vm.runInNewContext(bron+'\nbankRenderRekOpen();',ctx);return{nodes,klik:()=>klik()};}
 const a=laad();await a.klik();a.nodes.bankOpenCode.value='B';antwoord='conflict';await a.klik();
 const b=laad();await b.klik();
 assert.deepEqual(verzoeken.map(x=>x.idem),['intent-1','intent-1','intent-1']);
 antwoord='succes';await b.klik();assert.equal(opslag.size,0);
 b.nodes.bankOpenCode.value='C';await b.klik();assert.equal(verzoeken.at(-1).idem,'intent-2');
});

test('kantoor verifieert echte zaakhouder vóór creatie en vóór replay',async()=>{
 const {bank,rekeningen,zaken}=kern();const b={wie:'kantoor',kantoorActor:'user-1',idem:'houder',codenaam:'zaak:VERZONNEN'};
 assert.equal((await bank.rekeningOpen(b)).status,404);assert.equal(Object.keys(rekeningen).length,0);
 const echt=await bank.rekeningOpen({...b,codenaam:'zaak:maison'});assert.equal(echt.ok,true);
 assert.equal(Object.values(rekeningen)[0].codenaam,'zaak:MAISON');
 zaken.clear();assert.equal((await bank.rekeningOpen({...b,codenaam:'zaak:MAISON'})).status,404);
 assert.equal(Object.keys(rekeningen).length,1);
 // De interne zaakroute heeft haar eigen grens en behoudt haar bestaande contract.
 assert.equal((await bank.rekeningOpen({codenaam:'zaak:INTERN',wie:'zaak'})).ok,true);
});
test('gestructureerde kantoorafdruk heeft geen scheidingstekenbotsing',async()=>{
 const {bank,rekeningen}=kern();const b={wie:'kantoor',kantoorActor:'user-1',idem:'delimiters'};
 const eerste=await bank.rekeningOpen({...b,codenaam:'A|betaal',soort:'spaar',naam:'Z'});assert.equal(eerste.ok,true);
 const tweede=await bank.rekeningOpen({...b,codenaam:'A',soort:'betaal',naam:'spaar|Z'});
 assert.equal(tweede.status,409);assert.equal(Object.keys(rekeningen).length,1);
});

test('kantoorontvangst overleeft de gewone 20000-sleutelring en herstart',async()=>{
 const f=kern(),b={codenaam:'A',wie:'kantoor',kantoorActor:'user-1',idem:'blijft'};
 const eerste=await f.bank.rekeningOpen(b),sleutel='rekopen-kantoor:'+JSON.stringify(['user-1','blijft']);
 // Een eerder uitgegeven beschermde sleutel stond in oudere versies nog in de ring.
 f.db.data.bankIdem._keys=[sleutel];
 for(let i=0;i<20000;i++){const k='oud-'+i;f.db.data.bankIdem._keys.push(k);f.db.data.bankIdem[k]={ok:true};f.db.data.bankIdemAfdruk[k]='x';}
 await f.metIdem('nieuw','x',()=>({ok:true}));
 const retry=await f.bank.rekeningOpen(b);assert.equal(retry.rekening.iban,eerste.rekening.iban);assert.equal(Object.keys(f.rekeningen).length,1);
 assert.equal(f.db.data.bankIdem._keys.includes(sleutel),false);
 const opgeslagen=JSON.parse(JSON.stringify(f.db.data));
 const herstart=require('../server/lib/idem')({d:()=>opgeslagen,save(){},naam:'bankIdem',behoudSleutel:k=>k.startsWith('rekopen-kantoor:'),
  geldigeOntvangst:(k,r)=>!k.startsWith('rekopen-kantoor:')||!!(r&&r.rekening&&typeof r.rekening.iban==='string'&&r.rekening.iban.trim())});
 const replay=await herstart(sleutel,opgeslagen.bankIdemAfdruk[sleutel],()=>assert.fail('geen tweede uitvoering'));
 assert.equal(replay.rekening.iban,eerste.rekening.iban);
 assert.equal((await herstart(sleutel,'andere inhoud',()=>assert.fail('conflict voert niets uit'))).status,409);
 assert.equal(Object.hasOwn(opgeslagen.bankIdem,'oud-0'),false,'gewone retentie blijft begrensd');
});

test('beschermde kantoorontvangst zonder geldig rekeningbewijs faalt gesloten',async()=>{
 const f=kern(),b={codenaam:'A',wie:'kantoor',kantoorActor:'user-1',idem:'corrupt'},sleutel='rekopen-kantoor:'+JSON.stringify(['user-1','corrupt']);
 const eerste=await f.bank.rekeningOpen(b);assert.equal(eerste.ok,true);
 f.db.data.bankIdem[sleutel]={ok:true};
 const retry=await f.bank.rekeningOpen(b);
 assert.equal(retry.status,503);assert.equal(retry.code,'IDEMPOTENTIEBEWIJS_ONGELDIG');
 assert.equal(Object.keys(f.rekeningen).length,1);
});
