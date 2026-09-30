/* Release-testisolatie: gewone tests mogen geen gedeelde CI-database erven.
   Alle verplichte PG-bestanden blijven uitgevoerd via hun eigen database;
   verouderde, onvolledige en vervalste tellingen mogen niet bij de suite optellen. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const { plan, telling }=require('../scripts/lib/suite-pg');
const { TOETSEN, toetslijstSha256 }=require('../scripts/lib/pg-toetslijst');
const bestanden=['auth.test.js',...TOETSEN.map(n=>n.slice(5))];
test('volledige release houdt gewone stores gescheiden en verliest geen PG-bestand',()=>{
 const env={DATABASE_URL:'postgres://example.invalid/test',PG_URL:'postgres://example.invalid/other',REDIS_URL:'redis://example.invalid',RTG_STORE:'postgres',RTG_SECRET_KEY:'synthetic'};
 const p=plan(bestanden,env,true);
 assert.deepEqual(p.bestanden,['auth.test.js']);assert.equal(p.pg.length,TOETSEN.length);
 assert.deepEqual([...p.bestanden,...p.pg].sort(),[...bestanden].sort());
 for(const k of ['DATABASE_URL','PG_URL','REDIS_URL','RTG_STORE'])assert.equal(p.env[k],undefined);
 assert.equal(p.env.RTG_SECRET_KEY,'synthetic');assert.ok(env.DATABASE_URL,'do not mutate the dedicated PG environment');
 assert.throws(()=>plan(bestanden,env,false),/gedeelde DATABASE_URL/);
 assert.throws(()=>plan(bestanden.slice(0,-1),env,true),/mist verplichte/);
});
test('zonder database behoudt de gewone CI-indeling haar volledige inventaris',()=>{
 const p=plan(bestanden,{},false);assert.equal(p.apart,false);assert.deepEqual(p.bestanden,bestanden);
});
test('CI-scherven dragen alle PG-bestanden aantoonbaar over aan de verplichte databasejob',()=>{
 const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
 const env={...process.env,RTG_AFBOUW_SLOT_ACTIEF:'1'};delete env.DATABASE_URL;delete env.PG_URL;
 const pg=TOETSEN.map(n=>n.slice(5)).sort(),lokaal=[];
 for(let nr=1;nr<=4;nr++){
  const child=cp.spawnSync(process.execPath,[path.join(__dirname,'../scripts/test-runner.js'),'--toon','--deel='+nr+'/4'],{encoding:'utf8',env});
  assert.equal(child.status,0,child.stderr);const p=JSON.parse(child.stdout);
  assert.deepEqual(p.postgresUitgesteld.sort(),pg);assert.deepEqual(p.postgres,[]);
  lokaal.push(...p.parallel,...p.geisoleerd);
 }
 const alles=fs.readdirSync(__dirname).filter(n=>n.endsWith('.test.js')).sort();
 assert.equal(new Set(lokaal).size,lokaal.length,'geen bestand dubbel verdeeld');
 assert.deepEqual([...lokaal,...pg].sort(),alles,'geen test verdwijnt tussen beide runners');
 assert.ok(!lokaal.includes('living-world.pg.test.js'));
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/ci.yml'),'utf8');
 assert.match(workflow,/run: node scripts\/pgtoetsen\.js\s+env:\s+REDIS_URL:[^\n]+\s+DATABASE_URL:/);
 assert.match(workflow,/needs: \[preflight, toetsscherf, ijkingen, keuringen, zware\]/);
});
test('de echte suiteplanner geeft elk databasebestand uitsluitend aan de geïsoleerde runner',()=>{
 const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
 const child=cp.spawnSync(process.execPath,[path.join(__dirname,'../scripts/test-runner.js'),'--toon'],
  {encoding:'utf8',env:{...process.env,DATABASE_URL:'postgres://example.invalid/never-connect',RTG_AFBOUW_SLOT_ACTIEF:'1'}});
 assert.equal(child.status,0,child.stderr);const p=JSON.parse(child.stdout);
 const alles=fs.readdirSync(__dirname).filter(n=>n.endsWith('.test.js')).sort();
 assert.deepEqual([...p.parallel,...p.geisoleerd,...p.postgres].sort(),alles);
 assert.deepEqual(p.postgres.sort(),TOETSEN.map(n=>n.slice(5)).sort());
 assert.ok(!p.parallel.some(n=>p.postgres.includes(n)));
});
test('ook het echte browser/release-kindproces erft geen gedeelde store en behoudt zijn exitcode',()=>{
 const cp=require('node:child_process'),path=require('node:path');
 const script=path.join(__dirname,'../scripts/lokale-toetsomgeving.js');
 const child=cp.spawnSync(process.execPath,[script,process.execPath,'-e',
  "const keys=['DATABASE_URL','PG_URL','REDIS_URL','RTG_STORE']; console.log(JSON.stringify(keys.filter(k=>process.env[k]))); process.exit(7)"],
 {encoding:'utf8',env:{...process.env,DATABASE_URL:'must-not-reach-child',PG_URL:'also-not',REDIS_URL:'also-not',RTG_STORE:'postgres'}});
 assert.equal(child.status,7);assert.deepEqual(JSON.parse(child.stdout),[]);
});
function bewijs(){return {formaat:'rtg-pg-bewijs-v1',bron:{commit:'a'.repeat(40),boomVuil:false},toetslijstSha256,geslaagd:true,tapVolledig:true,bestanden:TOETSEN.length,
 tests:TOETSEN.length,geslaagdeTests:TOETSEN.length,mislukt:0,geannuleerd:0,overgeslagen:0,todo:0,
 controles:TOETSEN.map(bestand=>({bestand,tests:1,geslaagd:1,mislukt:0,geannuleerd:0,overgeslagen:0,todo:0}))};}
test('alleen complete echte bestandstellingen mogen bij de volledige suite worden opgeteld',()=>{
 const b=bewijs();assert.equal(telling(b,'a'.repeat(40)).tests,TOETSEN.length);
 for(const verander of [b=>b.bron.commit='b'.repeat(40),b=>b.bron.boomVuil=true,b=>b.overgeslagen=1,b=>b.tests++,b=>b.controles.pop(),b=>b.controles[0]=b.controles[1],b=>b.controles[0].geslaagd=0,b=>b.tapVolledig=false]){
  const slecht=bewijs();verander(slecht);assert.throws(()=>telling(slecht,'a'.repeat(40)));
 }
});
test('de echte CI-verificatiestap weigert vervangen PG-bytes en een verkeerde suitebinding',()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
 const root=path.join(__dirname,'..');
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/release-image.yml'),'utf8');
 assert.match(workflow,/run: node scripts\/ci-pg-bewijs\.js/);
 const script=path.join(root,'scripts/ci-pg-bewijs.js');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-ci-pg-proof-'));
 try {
  fs.mkdirSync(path.join(temp,'.release'));
  const bytes=JSON.stringify(bewijs());const suite={stempel:{commit:'a'.repeat(40),boomVuil:false},
   postgres:{pad:'.release/pg-bewijs.json',sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
  const run=(pg,s,commit='a'.repeat(40))=>{
   fs.writeFileSync(path.join(temp,'.release/pg-bewijs.json'),pg);fs.writeFileSync(path.join(temp,'SUITE.json'),JSON.stringify(s));
   return cp.spawnSync(process.execPath,[script],{cwd:temp,encoding:'utf8',env:{...process.env,GITHUB_SHA:commit}});
  };
  assert.equal(run(bytes,suite).status,0);
  for(const [pg,s] of [[bytes+' ',suite],[bytes,{...suite,stempel:{commit:'b'.repeat(40),boomVuil:false}}],
   [bytes,{...suite,postgres:null}],[JSON.stringify({...bewijs(),tests:999}),suite]]){
   const r=run(pg,s);assert.notEqual(r.status,0);assert.match(r.stderr,/PostgreSQL/);
  }
  for(const commit of ['', 'a'.repeat(7)]){
   const r=run(bytes,suite,commit);assert.notEqual(r.status,0);assert.match(r.stderr,/volledige kandidaatcommit/);
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
