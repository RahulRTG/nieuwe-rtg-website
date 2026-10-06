'use strict';
/* Echte tijdelijke SQLite; geen stroomuitvalclaim. Procescrash en economische
   herhaling blijven daarnaast in de bestaande geïsoleerde ketenproeven. */
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const proef = require('./lib/audit-rijen-fixture');
const proto = DatabaseSync.prototype;
const journal = p => require('../server/kern/command/journaal').maakJournaal({
  db: p.db, save: p.save, crypto: require('node:crypto'), auditOpslag: p.save.audit.open('apiSpoor')
});

function setup(t) {
  const p = proef(t), exec = proto.exec, prepare = proto.prepare;
  const sql = [], checkpoints = [];
  const mode = conn => prepare.call(conn, 'PRAGMA synchronous').get().synchronous;
  let writer;
  t.mock.method(proto, 'exec', function(text) {
    if (this !== p.conn) { writer ||= this; sql.push({ text, mode: mode(this) }); }
    return exec.call(this, text);
  });
  t.mock.method(proto, 'prepare', function(text) {
    const stmt = prepare.call(this, text);
    if (/wal_checkpoint/i.test(text)) checkpoints.push(text);
    return stmt;
  });
  const sqlite = require('../server/db/sqlite'); sqlite.loadSqlite(); sql.length = 0;
  assert.ok(writer, 'observatie gebruikt de echte schrijver, niet de tweede lezer');
  return { ...p, sqlite, writer, sql, checkpoints, mode, exec, prepare };
}
const writes = p => p.sql.filter(r => r.text === 'BEGIN IMMEDIATE');
const commits = p => p.sql.filter(r => r.text === 'COMMIT');

test('FULL legt KV en audit atomair vast, publiceert na commit en scant één keer zonder checkpoint', async t => {
  const p = setup(t), j = journal(p); p.sql.length = 0; p.checkpoints.length = 0;
  let scans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  await p.bijeen(() => {
    p.db.data.ander.waarde = 2; j.noteer({ actor: 'sam', actie: 'samen' }); p.save();
    assert.equal(p.lees('ander').waarde, 1);
    assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 0);
  }, { duurzaam: true });
  assert.equal(scans, 1);
  assert.deepEqual(writes(p).map(r => r.mode), [2]);
  assert.equal(commits(p).filter(r => r.mode === 2).length, 1);
  assert.equal(p.checkpoints.length, 0, 'FULL-COMMIT is de barrière voor deze wijziging');
  assert.equal(p.mode(p.writer), 1);
  assert.equal(p.lees('ander').waarde, 2);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
  assert.equal(j.aantal(), 1); assert.equal(j.controleer().heel, true);
});

test('gerichte duurzame bundel gebruikt FULL zonder vreemde collecties te serialiseren', async t => {
  const p = setup(t);
  p.db.data.doel = { waarde: 1 }; p.save(); p.sql.length = 0;
  let vreemdeScans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', {
    value() { vreemdeScans++; return { waarde: this.waarde }; }
  });
  await p.bijeen(() => {
    p.db.data.doel.waarde = 2;
    p.save.sleutels(['doel']);
    assert.equal(p.lees('doel').waarde, 1, 'de bundel publiceert niet vóór de commit');
  }, { duurzaam: true });
  assert.equal(vreemdeScans, 0, 'een gerichte bundel leest geen vreemde collectie');
  assert.deepEqual(writes(p).map(r => r.mode), [2]);
  assert.equal(commits(p).filter(r => r.mode === 2).length, 1);
  assert.equal(p.lees('doel').waarde, 2);
  assert.equal(p.mode(p.writer), 1);
});

test('gewone en selectieve saves blijven NORMAL; reeds FULL of EXTRA wordt niet verlaagd', t => {
  const p = setup(t);
  p.db.data.ander.waarde = 2; p.save();
  p.db.data.ander.waarde = 3; p.save.sleutels(['ander']);
  assert.deepEqual(writes(p).map(r => r.mode), [1, 1]);
  assert.equal(p.checkpoints.length, 0);
  for (const stand of [2, 3]) {
    p.exec.call(p.writer, 'PRAGMA synchronous=' + stand); p.sql.length = 0;
    p.db.data.ander.waarde++;
    assert.equal(p.saveDuurzaam().duurzaam, true);
    assert.deepEqual(writes(p).map(r => r.mode), [stand]);
    assert.equal(p.mode(p.writer), stand);
    assert.ok(p.sql.every(r => !/^PRAGMA synchronous=1$/i.test(r.text)));
  }
});

