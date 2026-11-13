'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
function kind(t, store, bron, dir) {
  if (!dir) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beleid-vorm-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  }
  const env = { ...process.env, RTG_DATA_DIR: dir, RTG_STORE: store,
    DATABASE_URL: '', PG_URL: '', REDIS_URL: '', RTG_ENC_KEY: '', RTG_DUURZAAM: '', RTG_SAVE_MS: '250' };
  const r = spawnSync(process.execPath, ['-e', bron], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 0, r.stderr); assert.equal(r.signal, null);
  return { dir, uit: JSON.parse(r.stdout.trim().split('\n').pop()) };
}
test('JSON blijft een volledige snapshot: pot en vreemd werk staan vast vóór antwoord en herstart', t => {
  const een = kind(t, 'json', `(async()=>{
    const p=require('./server/db'), o=require('./server/db/opslag');
    p.db.data={ander:{waarde:1}};o.schrijfLokaleSnapshot();p.db.data.ander.waarde=7;
    const g=require('./server/kern/geldbeleid')(p).geldbeleid;
    const r=await g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));
    console.log(JSON.stringify({r,d:o.leesLokaleSnapshot()}));
  })().catch(e=>{console.error(e);process.exitCode=1;});`);
  assert.equal(een.uit.r.ok, true); assert.equal(een.uit.d.ander.waarde, 7);
  assert.equal(een.uit.d.geldbeleid.perLid.lid.potten.length, 1);
  assert.equal(een.uit.d.geldbeleid.perLid.lid.log.length, 1);
  const twee = kind(t, 'json', `(async()=>{
    const p=require('./server/db'),o=require('./server/db/opslag');p.db.data=o.leesLokaleSnapshot();
    const g=require('./server/kern/geldbeleid')(p).geldbeleid;
    const r=await g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));
    console.log(JSON.stringify({r,d:o.leesLokaleSnapshot()}));
  })().catch(e=>{console.error(e);process.exitCode=1;});`, een.dir);
  assert.equal(twee.uit.r.herhaald, true); assert.deepEqual(twee.uit.d, een.uit.d);
});
test('JSON-renamefout geeft 503 en laat de vorige snapshot intact', t => {
  const { uit } = kind(t, 'json', `(async()=>{
    const fs=require('node:fs'),p=require('./server/db'),o=require('./server/db/opslag');
    p.db.data={ander:{waarde:1}};o.schrijfLokaleSnapshot();
    const rename=fs.renameSync;fs.renameSync=function(van,naar){
      if(naar===o.DB_FILE)throw new Error('snapshotrename mislukt');return rename.apply(this,arguments);
    };
    const g=require('./server/kern/geldbeleid')(p).geldbeleid;
    let r;try{r=await g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));}
    finally{fs.renameSync=rename;}
    const d=o.leesLokaleSnapshot();
    const retry=await g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));
    console.log(JSON.stringify({r,d,retry,na:o.leesLokaleSnapshot()}));
  })().catch(e=>{console.error(e);process.exitCode=1;});`);
  assert.equal(uit.r.status, 503); assert.deepEqual(uit.d, { ander: { waarde: 1 } });
  assert.equal(uit.retry.ok, true); assert.equal(uit.na.geldbeleid.perLid.lid.potten.length, 1);
  assert.equal(uit.na.geldbeleid.perLid.lid.log.length, 1);
});
test('PostgreSQL zonder requestcommit weigert vóór de schrijver', t => {
  const { uit } = kind(t, 'postgres', `(async()=>{
    const p=require('./server/db');p.db.data={};let geraakt=0;
    const g=require('./server/kern/geldbeleid')(p).geldbeleid;
    const r=await g.vast(()=>{geraakt++;return g.potZet('lid',{naam:'Reis',doelCenten:1000},'een');});
    console.log(JSON.stringify({r,geraakt,d:p.db.data}));
  })().catch(e=>{console.error(e);process.exitCode=1;});`);
  assert.equal(uit.r.status, 503); assert.equal(uit.r.reden, 'postgres-zonder-verzoekcommit');
  assert.equal(uit.geraakt, 0); assert.deepEqual(uit.d, {});
});

