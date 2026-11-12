'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const meetSqlite = require('../scripts/sqlite-profile-phases');

test('fasemeting houdt this, parameters, antwoorden en oorspronkelijke fouten intact', () => {
  const calls = [], fout = Error('geheime foutinhoud'), antwoord = { zelfde: true };
  class StatementSync {
    run(...args) { calls.push({ owner: this, args }); if (args[0] === 'fout') throw fout; return antwoord; }
    get(...args) { calls.push({ owner: this, args }); return antwoord; }
  }
  class DatabaseSync {
    exec(...args) { calls.push({ owner: this, args }); if (args[0] === 'ROLLBACK') throw fout; return antwoord; }
    prepare(...args) { calls.push({ owner: this, args }); return new StatementSync(); }
  }
  const voor = [DatabaseSync.prototype.exec, DatabaseSync.prototype.prepare, StatementSync.prototype.run, StatementSync.prototype.get];
  let klok = 0;
  const meter = meetSqlite({ DatabaseSync, StatementSync }, () => ++klok);
  try {
    const db = new DatabaseSync();
    assert.equal(db.exec('BEGIN IMMEDIATE', 'extra'), antwoord);
    assert.equal(calls[0].owner, db); assert.deepEqual(calls[0].args, ['BEGIN IMMEDIATE', 'extra']);
    assert.throws(() => db.exec('ROLLBACK'), e => e === fout);
    const q = db.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?)');
    const payload = 'geheime-payload';
    assert.equal(q.run('trustEvidence', payload, 17), antwoord);
    assert.equal(calls.at(-1).owner, q); assert.deepEqual(calls.at(-1).args, ['trustEvidence', payload, 17]);
    assert.throws(() => q.run('fout', 'niet geschreven', 17), e => e === fout);
    assert.equal(db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get('extra'), antwoord);
    assert.equal(db.prepare('SELECT geheim FROM geheim').get(), antwoord);
    const uit = meter.drain(), rijen = new Map(uit.rows.map(r => [r.phase, r]));
    assert.equal(rijen.get('exec.begin').count, 1);
    assert.equal(rijen.get('exec.begin').connection, rijen.get('kv.write.trustEvidence').connection);
    assert.equal(rijen.get('exec.rollback').failures, 1);
    assert.equal(rijen.get('kv.write.trustEvidence').storedChars, payload.length);
    assert.equal(rijen.get('kv.write.other').storedChars, 0);
    assert.equal(rijen.get('checkpoint.TRUNCATE').count, 1);
    assert.equal(JSON.stringify(uit).includes('geheim'), false);
    assert.equal(JSON.stringify(uit).includes('niet geschreven'), false);
    assert.deepEqual(meter.drain().rows, []);
  } finally { meter.restore(); }
  assert.deepEqual([DatabaseSync.prototype.exec, DatabaseSync.prototype.prepare, StatementSync.prototype.run, StatementSync.prototype.get], voor);
});

test('verbindingen hebben stabiele anonieme en begrensde labels, geen bestandsnamen', () => {
  class StatementSync { run() { return 1; } get() { return 1; } }
  class DatabaseSync { exec() {} prepare() { return new StatementSync(); } }
  const meter = meetSqlite({ DatabaseSync, StatementSync });
  try {
    const first = new DatabaseSync(); first.exec('COMMIT');
    assert.equal(meter.drain().rows[0].connection, 1);
    first.exec('COMMIT');
    for (let i = 0; i < 100; i++) new DatabaseSync().exec('COMMIT');
    const rows = meter.drain().rows;
    assert.equal(rows.length, 17);
    assert.equal(rows.find(r => r.connection === 'other').count, 85);
    assert.equal(rows.find(r => r.connection === 1).count, 1);
  } finally { meter.restore(); }
});

test('collectielabels en histogrammen blijven begrensd, ook bij 6000 onbekende namen', () => {
  class StatementSync { run() { return 1; } get() { return 1; } }
  class DatabaseSync { exec() {} prepare() { return new StatementSync(); } }
  let klok = 0;
  const meter = meetSqlite({ DatabaseSync, StatementSync }, () => { klok += 300; return klok; });
  try {
    const q = new DatabaseSync().prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?)');
    for (let i = 0; i < 6000; i++) q.run('persoonlijke-naam-' + i, 'x', i);
    const uit = meter.drain();
    assert.equal(uit.rows.length, 1); assert.equal(uit.rows[0].phase, 'kv.write.other');
    assert.equal(uit.rows[0].count, 6000); assert.equal(uit.rows[0].storedChars, 6000);
    assert.equal(uit.rows[0].buckets.at(-1), 6000);
    assert.equal(JSON.stringify(uit).includes('persoonlijke'), false);
  } finally { meter.restore(); }
});

test('echte SQLite meet BEGIN, payloadwrite, COMMIT en checkpoint zonder gegevensverlies', () => {
  const sqlite = require('node:sqlite'), db = new sqlite.DatabaseSync(':memory:');
  const meter = meetSqlite(sqlite);
  try {
    db.exec('CREATE TABLE kv(key TEXT PRIMARY KEY,val TEXT,ver INTEGER)');
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?)').run('trustEvidence', '{"bewijs":1}', 1);
    db.exec('COMMIT');
    const waarde = db.prepare('SELECT val FROM kv WHERE key=?').get('trustEvidence');
    assert.equal(waarde.val, '{"bewijs":1}');
    db.prepare('PRAGMA wal_checkpoint(FULL)').get();
    const rijen = new Map(meter.drain().rows.map(r => [r.phase, r]));
    for (const naam of ['exec.begin', 'exec.commit', 'kv.write.trustEvidence', 'checkpoint.FULL'])
      assert.equal(rijen.get(naam).count, 1);
    assert.equal(rijen.get('kv.write.trustEvidence').storedChars, waarde.val.length);
  } finally { meter.restore(); db.close(); }
});