test('onbekende synchronous-stand weigert vóór iedere schrijftransactie', t => {
  const p = setup(t), prepare = proto.prepare;
  p.db.data.ander.waarde = 2;
  for (const synchronous of [undefined, -1, 4, NaN, '2']) {
    const hook = t.mock.method(proto, 'prepare', function(text) {
      if (this === p.writer && /^PRAGMA synchronous$/i.test(text)) return { get: () => ({ synchronous }) };
      return prepare.call(this, text);
    });
    assert.throws(() => p.saveDuurzaam(), /synchronisatiestand/);
    hook.mock.restore();
    assert.equal(p.lees('ander').waarde, 1);
  }
  assert.equal(writes(p).length, 0); assert.equal(p.checkpoints.length, 0);
  assert.equal(p.mode(p.writer), 1);
});

test('een genegeerde FULL-omschakeling kan geen duurzaamheid bevestigen', t => {
  const p = setup(t), exec = proto.exec;
  t.mock.method(proto, 'exec', function(text) {
    if (this === p.writer && /^PRAGMA synchronous=FULL$/i.test(text)) return;
    return exec.call(this, text);
  });
  p.db.data.ander.waarde = 2;
  assert.throws(() => p.saveDuurzaam(), /synchronisatiestand/);
  assert.equal(writes(p).length, 0); assert.equal(p.mode(p.writer), 1);
  assert.equal(p.lees('ander').waarde, 1);
});

test('eerdere NORMAL-write plus netto-noop vereist een werkelijk uitgevoerde checkpoint', t => {
  const p = setup(t);
  p.db.data.ander.waarde = 2; p.save();
  const voor = p.persistentieStand(); p.sql.length = 0; p.checkpoints.length = 0;
  const uit = p.saveDuurzaam();
  assert.equal(uit.duurzaam, true); assert.equal(uit.stand, voor);
  assert.equal(writes(p).length, 0);
  assert.ok(p.checkpoints.length > 0);
  assert.equal(p.mode(p.writer), 1);
  assert.equal(p.lees('ander').waarde, 2);
});

test('echte oude leessnapshot blokkeert noopbarrière; na vrijgave is dezelfde state bevestigbaar', t => {
  const p = setup(t);
  p.conn.exec('BEGIN'); p.conn.prepare('SELECT val FROM kv WHERE key=?').get('ander');
  p.exec.call(p.writer, 'PRAGMA busy_timeout=0');
  try {
    p.db.data.ander.waarde = 2; p.save();
    assert.equal(p.saveDuurzaam().duurzaam, false, 'busy is geen duurzame bevestiging');
    assert.equal(p.mode(p.writer), 1);
  } finally { p.conn.exec('ROLLBACK'); }
  assert.equal(p.saveDuurzaam().duurzaam, true);
  assert.equal(p.lees('ander').waarde, 2);
});

for (const [naam, resultaat] of [
  ['busy', { busy: 1, log: 2, checkpointed: 1 }],
  ['gedeeltelijk', { busy: 0, log: 2, checkpointed: 1 }],
  ['geen WAL', { busy: 0, log: -1, checkpointed: -1 }],
  ['ontbrekende velden', {}], ['verkeerde typen', { busy: '0', log: 0, checkpointed: 0 }],
  ['leesfout', new Error('checkpoint-leesfout')]
]) test('noop bevestigt geen ongeldige checkpoint: ' + naam, async t => {
  const p = setup(t), prepare = proto.prepare;
  t.mock.method(proto, 'prepare', function(text) {
    const stmt = prepare.call(this, text);
    if (!/wal_checkpoint/i.test(text) || this !== p.writer) return stmt;
    return { get() { if (resultaat instanceof Error) throw resultaat; return resultaat; } };
  });
  assert.equal(p.saveDuurzaam().duurzaam, false);
  await assert.rejects(p.bijeen(() => p.save(), { duurzaam: true }), /niet vastgelegd/);
  assert.equal(p.mode(p.writer), 1);
  assert.equal(p.lees('ander').waarde, 1);
});

