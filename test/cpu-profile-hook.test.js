'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../scripts/cpu-profile-hook.js'), 'utf8');
const beurt = () => new Promise(resolve => setImmediate(resolve));

function proef(env, serialiseer = JSON.stringify, breek = '', bewaar = () => 'bewaard') {
  const timers = [], bestanden = [], aanroepen = [], fouten = [];
  const lifecycle = { restored: 0, disconnected: 0, posts: [] };
  const tracker = { serialiseerVoorOpslag: serialiseer };
  const sqlite = { saveSqlite(...args) { aanroepen.push({ owner: this, args }); return bewaar.apply(this,args); } };
  const modules = {
    'node:fs': { mkdirSync() {}, writeFileSync(p, inhoud) {
      if (breek === 'write') throw Error('schrijffout'); bestanden.push({ p, inhoud });
    } },
    'node:path': path,
    'node:sqlite': {},
    './save-profile-correlation': require('../scripts/save-profile-correlation'),
    './sqlite-profile-phases': (sqlite, nu, observeer) => { lifecycle.observeer = observeer; return ({ restore() { lifecycle.restored++; },
      drain: () => ({ bucketUpperMs: [1], rows: [{ phase: 'exec.commit', count: 2 }] }) }); },
    'node:inspector': { Session: class {
      connect() { if (breek === 'connect') throw Error('connectfout'); }
      disconnect() { lifecycle.disconnected++; }
      post(method, callback) {
        lifecycle.posts.push(method);
        callback(breek === method ? Error(method) : null, method === 'Profiler.stop' ? { profile: { nodes: [] } } : {});
      }
    } },
    '../server/db/state': { db: { data: {} } }
  };
  function laad(naam) {
    if (!Object.hasOwn(modules, naam)) throw Error('Onverwachte module: ' + naam);
    return modules[naam];
  }
  laad.resolve = x => x;
  laad.cache = {
    '../server/db/sqlite': { loaded: true, exports: sqlite },
    '../server/db/mutatietracker': { loaded: true, exports: tracker },
    '../server/opzet/handeling': { exports: { huidige: () => ({ methode: 'POST', pad: '/api/proef' }) } }
  };
  let tijd = 0;
  const context = { module: { exports: {} }, require: laad,
    process: { env, pid: 42 }, Buffer, performance: { now: () => ++tijd },
    setInterval(fn, ms) { const timer = { fn, ms, cleared: false, unref() {} }; timers.push(timer); return timer; },
    clearInterval(timer) { timer.cleared = true; },
    console: { error(...args) { fouten.push(args); } } };
  vm.runInNewContext(bron, context, { filename: 'cpu-profile-hook.js' });
  context.module.exports();
  return { timers, bestanden, aanroepen, fouten, tracker, sqlite, lifecycle };
}

test('profiler blijft uit zonder expliciete teststand en uitvoermap', () => {
  for (const env of [{}, { NODE_ENV: 'production', RTG_CPU_PROFILE_DIR: '/proef' }, { NODE_ENV: 'test' }]) {
    const p = proef(env);
    assert.equal(p.timers.length, 0);
    assert.equal(p.bestanden.length, 0);
    assert.equal(p.tracker.serialiseerVoorOpslag, JSON.stringify);
  }
});

