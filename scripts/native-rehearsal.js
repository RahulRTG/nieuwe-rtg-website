#!/usr/bin/env node
'use strict';
// Start uitsluitend de meegeleverde runtime en app in een tijdelijke omgeving.
// Deze proef bewijst geen providers, echte gebruikers of productieconfiguratie.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { setTimeout:pause } = require('node:timers/promises');
const native = require('./lib/native-artifact');

const { freePort, stop } = require('./lib/native-process');

async function rehearse(file, commit, output, previousFile) {
  const p = native.inspect(file);
  assert.equal(p.manifest.commit, commit, 'artifact hoort bij de kandidaat');
  assert.equal(process.platform, p.manifest.platform); assert.equal(process.arch, p.manifest.arch);
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-native-rehearsal-')));
  const candidateRelease = path.join(temporary, 'release'), data = path.join(temporary, 'data');
  let release = candidateRelease, activeManifest = p.manifest, previous;
  fs.mkdirSync(release); fs.mkdirSync(data);
  native.inspect(file, release); native.verifyInstalled(release, p.manifest);
  if (previousFile) {
    previous = native.inspect(previousFile);
    assert.notEqual(previous.archiveSha256, p.archiveSha256, 'een andere artifact is vereist voor rollback');
    release = path.join(temporary, 'previous'); fs.mkdirSync(release);
    native.inspect(previousFile, release); activeManifest = previous.manifest;
  }
  const evidence = { schema:'rtg-native-rehearsal-v1', commit, archiveSha256:p.archiveSha256,
    manifestSha256:p.manifestSha256, startedAt:new Date().toISOString(),
    environment:'ISOLATED_NONPRODUCTION_SQLITE', device:'LOCAL_NATIVE_PROCESS',
    scope:'Exact package process, API, durable document state and restart; not full release, production configuration, provider or previous-artifact rollback proof.',
    steps:[], requests:[], databaseAssertions:[], status:'FAIL', rollback:'NOT_PROVEN' };
  if (previous) Object.assign(evidence, { schema:'rtg-native-rollback-v1', previousSha256:previous.archiveSha256,
    previousCommit:previous.manifest.commit, previousKnownGood:false, dataPreserved:false,
    scope:'Isolated two-artifact rollback mechanism. Previous production baseline qualification requires independent evidence; never inferred from this rehearsal.' });
  let child, base, token;
  const env = { PATH:path.join(release, 'runtime') + ':/usr/bin:/bin', HOME:temporary, TMPDIR:temporary,
    NODE_ENV:'test', RTG_DATA_DIR:data, RTG_STORE:'sqlite', RTG_MAGNAAT_TEST:'0', RTG_DEMO:'0',
    RTG_BIND:'127.0.0.1', RTG_AI_UIT:'1', RTG_EXTERNE_AI_UIT:'1', STUN_UIT:'1',
    RTG_VAULT_KEY:crypto.randomBytes(32).toString('hex'), RTG_SECRET_KEY:crypto.randomBytes(32).toString('hex') };
  const request = async (url, body, expected = 200, auth = token) => {
    const method = body === undefined ? 'GET' : 'POST';
    const r = await fetch(base + url, { method, signal:AbortSignal.timeout(10000), headers:{
      'Content-Type':'application/json', ...(auth ? { Authorization:'Bearer ' + auth } : {}),
      ...(body && body.operationId ? { 'Idempotency-Key':body.operationId } : {})
    }, ...(body === undefined ? {} : { body:JSON.stringify(body) }) });
    evidence.requests.push({ at:new Date().toISOString(), method, path:url, status:r.status });
    assert.equal(r.status, expected, method + ' ' + url);
    return r.json();
  };
  const start = async () => {
    const port = await freePort(); base = 'http://127.0.0.1:' + port;
    child = cp.spawn(path.join(release, 'runtime/node'), ['server/server.js'], {
      cwd:path.join(release, 'app'), env:{ ...env, PORT:String(port) }, stdio:['ignore','pipe','pipe']
    });
    let startupError, log = '';
    child.on('error', e => { startupError = e; });
    const capture = b => { log = (log + b.toString()).slice(-12000); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    const until = Date.now() + 90000;
    while (Date.now() < until) {
      if (startupError) throw startupError;
      if (child.exitCode !== null || child.signalCode) throw Error('Native proefserver stopte tijdens opstarten.');
      try {
        const h = await fetch(base + '/api/health', { signal:AbortSignal.timeout(2000) }).then(r => r.json());
        if (h.ok && h.pid === child.pid) {
          const ready = await request('/api/ready'); assert.equal(ready.ready, true);
          assert.equal(ready.store, 'sqlite');
          evidence.steps.push({ name:'health/readiness', pid:child.pid, status:'PASS', logSha256:native.digest(log) });
          return;
        }
      } catch (e) { if (e.code === 'ERR_ASSERTION') throw e; }
      await pause(100);
    }
    throw Error('Native proefserver werd niet gereed binnen 90 seconden.');
  };
  const state = async id => (await request('/api/bestanden/mijn', {})).items.find(x => x.id === id);
  const database = (id, trashed) => {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(data, 'store.db'), { readOnly:true });
    try {
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      const row = db.prepare('SELECT val FROM kv WHERE key = ?').get('bestanden');
      assert.ok(row, 'documentcollectie bestaat duurzaam');
      const collection = JSON.parse(row.val);
      const documents = Object.values(collection).flatMap(board => board.items || []);
      const document = documents.find(x => x.id === id);
      assert.ok(document, 'document bestaat in SQLite'); assert.equal(!!document.weg, trashed);
      evidence.databaseAssertions.push({ name:'document lifecycle + integrity_check', id, trashed, status:'PASS' });
    } finally { db.close(); }
  };
  try {
    await start();
    const account = { name:'Native proof', email:'native-proof@example.test', phone:'0612345678',
      password:crypto.randomBytes(24).toString('hex'), geboortedatum:'1990-01-01', tier:'rtg' };
    const registered = await request('/api/auth/register', account); assert.ok(registered.token); token = registered.token;
    const f = await request('/api/bestanden/upload', { naam:'native-proof.txt', dataUrl:'data:text/plain;base64,bmF0aXZlLXByb29m' });
    const before = await state(f.id); assert.ok(before);
    if (previous) {
      await stop(child); child = null; database(f.id, false); native.verifyInstalled(release, activeManifest);
      evidence.steps.push({ name:'previous-baseline', status:'PASS' });
      release = candidateRelease; activeManifest = p.manifest; await start();
      const login = await request('/api/auth/login', { email:account.email, password:account.password });
      assert.ok(login.token); token = login.token;
      assert.equal((await state(f.id)).weg, false);
    }
    const action = { capability:'documents.trash', contractVersion:1, operationId:crypto.randomUUID(), id:f.id, expectedVersion:before.documentVersion };
    const trash = await request('/api/bestanden/actie', action); assert.equal(trash.resource.state, 'trashed');
    const retry = await request('/api/bestanden/actie', action); assert.equal(retry.herhaald, true);
    await request('/api/bestanden/mijn', {}, 401, null);
    evidence.steps.push({ name:'registration, document mutation, retry, unauthenticated denial', status:'PASS' });
    await stop(child); child = null; database(f.id, true);
    native.verifyInstalled(release, activeManifest);
    if (previous) {
      evidence.steps.push({ name:'candidate-mutation', status:'PASS' });
      release = path.join(temporary, 'previous'); activeManifest = previous.manifest;
    }
    await start();
    const login = await request('/api/auth/login', { email:account.email, password:account.password });
    assert.ok(login.token); token = login.token;
    const persisted = await state(f.id); assert.equal(persisted.weg, true);
    const restored = await request('/api/bestanden/actie', { ...action, operationId:crypto.randomUUID(), capability:'documents.restore', expectedVersion:persisted.documentVersion });
    assert.equal(restored.resource.state, 'active');
    evidence.steps.push({ name:'same-artifact restart, login, durable trash, restore', status:'PASS' });
    await stop(child); child = null; database(f.id, false);
    native.verifyInstalled(release, activeManifest);
    if (previous) {
      evidence.steps.push({ name:'rollback-previous', status:'PASS' }, { name:'schema-integrity', status:'PASS' });
      release = candidateRelease; activeManifest = p.manifest; await start();
      const again = await request('/api/auth/login', { email:account.email, password:account.password });
      assert.ok(again.token); token = again.token;
      assert.equal((await state(f.id)).weg, false);
      const content = await request('/api/bestanden/haal', { id:f.id });
      assert.equal(content.dataUrl, 'data:text/plain;base64,bmF0aXZlLXByb29m');
      await stop(child); child = null; database(f.id, false); native.verifyInstalled(release, activeManifest);
      evidence.steps.push({ name:'candidate-again', status:'PASS' }); evidence.dataPreserved = true;
    }
    evidence.steps.push({ name:'artifact unchanged after both processes', status:'PASS' });
    evidence.status = 'PASS';
  } catch (e) { evidence.error = e.message; throw e; }
  finally {
    try { await stop(child); }
    finally {
      evidence.finishedAt = new Date().toISOString();
      fs.mkdirSync(path.dirname(output), { recursive:true });
      fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', { mode:0o600 });
      fs.rmSync(temporary, { recursive:true, force:true });
    }
  }
  return evidence;
}
if (require.main === module) {
  const [file, commit, output, previous] = process.argv.slice(2);
  if (!file || !commit || !output) { console.error('Gebruik: native-rehearsal.js PAKKET COMMIT BEWIJS'); process.exitCode = 1; }
  else rehearse(file, commit, output, previous).then(e => console.log('Native package rehearsal: ' + e.status))
    .catch(e => { console.error('[native-rehearsal] ' + e.message); process.exitCode = 1; });
}
module.exports = { rehearse };