for (const fase of ['BEGIN IMMEDIATE', 'WRITE', 'COMMIT'])
  test('duurzame fout bij ' + fase + ' rolt terug, herstelt instelling en herhaling geeft één effect', async t => {
    const p = setup(t), j = journal(p), exec = proto.exec;
    const voor = p.persistentieStand(); let raken = 0;
    if (fase === 'WRITE') p.conn.exec("CREATE TRIGGER weiger BEFORE UPDATE ON kv WHEN NEW.key='ander' BEGIN SELECT RAISE(ABORT,'gerichte-writefout'); END");
    const injectie = t.mock.method(proto, 'exec', function(text) {
      if (this === p.writer && p.mode(this) >= 2 && text === fase && raken++ === 0) throw new Error('gerichte-' + fase);
      return exec.call(this, text);
    });
    await assert.rejects(p.bijeen(() => {
      p.db.data.ander.waarde = 2; j.noteer({ actor: 'sam', actie: 'retry' }); p.save();
    }, { duurzaam: true }), /gerichte-/);
    assert.equal(p.mode(p.writer), 1);
    assert.equal(p.persistentieStand(), voor);
    assert.equal(p.lees('ander').waarde, 1);
    assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 0);
    assert.equal(j.aantal(), 0, 'mislukte bundelpreview wordt niet authoritative');
    injectie.mock.restore();
    if (fase === 'WRITE') p.conn.exec('DROP TRIGGER weiger');
    await p.bijeen(() => { j.noteer({ actor: 'sam', actie: 'retry' }); p.save(); }, { duurzaam: true });
    assert.equal(p.mode(p.writer), 1);
    assert.equal(p.lees('ander').waarde, 2);
    assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
    assert.equal(j.controleer().heel, true);
  });

test('fout bij instellingherstel ná FULL-COMMIT maakt vastgelegd werk niet tot een schijnmislukking', t => {
  const p = setup(t), exec = proto.exec; let vast = false, geraakt = 0;
  t.mock.method(proto, 'exec', function(text) {
    if (this === p.writer && vast && /^PRAGMA\s+(?:main\.)?synchronous\s*=\s*(?:1|NORMAL)\b/i.test(text)) {
      geraakt++; throw new Error('gerichte-herstel-fout');
    }
    const uit = exec.call(this, text);
    if (this === p.writer && text === 'COMMIT') vast = true;
    return uit;
  });
  p.db.data.ander.waarde = 2;
  const uit = p.saveDuurzaam();
  assert.equal(geraakt, 1, 'de fout valt daadwerkelijk na de geslaagde commit');
  assert.equal(uit.duurzaam, true, 'caller mag niet niet-vastgelegd teruggeven');
  assert.equal(p.lees('ander').waarde, 2);
  assert.ok(p.mode(p.writer) >= 2, 'niet ongemerkt verder met een zwakkere instelling');
  const voor = p.persistentieStand();
  assert.equal(p.saveDuurzaam().duurzaam, true);
  assert.equal(p.persistentieStand(), voor, 'dezelfde state wordt niet opnieuw gemuteerd');
});

test('FULL-multiwritermerge bewaart beide wijzigingen en backupcheckpoint bewaart nieuwe RAM', t => {
  const p = setup(t);
  const extern = p.kind(`const p=require('./server/db'),s=require('./server/db/sqlite');
    p.db.data=s.loadSqlite();p.db.data.ander.extern=7;p.save();`);
  assert.equal(extern.status, 0, extern.stderr);
  p.db.data.ander.waarde = 2;
  assert.equal(p.saveDuurzaam().duurzaam, true);
  assert.deepEqual(p.lees('ander'), { waarde: 2, extern: 7 });
  p.db.data.ander.waarde = 3; p.checkpoints.length = 0;
  assert.equal(p.checkpointSqlite(), true);
  assert.ok(p.checkpoints.length > 0);
  assert.deepEqual(p.lees('ander'), { waarde: 3, extern: 7 });
});