test('diagnose per collectie behoudt antwoord, this, argumenten en oorspronkelijke fout', async () => {
  const gezien = [], fout = new Error('oorspronkelijk');
  const p = proef({ NODE_ENV: 'test', RTG_CPU_PROFILE_DIR: '/proef' }, function(...args) {
    gezien.push({ owner: this, args });
    if (args[0] === fout) throw fout;
    return JSON.stringify(args[0]);
  });
  await beurt();
  p.timers.find(t => t.ms === 1000).fn();
  const owner = {}, waarde = { tekst: 'geheime payload' };
  assert.equal(p.tracker.serialiseerVoorOpslag.call(owner, waarde, 'trustEvidence'), JSON.stringify(waarde));
  assert.equal(gezien[0].owner, owner);
  assert.deepEqual(gezien[0].args, [waarde, 'trustEvidence']);
  assert.throws(() => p.tracker.serialiseerVoorOpslag(fout, 'trustEvidence'), e => e === fout);
  assert.equal(p.sqlite.saveSqlite.call(owner, true, ['trustEvidence']), 'bewaard');
  assert.equal(p.aanroepen[0].owner, owner);
  const tick = p.timers.find(t => t.ms === 30000).fn;
  await tick();
  const meta = JSON.parse(p.bestanden.find(f => f.p.endsWith('.json')).inhoud);
  assert.equal(meta.diagnosticOnly, true);
  assert.deepEqual(meta.sqlitePhases, { bucketUpperMs: [1], rows: [{ phase: 'exec.commit', count: 2 }] });
  assert.deepEqual(meta.serialization, [{ collection: 'trustEvidence', count: 2, ms: 2, maxMs: 1,
    chars: JSON.stringify(waarde).length }]);
  assert.equal(meta.storage[0].count, 1);
  assert.equal(meta.saveCorrelation.coverage, 'exported-saveSqlite-only');
  assert.equal(meta.saveCorrelation.unattributed.serialization.count, 2);
  assert.equal(meta.profilerMaintenance.previous, null);
  assert.equal(p.bestanden.some(f => f.inhoud.includes('geheime payload')), false);
  p.bestanden.length = 0;
  await tick();
  const volgende = JSON.parse(p.bestanden.find(f => f.p.endsWith('.json')).inhoud);
  assert.deepEqual(volgende.serialization, []);
  assert.deepEqual(volgende.storage, []);
  assert.equal(volgende.profilerMaintenance.previous.metadataBytes, Buffer.byteLength(JSON.stringify(meta)));
  assert.ok(volgende.profilerMaintenance.previous.metadataWriteMs > 0);
  assert.ok(volgende.profilerMaintenance.previous.endedAtMs > volgende.profilerMaintenance.previous.startedAtMs);
  assert.deepEqual(p.fouten, []);
});

test('afzonderlijke saves koppelen native en serializerkosten en behouden hun oorspronkelijke fout', async () => {
  const fout=Error('geheime fout'), owner={}, antwoord={zelfde:true}; let p;
  p=proef({NODE_ENV:'test',RTG_CPU_PROFILE_DIR:'/proef'},JSON.stringify,'',function(force,keys) {
    assert.equal(this,owner);
    p.tracker.serialiseerVoorOpslag({inhoud:'geheime payload'},'sessions');
    p.lifecycle.observeer('exec.commit',1,7,true,0);
    if(keys) throw fout;
    return antwoord;
  });
  await beurt();p.timers.find(t=>t.ms===1000).fn();
  assert.equal(p.sqlite.saveSqlite.call(owner,true,undefined,[],true),antwoord);
  assert.throws(()=>p.sqlite.saveSqlite.call(owner,false,['sessions']),e=>e===fout);
  p.lifecycle.observeer('checkpoint.FULL',1,4,true,0);
  await p.timers.find(t=>t.ms===30000).fn();
  const meta=JSON.parse(p.bestanden.find(f=>f.p.endsWith('.json')).inhoud), c=meta.saveCorrelation;
  assert.equal(c.observedCalls,2);assert.equal(c.failedCalls,1);assert.equal(c.slowest.length,2);
  for(const r of c.slowest) {
    assert.equal(r.serialization.count,1);assert.equal(r.serialization.slowest[0].collection,'sessions');
    assert.deepEqual(r.native,[{phase:'exec.commit',count:1,ms:7,maxMs:7,failures:0,storedChars:0}]);
  }
  assert.equal(c.slowest.find(r=>r.scope==='unscoped').durable,true);
  assert.equal(meta.storageFullMeans,'unscoped-call-not-full-plan');
  assert.equal(c.slowest.find(r=>r.scope==='scoped').failed,true);
  assert.equal(c.unattributed.native[0].phase,'checkpoint.FULL');
  assert.equal(JSON.stringify(meta).includes('geheime'),false);
});

