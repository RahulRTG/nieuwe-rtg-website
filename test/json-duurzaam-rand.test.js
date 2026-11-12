'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');

function kind(t, body, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-json-rand-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, NODE_ENV: 'test', RTG_DATA_DIR: dir, RTG_STORE: 'json',
    DATABASE_URL: '', PG_URL: '', REDIS_URL: '', RTG_ENC_KEY: '', RTG_DUURZAAM: '',
    RTG_VERRAAD: '', RTG_SAVE_MS: '250', ...extraEnv };
  const source = `(async()=>{
    const fs=require('node:fs'),p=require('./server/db'),o=require('./server/db/opslag');
    p.db.data={ander:{waarde:1,tekst:'🌍 café'}};o.schrijfLokaleSnapshot();
    const g=require('./server/kern/geldbeleid')(p).geldbeleid;
    const pot=()=>g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));
    ${body}
  })().catch(e=>{console.error(e);process.exitCode=1;});`;
  const r = spawnSync(process.execPath, ['-e', source], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 0, r.stderr); assert.equal(r.signal, null);
  return { dir, out: JSON.parse(r.stdout.trim().split('\n').pop()),
    // Directe bestandslezing: geen backup- of corruptie-naar-leeg-fallback.
    bytes: fs.readFileSync(path.join(dir, 'db.json')) };
}

test('werkelijk korte writes worden tot alle UTF-8-bytes afgemaakt vóór rename', t => {
  const { out, bytes } = kind(t, `
    const open=fs.openSync,write=fs.writeSync,close=fs.closeSync;const doel=new Set();let writes=0;
    fs.openSync=function(f){const fd=open.apply(this,arguments);if(f===o.DB_FILE+'.tmp')doel.add(fd);return fd;};
    fs.closeSync=function(fd){doel.delete(fd);return close.apply(this,arguments);};
    fs.writeSync=function(fd,b,offset=0,length=b.length-offset,position=null){
      if(doel.has(fd)){writes++;return write.call(this,fd,b,offset,Math.min(7,length),position);}
      return write.apply(this,arguments);
    };
    try{console.log(JSON.stringify({r:await pot(),writes}));}
    finally{fs.openSync=open;fs.writeSync=write;fs.closeSync=close;}
  `);
  assert.equal(out.r.ok, true); assert.ok(out.writes > 1);
  const data = JSON.parse(bytes.toString('utf8'));
  assert.equal(data.ander.tekst, '🌍 café'); assert.equal(data.geldbeleid.perLid.lid.potten.length, 1);
});

for (const variant of ['nul', 'na-deel']) test('write zonder voortgang geeft 503 vóór rename: ' + variant, t => {
  const { out, bytes } = kind(t, `
    const open=fs.openSync,write=fs.writeSync,close=fs.closeSync,rename=fs.renameSync;const doel=new Set();let writes=0,renames=0;
    fs.openSync=function(f){const fd=open.apply(this,arguments);if(f===o.DB_FILE+'.tmp')doel.add(fd);return fd;};
    fs.closeSync=function(fd){doel.delete(fd);return close.apply(this,arguments);};
    fs.writeSync=function(fd,b,offset=0,length=b.length-offset,position=null){
      if(doel.has(fd)){writes++;return ${JSON.stringify(variant)}==='na-deel'&&writes===1
        ?write.call(this,fd,b,offset,Math.min(7,length),position):0;}
      return write.apply(this,arguments);
    };
    fs.renameSync=function(van,naar){if(naar===o.DB_FILE)renames++;return rename.apply(this,arguments);};
    try{console.log(JSON.stringify({r:await pot(),writes,renames}));}
    finally{fs.openSync=open;fs.writeSync=write;fs.closeSync=close;fs.renameSync=rename;}
  `);
  assert.equal(out.r.status, 503); assert.equal(out.renames, 0);
  assert.equal(out.writes, variant === 'nul' ? 1 : 2);
  assert.deepEqual(JSON.parse(bytes.toString('utf8')), { ander: { waarde: 1, tekst: '🌍 café' } });
});

