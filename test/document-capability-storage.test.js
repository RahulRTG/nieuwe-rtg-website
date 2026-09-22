/* Real SQLite transactions, independent processes, SQL write rejection and isolated crashes.
   These are not PostgreSQL, physical-device or production rollback claims. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { versie } = require('../server/kern/document-contracten');

const item = { id: 'doc-1', naam: 'synthetic.txt', ref: 'blob-1', versies: [{ ref: 'blob-0' }],
  gedeeldMet: ['recipient'], weg: false, wegOp: null };
const input = () => ({ capability: 'document.trash', contractVersion: 1, id: item.id,
  operationId: randomUUID(), expectedVersion: versie(item) });
const setup = `const d=require('./server/db');d.load();
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const read=()=>d.bewerkCollectie('bestanden',s=>s['lid:owner']);
const maak=(bewerken=d.bewerkCollectie)=>require('./server/kern/document-capability')({
 bewerkCollectie:bewerken,store:'sqlite',nu:()=>new Date().toISOString(),
 leesBytes:ref=>{try{return fs.readFileSync(path.join(process.env.RTG_DATA_DIR,ref))}catch(e){return null}}});
`;
function run(map, code) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', setup + code], { cwd: path.join(__dirname, '..'),
      env: { ...process.env, RTG_DATA_DIR: map, RTG_STORE: 'sqlite', RTG_ENC_KEY: '', DATABASE_URL: '', PG_URL: '' } });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; });
    child.stderr.on('data', b => { stderr += b; });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal === 'SIGKILL') return resolve({ signal });
      if (code) return reject(new Error(stderr || stdout));
      try { resolve(JSON.parse(stdout.trim().split('\n').at(-1))); } catch (e) { reject(e); }
    });
  });
}
async function fixture(t) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-document-sqlite-'));
  t.after(() => fs.rmSync(map, { recursive: true, force: true }));
  fs.writeFileSync(path.join(map, 'blob-1'), 'current');
  fs.writeFileSync(path.join(map, 'blob-0'), 'history');
  await run(map, `d.bewerkCollectie('bestanden',s=>{s['lid:owner']={items:[${JSON.stringify(item)}],mappen:[]}});console.log('{}');`);
  return map;
}
test('two processes share one operation receipt and one lifecycle revision', async t => {
  const map = await fixture(t), b = input();
  const code = `maak()('owner',${JSON.stringify(b)}).then(r=>console.log(JSON.stringify(r)));`;
  const all = await Promise.all([run(map, code), run(map, code)]);
  assert.equal(all.filter(x => x.ok && !x.herhaald).length, 1);
  assert.equal(all.filter(x => x.ok && x.herhaald).length, 1);
  const db = await run(map, `console.log(JSON.stringify(read()));`);
  assert.equal(db.items[0].documentRevision, 1);
  assert.equal(Object.keys(db.documentOperations).length, 1);
  assert.deepEqual(db.items[0].gedeeldMet, ['recipient']);
  assert.deepEqual(fs.readdirSync(map).filter(n => n.startsWith('blob-')), ['blob-0', 'blob-1']);
});
test('SQL write rejection leaves no mutated memory, database state or receipt; retry recovers', async t => {
  const map = await fixture(t), b = input();
  const result = await run(map, `const sql=new DatabaseSync(path.join(process.env.RTG_DATA_DIR,'store.db'));
  sql.exec("CREATE TRIGGER reject_document BEFORE UPDATE ON kv WHEN NEW.key='bestanden' BEGIN SELECT RAISE(FAIL,'isolated write failure'); END");
  maak()('owner',${JSON.stringify(b)}).then(r=>{const ram=d.db.data.bestanden['lid:owner'];
    sql.exec('DROP TRIGGER reject_document'); console.log(JSON.stringify({r,ram,db:read()}));sql.close()});`);
  assert.equal(result.r.status, 503);
  assert.equal(result.r.code, 'outcome_unknown');
  for (const state of [result.ram, result.db]) {
    assert.equal(state.items[0].weg, false);
    assert.equal(state.documentOperations, undefined);
  }
  const recovered = await run(map, `maak()('owner',${JSON.stringify(b)}).then(r=>console.log(JSON.stringify(r)));`);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.herhaald, false);
});
test('crash before commit rolls back, crash after commit before response replays without a second effect', async t => {
  const map = await fixture(t), b = input();
  const before = await run(map, `maak((k,fn)=>d.bewerkCollectie(k,s=>{fn(s);process.kill(process.pid,'SIGKILL')}))('owner',${JSON.stringify(b)});`);
  assert.equal(before.signal, 'SIGKILL');
  const notCommitted = await run(map, 'console.log(JSON.stringify(read()));');
  assert.equal(notCommitted.items[0].weg, false);
  assert.equal(notCommitted.documentOperations, undefined);
  const after = await run(map, `maak()('owner',${JSON.stringify(b)}).then(r=>{if(!r.ok)throw Error(JSON.stringify(r));process.kill(process.pid,'SIGKILL')});`);
  assert.equal(after.signal, 'SIGKILL');
  const retry = await run(map, `maak()('owner',${JSON.stringify(b)}).then(r=>console.log(JSON.stringify({r,db:read()})));`);
  assert.equal(retry.r.ok, true);
  assert.equal(retry.r.herhaald, true);
  assert.equal(retry.db.items[0].documentRevision, 1);
  assert.equal(Object.keys(retry.db.documentOperations).length, 1);
});
test('missing content cannot be confirmed as restored, and removed owner cannot replay a receipt', async t => {
  const map = await fixture(t), b = input();
  const trashed = await run(map, `maak()('owner',${JSON.stringify(b)}).then(r=>console.log(JSON.stringify(r)));`);
  fs.unlinkSync(path.join(map, 'blob-0'));
  const restore = { ...b, capability: 'document.restore', operationId: randomUUID(), expectedVersion: trashed.resource.version };
  const failed = await run(map, `maak()('owner',${JSON.stringify(restore)}).then(r=>console.log(JSON.stringify({r,db:read()})));`);
  assert.equal(failed.r.status, 410);
  assert.equal(failed.db.items[0].weg, true);
  assert.equal(Object.keys(failed.db.documentOperations).length, 1);
  const revoked = await run(map, `d.bewerkCollectie('bestanden',s=>{delete s['lid:owner']});
    maak()('owner',${JSON.stringify(b)}).then(r=>console.log(JSON.stringify(r)));`);
  assert.equal(revoked.status, 404);
  assert.equal(revoked.auditRef, undefined);
});

const versionSetup = `const versionCommit=require('./server/kern/bestanden-versiecommit')({
 bewerkCollectie:d.bewerkCollectie,codenaamVan:k=>k,nu:()=>new Date().toISOString(),MAX_VERSIES:10,QUOTUM:100000,
 schrijfBytes:buf=>{const ref='blob-new';fs.writeFileSync(path.join(process.env.RTG_DATA_DIR,ref),buf);return ref},
 wisBytes:ref=>fs.unlinkSync(path.join(process.env.RTG_DATA_DIR,ref))});`;
test('simultaneous upload and trash have one winner; revocation is checked after preparation', async t => {
  const map = await fixture(t), b = input();
  const request = { key: 'owner', eigenaar: 'owner', id: item.id, verwacht: versie(item), mime: 'text/plain' };
  const results = await Promise.all([
    run(map, `maak()('owner',${JSON.stringify(b)}).then(r=>console.log(JSON.stringify(r)));`),
    run(map, versionSetup + `versionCommit({...${JSON.stringify(request)},buf:Buffer.from('new')}).then(r=>console.log(JSON.stringify(r)));`)
  ]);
  assert.equal(results.filter(r => r.status === 409).length, 1, JSON.stringify(results));
  assert.equal(results.filter(r => r.ok || r.id).length, 1);
  const db = await run(map, 'console.log(JSON.stringify(read()));');
  if (results[0].ok) {
    assert.equal(db.items[0].weg, true); assert.equal(db.items[0].ref, 'blob-1');
  } else {
    assert.equal(db.items[0].weg, false); assert.equal(db.items[0].ref, 'blob-new');
  }
  const revoked = await run(map, `d.bewerkCollectie('bestanden',s=>{s['lid:owner'].items[0].gedeeldMet=[]});` + versionSetup +
    `versionCommit({...${JSON.stringify(request)},key:'recipient',buf:Buffer.from('forbidden')}).then(r=>console.log(JSON.stringify(r)));`);
  assert.equal(revoked.status, 404);
  assert.notEqual(fs.existsSync(path.join(map, 'blob-new')) && fs.readFileSync(path.join(map, 'blob-new'), 'utf8'), 'forbidden');
});