test('correlatie bewaart nesting, onderhoud en begrensde labels zonder payloads',()=>{
  let tijd=0;const c=require('../scripts/save-profile-correlation')(()=>++tijd);
  const buiten=c.begin('POST /proef',[true]), binnen=c.begin('POST /binnen',[false,['sessions']]);
  c.serialization('sessions',3,10,false);c.native('exec.commit',1,2,true,0);c.end(binnen,false);
  c.serialization('trustEvidence',5,20,true);c.end(buiten,true);
  c.maintenance(true);const onderhoud=c.begin('achtergrond',[]);c.end(onderhoud,false);
  c.native('exec.commit',1,1,true,0);c.serialization('sessions',1,1,false);c.maintenance(false);
  let uit=c.drain();assert.equal(uit.nestedCalls,1);assert.equal(uit.failedCalls,1);assert.equal(uit.activeFrames,0);
  const a=uit.slowest.find(r=>r.route==='POST /proef'),b=uit.slowest.find(r=>r.route==='POST /binnen');
  assert.equal(b.parentId,a.id);assert.equal(a.nestedSaveMs,b.elapsedMs);
  assert.equal(a.serialization.count,1);assert.equal(b.serialization.count,1);
  assert.equal(uit.slowest.find(r=>r.route==='achtergrond').activity,'profiler-maintenance');
  assert.equal(uit.unattributedMaintenance.native[0].count,1);
  assert.equal(uit.unattributedMaintenance.serialization.count,1);
  assert.equal(uit.unattributed.native.length,0);
  for(let i=0;i<100;i++) {
    const frame=c.begin('/proef',[]);
    for(let j=0;j<12;j++) c.serialization('geheime-naam-'+j,j,10,false);
    c.end(frame,false);
  }
  c.native('geheime-SQL',99,1,false,0);c.serialization('sessions',2,3,false);c.error();
  uit=c.drain();assert.equal(uit.slowest.length,32);assert.equal(uit.observedCalls,100);
  assert.equal(uit.instrumentationErrors,1);assert.equal(uit.unattributed.native[0].phase,'other');
  assert.ok(uit.slowest.every(r=>r.serialization.slowest.length===8));
  assert.equal(JSON.stringify(uit).includes('geheime'),false);
  assert.deepEqual(c.drain().slowest,[]);
  const frames=Array.from({length:66},()=>c.begin('/nest',[]));
  c.native('exec.commit',1,1,true,0);for(const frame of frames.reverse()) c.end(frame,false);
  uit=c.drain();assert.equal(uit.overflow,2);assert.equal(uit.activeFrames,0);
  assert.equal(uit.unattributed.native[0].count,1);
});

test('collectienamen blijven begrensd; onbekende namen krijgen een restcategorie', async () => {
  const p = proef({ NODE_ENV: 'test', RTG_CPU_PROFILE_DIR: '/proef' });
  await beurt(); p.timers.find(t => t.ms === 1000).fn();
  for (let i = 0; i < 5002; i++) p.tracker.serialiseerVoorOpslag(null, 'collectie-' + i);
  p.tracker.serialiseerVoorOpslag(null);
  await p.timers.find(t => t.ms === 30000).fn();
  const meta = JSON.parse(p.bestanden.find(f => f.p.endsWith('.json')).inhoud);
  assert.equal(meta.serialization.length, 30);
  assert.equal(meta.serialization.find(r => r.collection === 'overig').count, 3);
});

test('inspector- en schrijffouten stoppen alle hooks zonder de applicatie te stoppen', async () => {
  for (const breek of ['connect', 'Profiler.enable', 'Profiler.start', 'Profiler.stop', 'write']) {
    const p = proef({ NODE_ENV: 'test', RTG_CPU_PROFILE_DIR: '/proef' }, JSON.stringify, breek);
    const save = p.sqlite.saveSqlite;
    // Monteer ook vóór de asynchrone enable/start-afwijzing.
    p.timers.find(t => t.ms === 1000).fn();
    await beurt();
    const timer = p.timers.find(t => t.ms === 30000);
    if (timer) await timer.fn();
    assert.equal(p.lifecycle.restored, 1, breek);
    assert.equal(p.lifecycle.disconnected, 1, breek);
    assert.equal(p.timers.every(t => t.cleared), true, breek);
    assert.equal(p.sqlite.saveSqlite, save, breek);
    assert.equal(p.tracker.serialiseerVoorOpslag, JSON.stringify, breek);
    assert.equal(p.fouten.length, 1, breek);
    const posts = p.lifecycle.posts.length;
    for (const t of p.timers) await t.fn();
    assert.equal(p.lifecycle.posts.length, posts, 'een oude callback herstart niets');
    assert.equal(p.lifecycle.restored, 1);
  }
});
