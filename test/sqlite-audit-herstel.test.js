'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { spawn } = require('node:child_process');
const path = require('node:path');
const proef = require('./lib/audit-rijen-fixture');
const make = p => require('../server/kern/command/journaal').maakJournaal({ db: p.db, save: p.save, crypto: require('node:crypto'), auditOpslag: p.save.audit.open('apiSpoor') });
const append = actor => `const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();
  const j=require('./server/kern/command/journaal').maakJournaal({db:p.db,save:p.save,crypto:require('crypto'),auditOpslag:p.save.audit.open('apiSpoor')});
  j.noteer({actor:${JSON.stringify(actor)},actie:'extern'});`;

test('stale vervanging blijft geweigerd nadat een poll een nieuwere rijversie heeft gezien', t => {
  const p = proef(t), j = make(p); j.noteer({ actor: 'a', actie: 'een' });
  p.db.data.apiSpoor = JSON.parse(JSON.stringify(p.db.data.apiSpoor));
  p.db.data.apiSpoor.commandJournaal = [];
  const r = p.kind(append('extern')); assert.equal(r.status, 0, r.stderr);
  require('../server/db/sqlite').auditMotor().poll();
  assert.throws(() => p.save(), /verouderd/);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 2);
  assert.equal(p.lees('apiSpoor').commandJournaal.length, 2);
});

test('fout in migratie laat oorspronkelijke KV-data en lege rijtabellen achter; opnieuw openen herstelt', t => {
  const p = proef(t, { handelingLog: [{ at: 'oud' }] });
  const proto = DatabaseSync.prototype, exec = proto.exec; let fail = true;
  const fout = t.mock.method(proto, 'exec', function(sql) { if (sql === 'COMMIT' && fail) { fail = false; throw new Error('migratiefout'); } return exec.call(this, sql); });
  assert.throws(() => p.handeling(), /migratiefout/);
  assert.equal(p.conn.prepare('SELECT COUNT(*) n FROM audit_meta').get().n, 0);
  assert.deepEqual(p.lees('handelingLog'), [{ at: 'oud' }]);
  fout.mock.restore(); p.handeling();
  assert.deepEqual(p.lees('handelingLog'), [{ at: 'oud' }]);
});

test('mislukte privacywissing publiceert geen nieuwe actorvelden, teller of zegels', t => {
  const p = proef(t), j = make(p); j.noteer({ actor: 'a', actie: 'een' });
  const voor = p.lees('apiSpoor'), proto = DatabaseSync.prototype, exec = proto.exec; let fail = true;
  const fout = t.mock.method(proto, 'exec', function(sql) { if (sql === 'COMMIT' && fail) { fail = false; throw new Error('wisfout'); } return exec.call(this, sql); });
  assert.throws(() => j.wisActor('a'), /wisfout/);
  assert.deepEqual(p.lees('apiSpoor'), voor); assert.deepEqual(p.db.data.apiSpoor, voor);
  fout.mock.restore(); assert.equal(j.wisActor('a').geraakt, 1);
  assert.equal(j.controleer().heel, true); assert.equal(j.aantal(), 2);
});

test('rijappend overleeft SIGKILL van uitsluitend zijn eigen synthetische testproces', t => {
  const p = proef(t); make(p);
  const r = p.kind(append('duurzaam') + "process.kill(process.pid,'SIGKILL');");
  assert.equal(r.signal, 'SIGKILL', r.stderr);
  const terug = p.kind(`const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();
    const j=require('./server/kern/command/journaal').maakJournaal({db:p.db,save:p.save,crypto:require('crypto'),auditOpslag:p.save.audit.open('apiSpoor')});
    console.log(JSON.stringify({aantal:j.aantal(),keten:j.controleer(),actor:j.recent(1)[0].actor}));`);
  assert.equal(terug.status, 0, terug.stderr);
  assert.deepEqual(JSON.parse(terug.stdout), { aantal: 1, keten: { heel: true, regels: 1 }, actor: 'duurzaam' });
});

test('twee onafhankelijke gelijktijdige processen produceren één ononderbroken keten', async t => {
  const p = proef(t), j = make(p);
  const run = actor => new Promise((resolve, reject) => {
    const bron = append(actor).replace("j.noteer(", 'for(let i=0;i<12;i++)j.noteer(');
    const child = spawn(process.execPath, ['-e', bron], { cwd: path.join(__dirname, '..'), env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; child.stderr.on('data', b => { err += b; }); child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(err)));
  });
  await Promise.all([run('a'), run('b')]);
  assert.equal(j.aantal(), 24); assert.equal(j.controleer().heel, true);
  const rows = p.lees('apiSpoor').commandJournaal;
  assert.equal(rows.filter(r => r.actor === 'a').length, 12); assert.equal(rows.filter(r => r.actor === 'b').length, 12);
  assert.equal(new Set(rows.map(r => r.id)).size, 24);
});

test('ring snoeit uitsluitend oudste rijen en verlaagt de totale teller niet', t => {
  const regels = Array.from({ length: 5000 }, (_, i) => ({ id: 'oud-' + i, zegel: 'kop-' + i }));
  const p = proef(t, { apiSpoor: { commandJournaal: regels, commandJournaalTotaal: 6000 } }), j = make(p);
  const nieuw = j.noteer({ actor: 'a', actie: 'nieuw' });
  const l = p.lees('apiSpoor'); assert.equal(l.commandJournaal.length, 5000);
  assert.equal(l.commandJournaalTotaal, 6001); assert.equal(l.commandJournaal[0].id, 'oud-1');
  assert.deepEqual(l.commandJournaal.at(-1), nieuw); assert.equal(nieuw.vorig, 'kop-4999');
});

