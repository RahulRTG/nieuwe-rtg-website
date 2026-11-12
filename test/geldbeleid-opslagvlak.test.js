'use strict';
/* Echte SQLite-commits en een nieuwe lezer. Dit bewijst eigenaarselectie,
   niet een prestatiewinst of een nieuwe duurzaamheidsgarantie. */
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const proef = require('./lib/audit-rijen-fixture');
function setup(t, legacy = false) {
  const p = proef(t), save = legacy ? () => p.save() : p.save;
  let tijd = new Date('2026-11-12T12:00:00Z'), scans = 0;
  const g = require('../server/kern/geldbeleid')({ ...p, save, klok: () => tijd }).geldbeleid;
  Object.defineProperty(p.db.data.ander, 'toJSON', {
    value() { scans++; return { waarde: this.waarde }; }
  });
  return { ...p, g, scans: () => scans, klok: nieuw => { tijd = new Date(nieuw); } };
}
const zet = p => p.g.vast(() => p.g.potZet('lid', { naam: 'Reis', doelCenten: 10000 }, 'pot-1'));
const herlees = p => {
  const r = p.kind("const s=require('./server/db/sqlite');process.stdout.write(JSON.stringify(s.loadSqlite().geldbeleid));");
  assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout).perLid.lid;
};

test('pot, reservering en herhaling bewaren hun eigenaar zonder vreemde pending data te scannen', async t => {
  const p = setup(t); p.db.data.ander.waarde = 9;
  const a = await zet(p); assert.equal(a.status, 200);
  assert.equal((await zet(p)).herhaald, true);
  assert.equal((await p.g.vast(() => p.g.potReserveer('lid', a.pot.id, 750, null, 'res-1'))).ok, true);
  assert.equal((await p.g.vast(() => p.g.potReserveer('lid', a.pot.id, 750, null, 'res-1'))).herhaald, true);
  assert.equal(p.scans(), 0, 'geldbeleid serialiseert geen vreemde collectie');
  assert.equal(p.lees('ander').waarde, 1); assert.equal(p.db.data.ander.waarde, 9);
  const r = herlees(p);
  assert.equal(r.potten.length, 1); assert.equal(r.potten[0].standCenten, 750);
  assert.equal(r.potten[0].idem, 'pot-1'); assert.deepEqual(r.potten[0].idems, [{ k: 'res-1', c: 750 }]);
  assert.equal(r.log.length, 2);
});

test('synchrone schrijvers, maandreservering en verstreken geldgrens bewaren alleen beleid', t => {
  const p = setup(t), g = p.g; p.db.data.ander.waarde = 9;
  const pot = g.potZet('lid', { naam: 'Reis', doelCenten: 10000 }, 'pot-1').pot;
  assert.equal(g.regelZet('lid', { soort: 'reserveer-maandelijks', drempelCenten: 500,
    niveau: 'automatisch', potId: pot.id }).ok, true);
  g.evalueer('lid', {}); g.evalueer('lid', {});
  const grens = g.grensZet('lid', { periode: 'dag', centen: 1000, bedenktijdUren: 1 }).grens;
  assert.equal(g.grensZet('lid', { id: grens.id, centen: 2000 }).geparkeerd, true);
  p.klok('2026-11-12T14:00:00Z'); assert.equal(g.grensVoor('lid').dagMaxCenten, 2000);
  assert.equal(p.scans(), 0, 'ook de ctx.save van binnenste schrijvers blijft gericht');
  const r = herlees(p);
  assert.equal(r.potten[0].standCenten, 500); assert.equal(r.regels[0].laatst, '2026-11');
  assert.equal(r.grenzen[0].centen, 2000); assert.equal(r.grenzen[0].wachtTot, null);
  assert.equal(p.lees('ander').waarde, 1);
});

