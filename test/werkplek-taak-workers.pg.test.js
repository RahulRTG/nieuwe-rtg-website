'use strict';
/* Echte route en PG: concurrentie en SIGKILL vóór/na collectiecommit.
   Geen host-, stroomuitval- of volledige platformclaim. */
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {startServer,stop,stopHard}=require('./helper');
const URL=process.env.DATABASE_URL||process.env.PG_URL;
const skip=require('./infra').vereist('pg',!!URL,'werkplektaak vereist PG');
test('werkplektaak: twee workers, conflict, bewust nieuw en herstart', {skip,timeout:240000},async t=>{
 const iso=await require('./lib/living-world-pg-database')(URL),workers=[];
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-werkplek-workers-'));
 const {Pool}=require('../server/pgwire'),pool=new Pool({connectionString:iso.url,max:1});
 const env={DATABASE_URL:iso.url,PG_URL:'',REDIS_URL:'',RTG_STORE:'postgres',RTG_SIMULATIEBANK:'1',
 RTG_VAULT_KEY:crypto.randomBytes(32).toString('hex'),RTG_SECRET_KEY:crypto.randomBytes(32).toString('hex'),
 RTG_OWNER_EMAIL:'werkplek-owner@fixture.test',DEMO_PASS:'BureauFixtureOnly123!',SMTP_URL:'',STRIPE_SECRET_KEY:'',MOLLIE_API_KEY:'',ADYEN_API_KEY:''};
 async function api(w,p,b={},token=w.token){const r=await fetch(w.base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(b),signal:AbortSignal.timeout(30000)});return{status:r.status,body:await r.json()};}
 async function start(n,fase){const w=await startServer({script:path.join(__dirname,'fixtures/bedoeling-crash-worker.cjs'),env:{...env,RTG_DATA_DIR:path.join(tmp,n),RTG_BEDOELING_MODULE:'werkplek',RTG_BEDOELING_FASE:fase||'',RTG_BEDOELING_MARKER:fase?path.join(tmp,n+'.json'):''}});workers.push(w);return w;}
 async function checkpoint(n){for(let i=0;i<200;i++){const p=path.join(tmp,n+'.json');if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p));await new Promise(r=>setTimeout(r,50));}throw Error('Crashcheckpoint ontbreekt: '+n);}
 async function login(w){const r=await api(w,'auth/login',{login:env.RTG_OWNER_EMAIL,password:env.DEMO_PASS},null);assert.equal(r.status,200,JSON.stringify(r));w.token=r.body.token;const me=await api(w,'auth/me');assert.equal(me.status,200);w.key='user-'+me.body.user.id;}
 async function close(w){if(w.child.exitCode!==null||w.child.signalCode!==null)return;const p=new Promise(r=>w.child.once('exit',r));stop(w);await p;}
 async function taken(){const {rows}=await pool.query("SELECT val FROM kv WHERE key='werkplekTaken' AND NOT weg");return JSON.parse(require('../server/kluis').ontsleutel(rows[0].val));}
 try{
  const a=await start('a'),b=await start('b');await login(a);await login(b);assert.equal(a.key,b.key);
  const pad='werkplek/taak',body={bedrijf:'rtg',tekst:'PG controle',afdeling:'finance',idem:'taak-pg-1'};
  assert.equal((await api(a,pad,{bedrijf:'rtg',tekst:body.tekst})).status,400);
  const uit=await Promise.all([api(a,pad,body),api(b,pad,body)]);
  for(const r of uit)assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(uit[0].body.taak.id,uit[1].body.taak.id);
  let d=await taken();assert.equal(d.rtg.length,1);assert.equal(Object.keys(d._ontvangsten).length,1);
  assert.equal((await api(b,pad,{...body,tekst:'Anders'})).status,409);
  const nieuw=await api(a,pad,{...body,idem:'taak-pg-2'});assert.equal(nieuw.status,200);assert.notEqual(nieuw.body.taak.id,uit[0].body.taak.id);
  assert.equal((await api(a,pad,{...body,bedrijf:'rtf'})).status,409,'een gewijzigd huis is geen retry van dezelfde opdracht');
  const anderhuis=await api(a,pad,{...body,bedrijf:'rtf',idem:'taak-pg-rtf'});assert.equal(anderhuis.status,200);assert.notEqual(anderhuis.body.taak.id,uit[0].body.taak.id);
  await close(a);await close(b);const c=await start('c');await login(c);
  const replay=await api(c,pad,body);assert.equal(replay.status,200,JSON.stringify(replay));assert.equal(replay.body.taak.id,uit[0].body.taak.id);
  const guest=await api(c,'login',{tier:'guest'},null);assert.equal(guest.status,200);
  assert.equal((await api(c,pad,body,guest.body.token)).status,403);
  d=await taken();assert.equal(d.rtg.length,2);assert.equal(d.rtf.length,1);assert.equal(Object.keys(d._ontvangsten).length,3);
  for(const fase of ['voor-commit','na-commit']) await t.test('SIGKILL '+fase+' houdt één opdracht en ontvangst',async()=>{
   const crash=await start(fase,fase);await login(crash);
   const invoer={...body,idem:'crash-'+fase};
   const voor=await taken();
   const pending=api(crash,pad,invoer).catch(e=>({fout:e.name}));
   const punt=await checkpoint(fase);assert.equal(punt.fase,fase);
   await stopHard(crash.child);assert.notEqual((await pending).status,200);
   const na=await taken();
   if(fase==='voor-commit')assert.deepEqual(na,voor,'geen taak/zaak of ontvangst vóór commit');
   else {assert.equal(na.rtg.length,voor.rtg.length+1);assert.ok(na.rtg.some(x=>x.id===punt.id));}
   const hervat=await start('retry-'+fase);await login(hervat);
   const retry=await api(hervat,pad,invoer);assert.equal(retry.status,200,JSON.stringify(retry));
   if(fase==='na-commit')assert.equal(retry.body.taak.id,punt.id,'eerste duurzame identiteit blijft');
   // Demo-workerstart zet via setPasswordZaai ook sessies_vanaf. Geef de
   // bestaande worker na die bootstrap een nieuwe, positief bewezen sessie.
   await login(c);
   const opnieuw=await api(c,pad,invoer);assert.equal(opnieuw.status,200,JSON.stringify(opnieuw));assert.equal(opnieuw.body.taak.id,retry.body.taak.id);
   const eind=await taken();assert.equal(eind.rtg.length,voor.rtg.length+1);
   assert.equal(Object.keys(eind._ontvangsten).length,Object.keys(voor._ontvangsten).length+1);
  });
  await t.test('ingetrokken accountsessie mag ook een bestaande ontvangst niet opvragen',async()=>{
   const ander=await start('intrekking');await login(ander);await login(c);
   const geldig=await api(ander,'auth/me',{},c.token);assert.equal(geldig.status,200,JSON.stringify(geldig));
   const voor=await taken();assert.equal((await api(c,'logout')).status,200);
   const geweigerd=await api(ander,pad,body,c.token);assert.equal(geweigerd.status,403,JSON.stringify(geweigerd));
   assert.deepEqual(await taken(),voor);
  });

 }finally{for(const w of workers)await close(w);await pool.end();await iso.close();fs.rmSync(tmp,{recursive:true,force:true});}
});