test('strict weigert serialisatiefout en cooldown zonder opnieuw te serialiseren; herstel na afkoelen schrijft', t => {
  const { uit } = kind(t, 'json', `(()=>{
    const p=require('./server/db'),o=require('./server/db/opslag'),s=require('./server/db/snapshot');
    const j=require('./server/lib/rtgjson'),k=require('./server/lib/klok');
    p.db.data={ander:{waarde:1}};o.schrijfLokaleSnapshot();p.db.data.ander.waarde=2;
    let tijd=100000,scans=0;k.nu=()=>tijd;const echt=j.stringify;
    j.stringify=()=>{scans++;throw new RangeError('Invalid string length');};
    const fouten=[];for(let i=0;i<2;i++)try{s.schrijfSnapshotNu({vereist:true});}catch(e){fouten.push(e.message);}
    s.schrijfSnapshotNu();const voor=o.leesLokaleSnapshot();const n=scans;
    tijd+=60001;j.stringify=echt;s.schrijfSnapshotNu({vereist:true});
    console.log(JSON.stringify({fouten,n,voor,na:o.leesLokaleSnapshot()}));
  })();`);
  assert.equal(uit.fouten.length, 2); assert.match(uit.fouten[0], /Invalid string length/);
  assert.match(uit.fouten[1], /niets bevestigd/); assert.equal(uit.n, 1);
  assert.equal(uit.voor.ander.waarde, 1); assert.equal(uit.na.ander.waarde, 2);
});
test('best-effort snapshot en de warmcachefunctie blijven niet-gooiend bij renamefout', t => {
  const { uit } = kind(t, 'json', `(()=>{
    const fs=require('node:fs'),p=require('./server/db'),o=require('./server/db/opslag'),s=require('./server/db/snapshot');
    p.db.data={ander:{waarde:1}};o.schrijfLokaleSnapshot();p.db.data.ander.waarde=2;
    const rename=fs.renameSync;fs.renameSync=function(van,naar){
      if(naar===o.DB_FILE)throw new Error('snapshotrename mislukt');return rename.apply(this,arguments);
    };
    try{s.schrijfSnapshotNu();s.schrijfSnapshotNu({vereist:false});o.schrijfLokaleSnapshotStil();
      console.log(JSON.stringify(o.leesLokaleSnapshot()));
    }finally{fs.renameSync=rename;}
  })();`);
  assert.deepEqual(uit, { ander: { waarde: 1 } });
});

test('fsyncfout op uitsluitend het snapshotbestand geeft geen bevestiging', t => {
  const { uit } = kind(t, 'json', `(async()=>{
    const fs=require('node:fs'),p=require('./server/db'),o=require('./server/db/opslag');
    p.db.data={ander:{waarde:1}};o.schrijfLokaleSnapshot();
    const open=fs.openSync,sync=fs.fsyncSync;let doelFd,geraakt=0;
    fs.openSync=function(f){const fd=open.apply(this,arguments);if(f===o.DB_FILE+'.tmp')doelFd=fd;return fd;};
    fs.fsyncSync=function(fd){if(fd===doelFd){geraakt++;throw new Error('snapshotfsync mislukt');}return sync.apply(this,arguments);};
    try{const g=require('./server/kern/geldbeleid')(p).geldbeleid;
      const r=await g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));
      console.log(JSON.stringify({r,geraakt,d:o.leesLokaleSnapshot()}));
    }finally{fs.openSync=open;fs.fsyncSync=sync;}
  })().catch(e=>{console.error(e);process.exitCode=1;});`);
  assert.equal(uit.geraakt, 1); assert.equal(uit.r.status, 503);
  assert.deepEqual(uit.d, { ander: { waarde: 1 } });
});
test('een mirrorfout na fsync en rename maakt de vastgelegde pot niet tot een schijnmislukking', t => {
  const { uit } = kind(t, 'json', `(async()=>{
    const p=require('./server/db'),o=require('./server/db/opslag'),r=require('./server/db/redis');
    p.db.data={};r.spiegelNaarRedis=()=>{throw new Error('alleen de mirror faalt');};
    const g=require('./server/kern/geldbeleid')(p).geldbeleid;
    const antwoord=await g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));
    console.log(JSON.stringify({antwoord,d:o.leesLokaleSnapshot()}));
  })().catch(e=>{console.error(e);process.exitCode=1;});`);
  assert.equal(uit.antwoord.ok, true); assert.equal(uit.d.geldbeleid.perLid.lid.potten.length, 1);
});
test('foutpad werkt timingmetadata bij voordat write-behind opnieuw plant', t => {
  const { uit } = kind(t, 'json', `(()=>{
    const p=require('./server/db'),s=require('./server/db/snapshot'),j=require('./server/lib/rtgjson'),k=require('./server/lib/klok');
    p.db.data={};let tijd=100000,scans=0,gepland=null;k.nu=()=>tijd;
    j.stringify=()=>{scans++;tijd+=100;throw new Error('gewone serialisatiefout');};
    try{s.schrijfSnapshotNu({vereist:true});}catch(e){}
    global.setTimeout=(fn,ms)=>{gepland=ms;return {unref(){}};};s.planSnapshot();
    console.log(JSON.stringify({scans,gepland}));
  })();`);
  assert.equal(uit.scans, 1); assert.equal(uit.gepland, 400);
});
