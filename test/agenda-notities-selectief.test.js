'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const proef = require('./lib/audit-rijen-fixture');

test('agenda en notities bewaren hun hele keten zonder vreemde collecties te scannen', async t => {
  const p = proef(t, { agendas: {}, notities: {} });
  const deps = { ...p, crypto: require('node:crypto'), codenaamVan: k => k,
    keyVanCodenaam: async k => ({ key: k }), sseToCustomer() {},
    boekingenVanKlant: () => [], reserveringenVanKlant: () => [] };
  const basis = require('../server/kern/agenda').maakAgenda(deps);
  const pro = require('../server/kern/agenda-pro').maakAgendaPro(deps);
  const notities = require('../server/kern/notities').maakNotities(deps, pro);
  let scans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() {
    scans++; return { waarde: this.waarde };
  } });
  const exec = DatabaseSync.prototype.exec, commits = [];
  t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
    if (sql === 'COMMIT') commits.push(this.prepare('PRAGMA synchronous').get().synchronous);
    return exec.call(this, sql);
  });
  const a = await basis.voegToe('lid:a', { titel: 'Basis', datum: '2030-01-02' });
  assert.equal(a.ok, true);
  await basis.wijzig('lid:a', { id: a.item.id, titel: 'Gewijzigd' });
  assert.equal(p.lees('agendas')['lid:a'][0].titel, 'Gewijzigd');
  await basis.verwijder('lid:a', a.item.id);
  assert.deepEqual(p.lees('agendas')['lid:a'], []);

  const afspraak = await pro.bewaarAfspraak('lid:a', { titel: 'Samen', datum: '2030-01-02' });
  assert.equal((await pro.nodigUit('lid:a', afspraak.id, 'b')).ok, true);
  const kopie = p.lees('agendas')['lid:b'][0];
  assert.equal((await pro.antwoordUitnodiging('lid:b', kopie.id, true)).ok, true);
  assert.equal(p.lees('agendas')['lid:a'][0].deelnemers[0].status, 'ja');
  await pro.bewaarAfspraak('lid:a', { id: afspraak.id, titel: 'Verplaatst', datum: '2030-01-03' });
  assert.equal(p.lees('agendas')['lid:b'][0].datum, '2030-01-03');
  await pro.verwijder('lid:a', afspraak.id);
  assert.deepEqual(p.lees('agendas')['lid:b'], []);

  commits.length = 0;
  const n = await notities.notitiesBewaar('a', { titel: 'Ophalen', herinnerOp: '2030-01-04', herinnerTijd: '10:00' });
  assert.equal(n.ok, true);
  assert.deepEqual(commits, [2], 'notitie en herinnering delen één FULL-commit');
  const bewaard = p.lees('notities')['lid:a'][0];
  assert.equal(p.lees('agendas')['lid:a'][0].id, bewaard.agendaId);
  assert.equal((await notities.notitiesDeel('a', n.id, 'b', true)).ok, true);
  assert.deepEqual(p.lees('notities')['lid:a'][0].gedeeldMet, ['b']);
  assert.equal((await notities.notitiesWeg('b', n.id)).ok, true);
  assert.deepEqual(p.lees('notities')['lid:a'][0].gedeeldMet, []);
  commits.length = 0;
  await notities.notitiesWeg('a', n.id);
  assert.deepEqual(commits, [2]);
  assert.deepEqual(p.lees('notities')['lid:a'], []);
  assert.deepEqual(p.lees('agendas')['lid:a'], []);
  const lijst = await notities.notitiesBewaar('a', { soort: 'lijst', items: [{ t: 'Paspoort' }] });
  await notities.notitiesVink('a', lijst.id, 0, true);
  assert.equal(p.lees('notities')['lid:a'][0].items[0].af, true);
  assert.equal(scans, 0, 'andere domeinen worden niet opnieuw geserialiseerd');
});