test('een bestaande idempotente pot blijft een echte FULL-barriere zonder extra COMMIT', async t => {
  const p = setup(t); await zet(p);
  const proto = DatabaseSync.prototype, exec = proto.exec, prepare = proto.prepare;
  let commits = 0; const checkpoints = [];
  t.mock.method(proto, 'exec', function(sql) { if (sql === 'COMMIT') commits++; return exec.call(this, sql); });
  t.mock.method(proto, 'prepare', function(sql) {
    if (/wal_checkpoint/i.test(sql)) checkpoints.push(sql);
    return prepare.call(this, sql);
  });
  assert.equal((await zet(p)).herhaald, true);
  assert.equal(commits, 0); assert.deepEqual(checkpoints, ['PRAGMA wal_checkpoint(FULL)']);
  assert.equal(p.scans(), 0);
});

for (const fase of ['COMMIT', 'checkpoint']) test('geen vals succes bij mislukte ' + fase, async t => {
  const p = setup(t); await zet(p);
  const proto = DatabaseSync.prototype, exec = proto.exec, prepare = proto.prepare;
  let geraakt = 0;
  if (fase === 'COMMIT') t.mock.method(proto, 'exec', function(sql) {
    if (sql === 'COMMIT' && !geraakt++) throw new Error('beleidscommit mislukt');
    return exec.call(this, sql);
  });
  else t.mock.method(proto, 'prepare', function(sql) {
    if (/wal_checkpoint\(FULL\)/i.test(sql) && !geraakt++) throw new Error('beleidscheckpoint mislukt');
    return prepare.call(this, sql);
  });
  const werk = fase === 'COMMIT' ? () => p.g.potZet('lid', { naam: 'Buffer', doelCenten: 1000 }, 'pot-2')
    : () => p.g.potZet('lid', { naam: 'Reis', doelCenten: 10000 }, 'pot-1');
  assert.equal((await p.g.vast(werk)).status, 503); assert.ok(geraakt > 0);
  if (fase === 'COMMIT') assert.equal(p.lees('geldbeleid').perLid.lid.potten.length, 1);
  t.mock.restoreAll();
  assert.equal((await p.g.vast(werk)).ok, true);
  if (fase === 'COMMIT') assert.equal(herlees(p).potten.length, 2, 'dezelfde idem-sleutel maakt geen tweede nieuwe pot');
  else assert.equal(herlees(p).potten.length, 1);
});

for (const breed of [false, true]) test('duurzame buitenbundel behoudt ' + (breed ? 'globale' : 'expliciete') + ' andere sleutels', async t => {
  const p = setup(t), exec = DatabaseSync.prototype.exec; let commits = 0;
  t.mock.method(DatabaseSync.prototype, 'exec', function(sql) { if (sql === 'COMMIT') commits++; return exec.call(this, sql); });
  await p.bijeen(async () => {
    p.db.data.ander.waarde = 7; breed ? p.save() : p.save(['ander']);
    assert.equal((await zet(p)).ok, true);
    assert.equal(p.lees('ander').waarde, 1);
    assert.equal(p.conn.prepare("SELECT count(*) n FROM kv WHERE key='geldbeleid'").get().n, 0);
  }, { duurzaam: true });
  assert.equal(commits, 1); assert.equal(p.lees('ander').waarde, 7);
  assert.equal(herlees(p).potten.length, 1);
});

test('ontbrekende eigenaar blijft afwezig bij lezen en ongeldige naam; bestaande weigeringen blijven gelijk', async t => {
  const p = setup(t);
  assert.deepEqual(p.g.potten('lid'), []); assert.deepEqual(p.g.grenzen('lid'), []);
  assert.equal(Object.hasOwn(p.db.data, 'geldbeleid'), false); assert.equal(p.scans(), 0);
  p.db.data.ander.waarde = 3;
  assert.equal((await p.g.vast(() => p.g.potZet('', {}))).status, 400);
  assert.equal(Object.hasOwn(p.db.data, 'geldbeleid'), false);
  assert.equal(p.lees('ander').waarde, 3, 'geen aanwezige eigenaar behoudt de bestaande brede fallback');
  const a = await zet(p); assert.equal(a.status, 200);
  assert.equal((await p.g.vast(() => p.g.potZet('lid', { naam: 'Anders', doelCenten: 10000 }, 'pot-1'))).status, 409);
  assert.equal((await p.g.vast(() => p.g.potWeg('lid', 'onbekend'))).status, 404);
  assert.equal(herlees(p).potten.length, 1);
});

