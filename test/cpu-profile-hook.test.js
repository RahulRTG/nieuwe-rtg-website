'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../scripts/cpu-profile-hook.js'), 'utf8');
const beurt = () => new Promise(resolve => setImmediate(resolve));

function proef(env, serialiseer = JSON.stringify, breek = '') {
  const timers = [], bestanden = [], aanroepen = [], fouten = [];
  const lifecycle = { restored: 0, disconnected: 0, posts: [] };
  const tracker = { serialiseerVoorOpslag: serialiseer };
  const sqlite = { saveSqlite(...args) { aanroepen.push({ owner: this, args }); return 'bewaard'; } };
  const modules = {
    'node:fs': { mkdirSync() {}, writeFileSync(p, inhoud) {
      if (breek === 'write') throw Error('schrijffout'); bestanden.push({ p, inhoud });
    } },
    'node:path': path,
    'node:sqlite': {},
    './sqlite-profile-phases': () => ({ restore() { lifecycle.restored++; },
      drain: () => ({ bucketUpperMs: [1], rows: [{ phase: 'exec.commit', count: 2 }] }) }),
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
  assert.equal(p.bestanden.some(f => f.inhoud.includes('geheime payload')), false);
  p.bestanden.length = 0;
  await tick();
  const volgende = JSON.parse(p.bestanden.find(f => f.p.endsWith('.json')).inhoud);
  assert.deepEqual(volgende.serialization, []);
  assert.deepEqual(volgende.storage, []);
  assert.deepEqual(p.fouten, []);
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
