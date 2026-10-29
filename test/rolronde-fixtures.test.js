/* Lifestyle blijft een werkelijk toegekende pas, geen bredere statuscode-regel.
   Deze tegenproeven bewaken dezelfde input, twee geldige accounts en fail-closed herstel. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {past,oordeel,maakFixtures,ROUTES}=require('../scripts/lib/rolronde-fixtures');
function bewijs(){return {methode:'POST',pad:ROUTES[0],premium:{voor:{status:200,id:1,tier:'lifestyle'},na:{status:200,id:1,tier:'lifestyle'},status:200},rtg:{voor:{status:200,id:2,tier:'rtg'},na:{status:200,id:2,tier:'rtg'},status:403}};}
test('alleen 23 exacte bestaande POST-ingangen krijgen de premiumfixture',()=>{
 assert.equal(ROUTES.length,23);assert.equal(new Set(ROUTES).size,23);
 for(const pad of ROUTES){assert.ok(past('POST',pad));assert.equal(past('GET',pad),false);assert.equal(past('POST',pad+'/onbekend'),false);}
 assert.equal(past('POST','/api/member/bureau/zaak'),false);
 assert.equal(oordeel(bewijs()).stand,'bewezen');
});
test('beide accounts moeten dezelfde identiteit, juiste pas en2xx vóór/na behouden',()=>{
 for(const who of ['premium','rtg'])for(const side of ['voor','na'])for(const change of [x=>x.status=401,x=>x.id=null,x=>x.tier='business']){
  const p=bewijs();change(p[who][side]);assert.equal(oordeel(p).stand,'open');
 }
 const p=bewijs();p.rtg.voor.id=1;p.rtg.na.id=1;assert.equal(oordeel(p).stand,'open');
});
test('ontbrekende positieve controle en503 zijn onbekend; RTG2xx is een gat',()=>{
 for(const status of [0,302,400,401,403,404,409,428,500,503]){const p=bewijs();p.premium.status=status;assert.equal(oordeel(p).stand,'open');}
 for(const status of [0,302,400,404,409,428,500,503]){const p=bewijs();p.rtg.status=status;assert.equal(oordeel(p).stand,'open');}
 const p=bewijs();p.rtg.status=200;assert.equal(oordeel(p).stand,'gat');
});
test('aanvraagfixture bouwt eenmaal, geeft exact hetzelfde lijf aan beide pascontroles',async()=>{
 let builds=0;const calls=[],lijf={zicht:'mijn'};
 const vraag=async(m,p,t,b)=>{calls.push({m,p,t,b});return p==='/api/auth/me'?{status:200,data:{user:{id:t==='premium'?1:2,tier:t==='premium'?'lifestyle':'rtg'}}}:{status:t==='premium'?200:403,data:{}};};
 const f=maakFixtures({vraag,bouw:async()=>{builds++;return{token:'premium'};}});
 assert.equal((await f.meet('POST',ROUTES[0],'rtg',lijf)).oordeel.stand,'bewezen');
 await f.meet('POST',ROUTES[1],'rtg',lijf);assert.equal(builds,1);
 assert.ok(calls.filter(c=>c.p!=='/api/auth/me').every(c=>c.b===lijf));
});
test('ontbrekend eigenaarakkoord blijft open en verzint geen premiumtoken',async()=>{
 const f=maakFixtures({vraag:async()=>{throw new Error('mag niet worden benaderd');},bouw:async()=>{throw new Error('geen akkoord');}});
 const r=await f.meet('POST',ROUTES[0],'rtg');assert.equal(r.oordeel.stand,'open');assert.match(r.oordeel.reden,/geen akkoord/);
});
test('verlopen premiumsessie herstelt uitsluitend via bestaande accountlogin',async()=>{
 let login=0;const f=maakFixtures({bouw:async()=>({token:'oud',email:'synthetisch'}),login:async lid=>{assert.equal(lid.token,'oud');login++;return 'vers';},
 vraag:async(m,p,t)=>p==='/api/auth/me'?t==='oud'?{status:401}:{status:200,data:{user:{id:t==='vers'?1:2,tier:t==='vers'?'lifestyle':'rtg'}}}:{status:t==='vers'?200:403}});
 assert.equal((await f.meet('POST',ROUTES[0],'rtg')).oordeel.stand,'bewezen');assert.equal(login,1);
});

test('echte eigenaar kent Lifestyle toe; 23 leesingangen behouden RTG- en rolgrenzen', {timeout:120000}, async t=>{
 const {maakWereld,nieuwLid,KANTOORWERELD}=require('../scripts/lib/voltooiwereld');
 const {meetRol,beoordeelRoute}=require('../scripts/rolronde');
 const w=await maakWereld('rolronde-lifestyle',KANTOORWERELD);t.after(()=>w.klaar());
 const rtg=await nieuwLid(w,'rolrtg');
 const supplier=(await w.post('/api/supplier/login',{username:'rahul',password:'Imran'})).data.token;
 const office=(await w.post('/api/office/login',{code:KANTOORWERELD.OFFICE_CODE})).data.token;
 assert.ok(supplier);assert.ok(office);
 const vraag=(m,p,token,lijf)=>w.post(p,lijf||{},token,undefined,m);
 const f=maakFixtures({vraag});
 for(const pad of ROUTES){
  const lijf={},e=await f.meet('POST',pad,rtg.token,lijf);assert.equal(e.oordeel.stand,'bewezen',pad+JSON.stringify(e));
  const anon=await vraag('POST',pad,null,lijf),antwoorden={},controles={};
  for(const [rol,token] of [['leverancier',supplier],['kantoor',office]]){
   const x=await meetRol(vraag,rol,token,'POST',pad,lijf);antwoorden[rol]=x.antwoord;controles[rol]=x;
  }
  assert.equal(beoordeelRoute('POST '+pad,anon,e.eigen,antwoorden,controles).bewezen,true,pad);
 }
});

test('rolmeter bindt een echt toestel per sessie zonder de bezitsbewijsgrens te verlagen', {timeout:120000}, async t=>{
 const {maakWereld,nieuwLid}=require('../scripts/lib/voltooiwereld');
 const {maakVraag}=require('../scripts/rolronde');
 const w=await maakWereld('rolronde-toestel',{RTG_BEZITSBEWIJS:'verplicht'});t.after(()=>w.klaar());
 const a=await nieuwLid(w,'toestel-a'),b=await nieuwLid(w,'toestel-b');
 const vraag=maakVraag(w.basis);
 const pad='/api/privacy/inzage';
 assert.equal((await vraag('POST',pad,a.token,{})).status,403);
 await vraag.bindToestel(a.token);
 for(let i=0;i<2;i++)assert.equal((await vraag('POST',pad,a.token,{})).status,200,'ieder verzoek heeft nieuw geldig bewijs');
 assert.equal((await vraag('POST',pad,b.token,{})).status,403,'geen toestelbewijs van A naar B');
 assert.equal((await w.post(pad,{},a.token)).status,401,'token zonder handtekening blijft geweigerd');
 await vraag.bindToestel(b.token);
 assert.equal((await vraag('POST',pad,b.token,{})).status,200);
 assert.equal((await vraag('POST',pad,null,{})).status,401,'anoniem blijft anoniem');
});
