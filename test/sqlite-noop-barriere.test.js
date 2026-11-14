'use strict';
/* Werkelijke SQLite-verbindingen, niet een veronderstelde busy-uitkomst.
   Geen bewijs voor stroomuitval; wel voor checkpointkeuze en herleesbaarheid. */
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const proef = require('./lib/audit-rijen-fixture');
function setup(t) {
  const p = proef(t), proto = DatabaseSync.prototype, exec = proto.exec, prepare = proto.prepare;
  const checkpoints = []; let writer;
  t.mock.method(proto, 'exec', function(sql) { if (this !== p.conn) writer ||= this; return exec.call(this, sql); });
  t.mock.method(proto, 'prepare', function(sql) {
    if (this !== p.conn && /wal_checkpoint/i.test(sql)) checkpoints.push(sql);
    return prepare.call(this, sql);
  });
  require('../server/db/sqlite').loadSqlite();
  assert.ok(writer); exec.call(writer, 'PRAGMA busy_timeout=0');
  return { ...p, writer, checkpoints };
}
test('netto-noop bevestigt de laatste snapshot zonder de actieve lezer uit het WAL te jagen', t => {
  const p = setup(t);
  p.db.data.ander.waarde = 2; p.save();
  p.conn.exec('BEGIN'); assert.equal(p.lees('ander').waarde, 2);
  try {
    const voor = p.persistentieStand();
    assert.equal(p.saveDuurzaam().duurzaam, true, 'een actuele lezer blokkeert FULL niet');
    assert.equal(p.persistentieStand(), voor, 'geen extra economische write');
    assert.deepEqual(p.checkpoints, ['PRAGMA wal_checkpoint(FULL)']);
    assert.equal(p.writer.prepare('PRAGMA synchronous').get().synchronous, 1);
    assert.equal(p.lees('ander').waarde, 2);
  } finally { p.conn.exec('ROLLBACK'); }
  const opnieuw = p.kind(`const s=require('./server/db/sqlite');process.stdout.write(JSON.stringify(s.loadSqlite().ander));`);
  assert.equal(opnieuw.status, 0, opnieuw.stderr);
  assert.deepEqual(JSON.parse(opnieuw.stdout), { waarde: 2 });
});
test('noop gebruikt FULL; backup blijft nieuwe RAM flushen en werkelijk TRUNCATE doen', t => {
  const p = setup(t);
  for (let i = 0; i < 3; i++) assert.equal(p.saveDuurzaam().duurzaam, true);
  assert.deepEqual(p.checkpoints, Array(3).fill('PRAGMA wal_checkpoint(FULL)'));
  p.db.data.ander.waarde = 9; p.checkpoints.length = 0;
  assert.equal(p.checkpointSqlite(), true);
  assert.deepEqual(p.checkpoints, ['PRAGMA wal_checkpoint(TRUNCATE)']);
  assert.equal(p.lees('ander').waarde, 9);
});
test('checkpointpoorten openen een ongebruikte database niet', () => {
  let saves = 0;
  const wal = require('../server/db/sqlite-checkpoint')({ verbinding: () => null, saveSqlite: () => { saves++; } });
  assert.equal(wal.bevestigWalSqlite(), false);
  assert.equal(wal.vouwWalSqlite(), false);
  assert.equal(wal.checkpointSqlite(), false);
  wal.afrondSqlite(); assert.equal(saves, 0);
});
