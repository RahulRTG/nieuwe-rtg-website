'use strict';
/* De gemonteerde SQLite-save leest oude payloads alleen voor een echte merge.
   Metadata en eventuele inhoud blijven onder hetzelfde BEGIN IMMEDIATE-slot;
   een tweede verbinding controleert de werkelijk vastgelegde toestand. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function proef(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-save-versie-'));
  const env = { RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', RTG_ENC_KEY: '', DATABASE_URL: '', PG_URL: '', REDIS_URL: '' };
  const oud = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  const prefix = path.join(__dirname, '..', 'server') + path.sep;
  for (const k of Object.keys(require.cache)) if (k.startsWith(prefix)) delete require.cache[k];
  const state = require('../server/db/state'), sqlite = require('../server/db/sqlite');
  state.db.data = { groot: { tekst: 'a'.repeat(3 * 1024 * 1024) }, gedeeld: { links: 1, rechts: 1 } };
  sqlite.saveSqlite(true);
  const ander = new DatabaseSync(path.join(dir, 'store.db'));
  ander.exec('PRAGMA busy_timeout=1');
  const commitStand = [], exec = DatabaseSync.prototype.exec;
  t.mock.method(DatabaseSync.prototype, 'exec', function (sql) {
    if (sql === 'COMMIT') commitStand.push(this.prepare('PRAGMA synchronous').get().synchronous);
    return exec.call(this, sql);
  });
  const lees = key => ander.prepare('SELECT val, ver, deleted FROM kv WHERE key=?').get(key);
  function extern(waarde, deleted = 0) {
    ander.exec('BEGIN IMMEDIATE');
    try {
      ander.exec("UPDATE meta SET v=v+1 WHERE k='ver'");
      const v = ander.prepare("SELECT v FROM meta WHERE k='ver'").get().v;
      ander.prepare('UPDATE kv SET val=?,ver=?,deleted=? WHERE key=?')
        .run(waarde === null ? null : JSON.stringify(waarde), v, deleted, 'gedeeld');
      ander.exec('COMMIT');
    } catch (e) { ander.exec('ROLLBACK'); throw e; }
  }
  t.after(() => {
    ander.close();
    for (const [k, v] of Object.entries(oud)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { ...state, sqlite, ander, lees, extern, commitStand };
}

function observeer(t, p, naLees = () => {}) {
  const prototype = Object.getPrototypeOf(p.ander.prepare('SELECT 1'));
  const get = prototype.get, all = prototype.all, rijen = [];
  let ontvangenBytes = 0;
  function tel(rij) {
    if (rij && typeof rij.val === 'string') ontvangenBytes += Buffer.byteLength(rij.val);
  }
  const mock = t.mock.method(prototype, 'get', function (...args) {
    const rij = get.apply(this, args);
    tel(rij);
    if (rij && Object.hasOwn(rij, 'ver') && Object.hasOwn(rij, 'deleted')) {
      rijen.push({ key: args[0], payload: Object.hasOwn(rij, 'val'), bytes: typeof rij.val === 'string' ? Buffer.byteLength(rij.val) : 0 });
      naLees(rij, args[0]);
    }
    return rij;
  });
  const alles = t.mock.method(prototype, 'all', function (...args) {
    const uit = all.apply(this, args); uit.forEach(tel); return uit;
  });
  return { rijen, bytes: () => ontvangenBytes, stop() { mock.mock.restore(); alles.mock.restore(); } };
}

for (const duurzaam of [false, true]) test((duurzaam ? 'FULL' : 'NORMAL') + '-save bewaart alle wijzigingen zonder oude grote payload terug te kopiëren', t => {
  const p = proef(t), o = observeer(t, p);
  p.db.data.groot.tekst += 'b';
  p.db.data.gedeeld.links = 2;
  p.db.data.nieuw = { bewaard: true };
  const uit = p.sqlite.saveSqlite(true, undefined, [], duurzaam);
  o.stop();
  if (duurzaam) { assert.equal(uit.duurzaam, true); assert.equal(p.commitStand.at(-1), 2); }
  assert.equal(o.bytes(), 0, 'geen oude payload nodig voor eigen of nieuwe versies');
  assert.deepEqual(o.rijen.map(r => r.key).sort(), ['gedeeld', 'groot']);
  assert.equal(JSON.parse(p.lees('groot').val).tekst, 'a'.repeat(3 * 1024 * 1024) + 'b');
  assert.deepEqual(JSON.parse(p.lees('gedeeld').val), { links: 2, rechts: 1 });
  assert.deepEqual(JSON.parse(p.lees('nieuw').val), { bewaard: true });
});

for (const duurzaam of [false, true]) test((duurzaam ? 'FULL' : 'NORMAL') + '-merge leest een nieuwere externe versie onder hetzelfde schrijfslot', t => {
  const p = proef(t);
  p.extern({ links: 1, rechts: 3 });
  p.db.data.gedeeld.links = 2;
  let slotBewezen = false;
  const o = observeer(t, p, (rij, key) => {
    if (key === 'gedeeld' && !Object.hasOwn(rij, 'val')) {
      assert.throws(() => p.ander.prepare('UPDATE kv SET deleted=1 WHERE key=?').run(key), /locked/);
      slotBewezen = true;
    }
  });
  const uit = p.sqlite.saveSqlite(true, undefined, [], duurzaam); o.stop();
  if (duurzaam) { assert.equal(uit.duurzaam, true); assert.equal(p.commitStand.at(-1), 2); }
  assert.equal(slotBewezen, true, 'de metadata wordt pas binnen BEGIN IMMEDIATE gelezen');
  assert.deepEqual(o.rijen.map(r => [r.key, r.payload]), [['gedeeld', false], ['gedeeld', true]]);
  assert.deepEqual(JSON.parse(p.lees('gedeeld').val), { links: 2, rechts: 3 });
  assert.deepEqual(p.db.data.gedeeld, { links: 2, rechts: 3 });
});

test('een externe grafsteen wint zonder payload en een volgende save wekt haar niet op', t => {
  const p = proef(t);
  p.extern(null, 1); p.db.data.gedeeld.links = 2;
  const o = observeer(t, p);
  p.sqlite.saveSqlite(true); p.sqlite.saveSqlite(true); o.stop();
  assert.deepEqual(o.rijen.map(r => [r.key, r.payload]), [['gedeeld', false]]);
  assert.equal(p.lees('gedeeld').deleted, 1);
  assert.equal(p.lees('gedeeld').val, null);
  assert.equal(Object.hasOwn(p.db.data, 'gedeeld'), false);
});

for (const payload of [false, true]) test((payload ? 'payload' : 'metadata') + '-leesfout rolt terug en laat de retry werkelijk schrijven', t => {
  const p = proef(t);
  if (payload) p.extern({ links: 1, rechts: 4 });
  p.db.data.gedeeld.links = 2;
  const fout = new Error('geisoleerde save-leesfout');
  const o = observeer(t, p, (rij, key) => {
    if (key === 'gedeeld' && Object.hasOwn(rij, 'val') === payload) throw fout;
  });
  assert.throws(() => p.sqlite.saveSqlite(true), e => e === fout); o.stop();
  assert.deepEqual(JSON.parse(p.lees('gedeeld').val), { links: 1, rechts: payload ? 4 : 1 });
  p.sqlite.saveSqlite(true);
  assert.deepEqual(JSON.parse(p.lees('gedeeld').val), { links: 2, rechts: payload ? 4 : 1 });
});

test('een mislukte commit bevestigt geen caches en de retry bewaart dezelfde mutatie', t => {
  const p = proef(t), exec = DatabaseSync.prototype.exec;
  p.db.data.gedeeld.links = 9;
  let fail = true;
  t.mock.method(DatabaseSync.prototype, 'exec', function (sql) {
    if (sql === 'COMMIT' && fail) { fail = false; throw new Error('geisoleerde save-commitfout'); }
    return exec.call(this, sql);
  });
  assert.throws(() => p.sqlite.saveSqlite(true), /save-commitfout/);
  assert.deepEqual(JSON.parse(p.lees('gedeeld').val), { links: 1, rechts: 1 });
  p.sqlite.saveSqlite(true);
  assert.deepEqual(JSON.parse(p.lees('gedeeld').val), { links: 9, rechts: 1 });
});

test('een grafsteen ruimt RAM pas op na een geslaagde commit', t => {
  const p = proef(t), exec = DatabaseSync.prototype.exec;
  p.extern(null, 1); p.db.data.gedeeld.links = 2;
  p.db.data.groot.tekst = 'gewijzigd';
  let fail = true;
  t.mock.method(DatabaseSync.prototype, 'exec', function (sql) {
    if (sql === 'COMMIT' && fail) { fail = false; throw new Error('grafsteen-commitfout'); }
    return exec.call(this, sql);
  });
  assert.throws(() => p.sqlite.saveSqlite(true), /grafsteen-commitfout/);
  assert.deepEqual(p.db.data.gedeeld, { links: 2, rechts: 1 }, 'geen RAM-publicatie vóór bevestigde commit');
  assert.equal(p.lees('gedeeld').deleted, 1, 'de externe grafsteen blijft behouden');
  assert.equal(JSON.parse(p.lees('groot').val).tekst, 'a'.repeat(3 * 1024 * 1024), 'de andere schrijfactie is teruggerold');
  p.sqlite.saveSqlite(true);
  assert.equal(Object.hasOwn(p.db.data, 'gedeeld'), false);
  assert.equal(p.lees('gedeeld').deleted, 1);
  assert.equal(JSON.parse(p.lees('groot').val).tekst, 'gewijzigd');
});