test('oude save-interface zonder bestaande behoudt de brede opslagweg', async t => {
  const p = setup(t, true); p.db.data.ander.waarde = 6;
  assert.equal((await zet(p)).ok, true); assert.ok(p.scans() > 0);
  assert.equal(p.lees('ander').waarde, 6); assert.equal(herlees(p).potten.length, 1);
});

test('een echte oude lezer houdt FULL tegen; vrijgave maakt dezelfde pot-herhaling bevestigbaar', async t => {
  const p = setup(t), proto = DatabaseSync.prototype, exec = proto.exec; let writer;
  t.mock.method(proto, 'exec', function(sql) {
    if (this !== p.conn) writer ||= this;
    return exec.call(this, sql);
  });
  const a = await zet(p); assert.ok(writer); exec.call(writer, 'PRAGMA busy_timeout=0');
  p.conn.exec('BEGIN'); assert.equal(p.lees('geldbeleid').perLid.lid.potten[0].standCenten, 0);
  try {
    assert.equal(p.g.potReserveer('lid', a.pot.id, 500, null, 'res-1').ok, true);
    assert.equal((await zet(p)).status, 503, 'NORMAL-write is niet automatisch een FULL-bevestiging');
  } finally { p.conn.exec('ROLLBACK'); }
  assert.equal((await zet(p)).herhaald, true); assert.equal(herlees(p).potten[0].standCenten, 500);
  assert.equal(p.scans(), 0);
});

test('een gewone buitenbundel behoudt haar bestaande niet-duurzame commitmoment', async t => {
  const p = setup(t), proto = DatabaseSync.prototype, exec = proto.exec, prepare = proto.prepare;
  let commits = 0; const checkpoints = [], synchronisatie = [];
  t.mock.method(proto, 'exec', function(sql) {
    if (sql === 'COMMIT') commits++;
    if (/synchronous/i.test(sql)) synchronisatie.push(sql);
    return exec.call(this, sql);
  });
  t.mock.method(proto, 'prepare', function(sql) {
    if (/wal_checkpoint/i.test(sql)) checkpoints.push(sql);
    return prepare.call(this, sql);
  });
  await p.bijeen(async () => {
    p.db.data.ander.waarde = 4; p.save(['ander']);
    assert.equal((await zet(p)).ok, true); assert.equal(commits, 0);
  });
  assert.equal(commits, 1); assert.deepEqual(checkpoints, []);
  assert.equal(synchronisatie.some(s => /FULL/i.test(s)), false);
  assert.equal(p.lees('ander').waarde, 4); assert.equal(herlees(p).potten.length, 1);
});

test('een falende selectieve save wordt niet stil breed herhaald', async t => {
  const p = setup(t); let breed = 0;
  const save = () => { breed++; return p.save(); };
  save.bestaande = () => { throw new Error('selectieve opslag faalt'); };
  const g = require('../server/kern/geldbeleid')({ ...p, save, klok: () => new Date('2026-11-12T12:00:00Z') }).geldbeleid;
  await assert.rejects(g.vast(() => g.potZet('lid', { naam: 'Reis', doelCenten: 1000 })), /selectieve opslag faalt/);
  assert.equal(breed, 0);
  assert.equal(p.conn.prepare("SELECT count(*) n FROM kv WHERE key='geldbeleid'").get().n, 0);
});
