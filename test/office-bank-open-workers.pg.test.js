'use strict';
/* Werkelijke office-route en twee serverprocessen; synthetische rekeningen.
   Bewijst PG-account/sleutelcommit, herstart en procesuitval rond COMMIT. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {startServer,stop,stopHard,wachtOpWaarde}=require('./helper');
const URL=process.env.DATABASE_URL||process.env.PG_URL;
const skip=require('./infra').vereist('pg',!!URL,'office bank vraagt echte PG');
async function sluit(w){if(!w||w.child.exitCode!==null||w.child.signalCode!==null)return;const p=new Promise(r=>w.child.once('exit',r));stop(w);await p;}
test('office bank: dezelfde bedoeling over twee workers en na procesverlies', {skip,timeout:180000},async t=>{
 const iso=await require('./lib/living-world-pg-database')(URL),workers=[];
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-bank-workers-'));
 const {Pool}=require('../server/pgwire');const pool=new Pool({connectionString:iso.url,max:1});
 const kluis=require('../server/kluis');
 // Eén installatie deelt identiteitskluis en tokenondertekening, ook wanneer
 // workers aparte lokale spiegels hebben. Per proef nieuwe synthetische keys.
 const env={DATABASE_URL:iso.url,PG_URL:'',REDIS_URL:'',RTG_STORE:'postgres',RTG_SIMULATIEBANK:'1',
  RTG_VAULT_KEY:require('node:crypto').randomBytes(32).toString('hex'),
  RTG_SECRET_KEY:require('node:crypto').randomBytes(32).toString('hex'),
  RTG_OWNER_BOOTSTRAP:'office-bank-workers-fixture',RTG_OWNER_EMAIL:'bank-owner@fixture.test',DEMO_PASS:'BankFixtureOnly123!',
  STRIPE_SECRET_KEY:'',MOLLIE_API_KEY:'',ADYEN_API_KEY:'',SMTP_URL:''};
 async function api(w,p,b={},token=w.token){const r=await fetch(w.base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(b),signal:AbortSignal.timeout(30000)});return{status:r.status,body:await r.json()};}
 async function login(w){
  const r=await api(w,'auth/login',{login:env.RTG_OWNER_EMAIL,password:env.DEMO_PASS},null);assert.equal(r.status,200,JSON.stringify(r));w.token=r.body.token;
  const me=await api(w,'auth/me');assert.equal(me.status,200,JSON.stringify(me));return me.body.user;
 }
 async function start(n,fase){const w=await startServer({script:path.join(__dirname,'fixtures/bank-open-crash-worker.cjs'),env:{...env,RTG_DATA_DIR:path.join(tmp,n),RTG_BANK_CRASH_FASE:fase||'',RTG_BANK_CRASH_MARKER:path.join(tmp,n+'.json')}});workers.push(w);return w;}
 async function checkpoint(n){
  const p=path.join(tmp,n+'.json');
  return wachtOpWaarde(()=>fs.existsSync(p)&&JSON.parse(fs.readFileSync(p,'utf8')),
   {ms:10000,wat:'duurzaam crashcheckpoint '+n});
 }
 async function opgeslagen(){const {rows}=await pool.query("SELECT key,val FROM kv WHERE key IN ('bankRekeningen','bankIdem','bankIdemAfdruk') AND NOT weg");return Object.fromEntries(rows.map(r=>[r.key,JSON.parse(kluis.ontsleutel(r.val))]));}
 try{
  const a=await start('a'),b=await start('b');assert.notEqual(a.child.pid,b.child.pid);
  // Beide bootstraps zijn afgerond vóór de afzonderlijke lokale sessies.
  const actorA=await login(a),actorB=await login(b);
  assert.ok(actorA.id && actorB.id,'beide accounts hebben een identiteit');
  assert.equal(actorA.id,actorB.id,'dezelfde kantooractor in afzonderlijke sessies');
  assert.notEqual(a.token,b.token);
  for(const w of [a,b]) {const r=await api(w,'office/bank',{});assert.equal(r.status,200,'lege bank leest zonder onopgeslagen initialisatie: '+JSON.stringify(r));}
  for(const w of [a,b]) {const r=await api(w,'office/bank/rekening/open',{codenaam:'zaak:MAISON'});assert.equal(r.status,400,'kluisAuth passeert en weigert ontbrekende bedoeling: '+JSON.stringify(r));assert.match(r.body.error,/sleutel/i);}
  const body={codenaam:'zaak:MAISON',soort:'zakelijk',naamRek:'Workerproef',idem:'office-worker-open-1'};
  const pad='office/bank/rekening/open';
  assert.equal((await api(a,pad,{...body,idem:undefined})).status,400);
  const beide=await Promise.all([api(a,pad,body),api(b,pad,body)]);
  assert.ok(beide.some(x=>x.status===200),JSON.stringify(beide));
  assert.ok(beide.every(x=>[200,409,503].includes(x.status)),JSON.stringify(beide));
  const eerste=beide.find(x=>x.status===200).body.rekening.iban;
  for(const w of [a,b]) {const r=await api(w,pad,body);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.rekening.iban,eerste);}
  const voor=await opgeslagen();
  assert.equal(Object.values(voor.bankRekeningen||{}).filter(x=>x.codenaam===body.codenaam&&x.naam==='Workerproef').length,1);
  assert.equal(Object.keys(voor.bankIdem||{}).filter(x=>x.startsWith('rekopen-kantoor:')).length,1);
  await sluit(a);await sluit(b);
  const c=await start('c');await login(c);const herhaal=await api(c,pad,body);
  assert.equal(herhaal.status,200,JSON.stringify(herhaal));assert.equal(herhaal.body.rekening.iban,eerste);
  for(const anders of [{codenaam:'zaak:KIKUNOI'},{soort:'spaar'},{naamRek:'Veranderd'}])
    assert.equal((await api(c,pad,{...body,...anders})).status,409);
  assert.deepEqual(await opgeslagen(),voor,'herstart/retries/conflicten maken geen tweede rekening of sleutel');
  const guest=(await api(c,'login',{tier:'guest'},null)).body.token;
  assert.ok(guest);assert.equal((await api(c,pad,body,guest)).status,401,'gast heeft geen backoffice-sessie; een serverfout bewijst geen afscherming');
  assert.deepEqual(await opgeslagen(),voor);
  for(const fase of ['voor-commit','na-commit'])await t.test('SIGKILL '+fase+' bewaart rekening en sleutel samen',async()=>{
   const crash=await start(fase,fase);await login(crash);
   const invoer={...body,naamRek:'Crash '+fase,idem:'bank-crash-'+fase};
   const begin=await opgeslagen();
   const sleutel='rekopen-kantoor:'+JSON.stringify(['user-'+actorA.id,invoer.idem]);
   const afdruk=JSON.stringify(['rekopen-kantoor',invoer.codenaam,invoer.soort,invoer.naamRek]);
   const pending=api(crash,pad,invoer).catch(e=>({fout:e.name}));
   assert.equal((await checkpoint(fase)).fase,fase);
   await stopHard(crash.child);assert.notEqual((await pending).status,200);
   const na=await opgeslagen();
   const matches=data=>Object.values(data.bankRekeningen||{}).filter(x=>x.codenaam===invoer.codenaam&&x.naam===invoer.naamRek);
   if(fase==='voor-commit')assert.deepEqual(na,begin,'geen gedeeltelijk opgeslagen rekening of ontvangst');
   else {
    assert.equal(matches(na).length,1,'rekening duurzaam vóór verloren antwoord');
    assert.ok(na.bankIdem[sleutel]?.rekening,'ontvangst duurzaam vóór retry');
    assert.equal(na.bankIdemAfdruk[sleutel],afdruk,'inhoudsafdruk duurzaam vóór retry');
    assert.equal(na.bankIdem[sleutel].rekening.iban,matches(na)[0].iban);
    assert.equal(na.bankIdem[sleutel].rekening.geopend,matches(na)[0].geopend);
   }
   const hervat=await start('retry-'+fase);await login(hervat);await login(c);
   const retry=await api(hervat,pad,invoer);assert.equal(retry.status,200,JSON.stringify(retry));
   if(fase==='na-commit')assert.deepEqual(retry.body.rekening,na.bankIdem[sleutel].rekening,'eerste ontvangst blijft volledig gelijk');
   const opnieuw=await api(c,pad,invoer);assert.equal(opnieuw.status,200,JSON.stringify(opnieuw));
   assert.deepEqual(opnieuw.body.rekening,retry.body.rekening);
   const eind=await opgeslagen();assert.equal(matches(eind).length,1);
   assert.deepEqual(eind.bankIdem[sleutel].rekening,retry.body.rekening);
   assert.equal(eind.bankIdemAfdruk[sleutel],afdruk);
   assert.equal(matches(eind)[0].geopend,retry.body.rekening.geopend);
   assert.equal(Object.keys(eind.bankIdem).length,Object.keys(begin.bankIdem).length+1);
   assert.equal(Object.keys(eind.bankIdemAfdruk).length,Object.keys(begin.bankIdemAfdruk).length+1);
  });
 }finally{for(const w of workers)await sluit(w);await pool.end();await iso.close();fs.rmSync(tmp,{recursive:true,force:true});}
});