for (const variant of ['open', 'fsync']) test('directory-' + variant + '-fout na rename bevestigt niet; retry verdubbelt niet', t => {
  const { out, bytes } = kind(t, `
    const open=fs.openSync,sync=fs.fsyncSync,close=fs.closeSync;const doel=new Set();let geraakt=0;
    fs.openSync=function(f){
      if(f===o.DATA_DIR&&${JSON.stringify(variant)}==='open'){geraakt++;throw new Error('directory-open mislukt');}
      const fd=open.apply(this,arguments);if(f===o.DATA_DIR)doel.add(fd);return fd;
    };
    fs.closeSync=function(fd){doel.delete(fd);return close.apply(this,arguments);};
    fs.fsyncSync=function(fd){if(doel.has(fd)){geraakt++;throw new Error('directory-fsync mislukt');}return sync.apply(this,arguments);};
    let r,zichtbaar;
    try{r=await pot();zichtbaar=JSON.parse(fs.readFileSync(o.DB_FILE,'utf8'));}
    finally{fs.openSync=open;fs.fsyncSync=sync;fs.closeSync=close;}
    console.log(JSON.stringify({r,geraakt,zichtbaar,retry:await pot()}));
  `);
  assert.equal(out.geraakt, 1); assert.equal(out.r.status, 503);
  assert.equal(out.zichtbaar.geldbeleid.perLid.lid.potten.length, 1, 'na rename is rollback niet bewezen');
  assert.equal(out.retry.ok, true);
  const data = JSON.parse(bytes.toString('utf8'));
  assert.equal(data.geldbeleid.perLid.lid.potten.length, 1); assert.equal(data.geldbeleid.perLid.lid.log.length, 1);
});

test('best-effort snapshot blijft werken wanneer alleen directory-fsync niet beschikbaar is', t => {
  const { out, bytes } = kind(t, `
    const open=fs.openSync,sync=fs.fsyncSync,close=fs.closeSync;const doel=new Set();let geraakt=0;
    fs.openSync=function(f){const fd=open.apply(this,arguments);if(f===o.DATA_DIR)doel.add(fd);return fd;};
    fs.closeSync=function(fd){doel.delete(fd);return close.apply(this,arguments);};
    fs.fsyncSync=function(fd){if(doel.has(fd)){geraakt++;throw new Error('directory-fsync niet beschikbaar');}return sync.apply(this,arguments);};
    try{p.db.data.ander.waarde=2;require('./server/db/snapshot').schrijfSnapshotNu();console.log(JSON.stringify({geraakt}));}
    finally{fs.openSync=open;fs.fsyncSync=sync;fs.closeSync=close;}
  `);
  assert.equal(out.geraakt, 1); assert.equal(JSON.parse(bytes.toString('utf8')).ander.waarde, 2);
});

test('bekend verloren JSON-write geeft 503 ondanks het ontbreken van een transactieteller', t => {
  const { out, bytes } = kind(t, `console.log(JSON.stringify({r:await pot(),stand:p.persistentieStand(),
    geraakt:require('./server/lib/verraad').telling()['schrijf-verloren']}));`, { RTG_VERRAAD: 'schrijf-verloren' });
  assert.ok(out.geraakt > 0); assert.equal(out.stand, null); assert.equal(out.r.status, 503);
  assert.deepEqual(JSON.parse(bytes.toString('utf8')), { ander: { waarde: 1, tekst: '🌍 café' } });
});

test('bestandsprimitive bewaart bytes en offsets van alle ArrayBufferViews, ook leeg', t => {
  const { out } = kind(t, `
    const path=require('node:path');const buffer=Buffer.from([0,1,2,3,4,5,6,7,8,9,10,11]);
    const views=[buffer,buffer.subarray(2,10),new Uint8Array(buffer.buffer,buffer.byteOffset+3,5),
      new Uint16Array(new Uint16Array([0,513,1027,1541,2055]).buffer,2,3),
      new Uint32Array([16909060,84281096]),new DataView(buffer.buffer,buffer.byteOffset+2,7),
      new DataView(new ArrayBuffer(0)),Buffer.alloc(0)];
    const results=views.map((view,i)=>{
      const file=path.join(o.DATA_DIR,'raw-'+i);o.schrijfDuurzaam(file,view,0o600,{vereist:true});
      return {actual:fs.readFileSync(file).toString('hex'),
        expected:Buffer.from(view.buffer,view.byteOffset,view.byteLength).toString('hex')};
    });
    let opened=0;const open=fs.openSync;fs.openSync=function(){opened++;return open.apply(this,arguments);};
    let rejected=0;
    try{for(const value of [null,undefined,{},[],1])try{o.schrijfDuurzaam(path.join(o.DATA_DIR,'invalid'),value);}
      catch(e){if(e instanceof TypeError)rejected++;}}
    finally{fs.openSync=open;}
    console.log(JSON.stringify({results,opened,rejected}));
  `);
  assert.equal(out.results.length, 8);
  for (const result of out.results) assert.equal(result.actual, result.expected);
  assert.equal(out.opened, 0); assert.equal(out.rejected, 5);
});