test('append serialiseert de bestaande geschiedenis niet opnieuw', async t => {
  const p = proef(t), j = make(p); p.handeling(); j.noteer({ actor: 'a', actie: 'eerder' });
  const stringify = JSON.stringify; let historie = 0;
  t.mock.method(JSON, 'stringify', function(v, ...rest) {
    if (Array.isArray(v) || v?.commandJournaal) historie++;
    return stringify.call(this, v, ...rest);
  });
  j.noteer({ actor: 'a', actie: 'los' });
  await p.bijeen(() => { j.noteer({ actor: 'a', actie: 'bundel' }); });
  assert.equal(historie, 0, 'alleen nieuwe regel, geen herhaalde volledige audit-JSON');
  assert.equal(j.aantal(), 3); assert.equal(j.controleer().heel, true);
});

test('een gesloten mislukte bundel lekt geen preview of oude wachtrij naar een overgeërfde async-context', async t => {
  const p = proef(t), j = make(p), proto = DatabaseSync.prototype, exec = proto.exec;
  let fail = true, schrijven = false, hervat, later;
  const poort = new Promise(resolve => { hervat = resolve; });
  const fout = t.mock.method(proto, 'exec', function(sql) {
    if (sql === 'BEGIN IMMEDIATE') schrijven = true;
    if (sql === 'COMMIT' && schrijven && fail) { fail = false; throw new Error('bundelfout'); }
    return exec.call(this, sql);
  });
  await assert.rejects(p.bijeen(() => {
    j.noteer({ actor: 'mislukt', actie: 'niet vastgelegd' });
    later = (async () => {
      await poort;
      assert.equal(j.aantal(), 0, 'geen preview buiten de open bundel');
      j.noteer({ actor: 'nieuw', actie: 'wel vastgelegd' });
    })();
  }), /bundelfout/);
  fout.mock.restore(); assert.ok(later, 'de late context is daadwerkelijk aangemaakt'); hervat(); await later;
  assert.deepEqual(p.lees('apiSpoor').commandJournaal.map(r => r.actor), ['nieuw']);
});

test('inlogspoor bewaart alleen zijn eigen keten, weigert commitfouten en overleeft herladen', t => {
  const p = proef(t, { securityLog: [] });
  const { schoon } = require('../server/kern/util');
  const { maakInlogspoor } = require('../server/kern/identiteit/inlogherkomst');
  const spoor = maakInlogspoor({ db: p.db, save: p.save, schoon });
  let vreemd = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { vreemd++; return { waarde: 1 }; } });
  spoor.logInlog('account', 1, ' <user-1> ', { ip: '127.0.0.1' });
  const voor = p.lees('securityLog');
  assert.equal(vreemd, 0, 'een inlog serialiseert geen ander domein');
  assert.equal(voor.length, 1);
  assert.equal(voor[0].wie, 'user-1');
  assert.equal(voor[0].ok, true);
  assert.equal(voor[0].ip, '127.0.0.1');
  assert.equal(spoor.securityLogKeten().ok, true);
  const proto = DatabaseSync.prototype, exec = proto.exec;
  const fout = t.mock.method(proto, 'exec', function(sql) {
    if (sql === 'COMMIT') throw new Error('inlogcommit mislukt');
    return exec.call(this, sql);
  });
  assert.throws(() => spoor.logInlog('account', false, null, {}), /inlogcommit mislukt/);
  assert.deepEqual(p.lees('securityLog'), voor, 'geen gedeeltelijk gecommitteerde keten');
  fout.mock.restore();
  p.db.data = require('../server/db/sqlite').loadSqlite();
  assert.equal(spoor.securityLogKeten().top, voor[0].hash, 'dezelfde lezer volgt de herladen root');
  spoor.logInlog('account', false, null, {});
  const herstart = p.kind(`const p=require('./server/db');
    p.db.data=require('./server/db/sqlite').loadSqlite();
    const s=require('./server/kern/identiteit/inlogherkomst').maakInlogspoor({db:p.db,save:p.save,schoon:require('./server/kern/util').schoon});
    console.log(JSON.stringify({log:p.db.data.securityLog,keten:s.securityLogKeten()}));`);
  assert.equal(herstart.status, 0, herstart.stderr);
  const na = JSON.parse(herstart.stdout);
  assert.deepEqual(na.log, p.lees('securityLog'));
  assert.equal(na.log.length, 2);
  assert.equal(na.log[0].ok, false);
  assert.equal(na.log[0].wie, null);
  assert.equal(na.keten.ok, true);
});

test('inlogspoor leest zonder scheppen en weigert beschadigde bestaande auditdata', () => {
  const db = { data: {} }; let saves = 0;
  const spoor = require('../server/kern/identiteit/inlogherkomst').maakInlogspoor({
    db, save: { sleutels() { saves++; } }, schoon: v => v
  });
  spoor.securityLogKeten();
  assert.equal(Object.hasOwn(db.data, 'securityLog'), false);
  db.data.securityLog = { corrupt: true };
  assert.throws(() => spoor.securityLogKeten(), /niet de verklaarde vorm/);
  assert.throws(() => spoor.logInlog('account', false, null, {}), /niet de verklaarde vorm/);
  assert.deepEqual(db.data.securityLog, { corrupt: true });
  assert.equal(saves, 0);
});