for (const phase of ['tmp-open', 'write', 'file-close', 'directory-close'])
  test('een echte bestandsgrensfout geeft geen succes: ' + phase, t => {
    const { out, bytes } = kind(t, `
      const phase=${JSON.stringify(phase)},open=fs.openSync,write=fs.writeSync,close=fs.closeSync;
      const doelen=new Map();let geraakt=0;
      fs.openSync=function(f){
        if(phase==='tmp-open'&&f===o.DB_FILE+'.tmp'){geraakt++;throw new Error('tmp-open mislukt');}
        const fd=open.apply(this,arguments);if(f===o.DB_FILE+'.tmp'||f===o.DATA_DIR)doelen.set(fd,f);return fd;
      };
      fs.writeSync=function(fd){if(phase==='write'&&doelen.get(fd)===o.DB_FILE+'.tmp'){
        geraakt++;throw new Error('snapshotwrite mislukt');}return write.apply(this,arguments);};
      fs.closeSync=function(fd){const f=doelen.get(fd);doelen.delete(fd);const r=close.apply(this,arguments);
        if((phase==='file-close'&&f===o.DB_FILE+'.tmp')||(phase==='directory-close'&&f===o.DATA_DIR)){
          geraakt++;throw new Error(phase+' mislukt');}return r;};
      try{console.log(JSON.stringify({r:await pot(),geraakt}));}
      finally{fs.openSync=open;fs.writeSync=write;fs.closeSync=close;}
    `);
    assert.equal(out.geraakt, 1); assert.equal(out.r.status, 503);
    const data = JSON.parse(bytes.toString('utf8'));
    if (phase === 'directory-close') assert.equal(data.geldbeleid.perLid.lid.potten.length, 1);
    else assert.deepEqual(data, { ander: { waarde: 1, tekst: '🌍 café' } });
  });

for (const directoryFout of [false, true]) test('SIGKILL en nieuw proces herhalen de zichtbare pot exact eenmaal, directoryfout=' + directoryFout, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-json-kill-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, NODE_ENV: 'test', RTG_DATA_DIR: dir, RTG_STORE: 'json',
    DATABASE_URL: '', PG_URL: '', REDIS_URL: '', RTG_ENC_KEY: '', RTG_DUURZAAM: '', RTG_VERRAAD: '' };
  const setup = `const fs=require('node:fs'),p=require('./server/db'),o=require('./server/db/opslag');p.db.data={};
    const g=require('./server/kern/geldbeleid')(p).geldbeleid;
    const pot=()=>g.vast(()=>g.potZet('lid',{naam:'Reis',doelCenten:1000},'een'));`;
  const first = spawnSync(process.execPath, ['-e', `(async()=>{${setup}
    p.db.data={};o.schrijfLokaleSnapshot();
    let geraakt=0;const open=fs.openSync,sync=fs.fsyncSync,close=fs.closeSync;const doel=new Set();
    fs.openSync=function(f){const fd=open.apply(this,arguments);if(f===o.DATA_DIR)doel.add(fd);return fd;};
    fs.closeSync=function(fd){doel.delete(fd);return close.apply(this,arguments);};
    fs.fsyncSync=function(fd){if(${directoryFout}&&doel.has(fd)){geraakt++;throw new Error('directoryfout vóór kill');}return sync.apply(this,arguments);};
    const r=await pot();fs.openSync=open;fs.fsyncSync=sync;fs.closeSync=close;
    fs.writeSync(1,JSON.stringify({r,geraakt})+'\\n');process.kill(process.pid,'SIGKILL');
  })().catch(e=>{console.error(e);process.exitCode=1;});`], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(first.signal, 'SIGKILL', first.stderr); assert.equal(first.status, null);
  const firstOut = JSON.parse(first.stdout.trim().split('\n').pop());
  assert.equal(firstOut.geraakt, directoryFout ? 1 : 0);
  assert.equal(firstOut.r.status, directoryFout ? 503 : 200);
  // Dit meet een procescrash en zichtbare bytes, geen stroomuitval bij falende directory-fsync.
  const before = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
  assert.equal(before.geldbeleid.perLid.lid.potten.length, 1);
  const second = spawnSync(process.execPath, ['-e', `(async()=>{${setup}
    p.db.data=JSON.parse(fs.readFileSync(o.DB_FILE,'utf8'));console.log(JSON.stringify(await pot()));
  })().catch(e=>{console.error(e);process.exitCode=1;});`], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(second.status, 0, second.stderr); assert.equal(second.signal, null);
  const retry = JSON.parse(second.stdout.trim().split('\n').pop());
  assert.equal(retry.ok, true); assert.equal(retry.herhaald, true);
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
  assert.equal(after.geldbeleid.perLid.lid.log.length, 1); assert.deepEqual(after, before);
});
