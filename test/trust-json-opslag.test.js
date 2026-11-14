'use strict';
/* Echte SQLite en tweede lezer. De cache wijzigt alleen JSON-opbouw: geen
   andere commit, reikwijdte, publicatie of herstartsemantiek. */
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const proef = require('./lib/audit-rijen-fixture');

function setup(t, enc = '') {
  const p = proef(t, { trustEvidence: { ledger: [], v3: {}, metrics: {} } }, enc);
  const { maakStore } = require('../server/kern/bewijsvlak/v3-store');
  const { maakLedger } = require('../server/kern/bewijsvlak/ledger');
  const { maakCoordinator } = require('../server/kern/bewijsvlak/v3-transaction');
  const transaction = maakCoordinator({ rootFor: () => p.db.data.trustEvidence,
    save() { assert.equal(p.saveDuurzaam(['trustEvidence']).duurzaam, true); } });
  const store = maakStore({ stateFor: () => p.db.data.trustEvidence.v3, transaction });
  const ledger = maakLedger({ regelsFor: () => p.db.data.trustEvidence.ledger, transaction,
    nu: () => '2026-11-12T00:00:00.000Z' });
  const voegToe = id => {
    store.put('evidence', id, { id, value: { tekst: 'bewijs '.repeat(200), n: 1 } });
    ledger.append({ boundary: 'trust:opslag', evidenceRecordId: id, inputHash: 'hash-' + id });
  };
  const leesTekst = () => p.kluis.ontsleutel(p.conn.prepare('SELECT val FROM kv WHERE key=?').get('trustEvidence').val);
  const tracker = require('../server/db/mutatietracker');
  const verwacht = () => tracker.serialiseerVoorOpslag(p.db.data.trustEvidence);
  const exec = DatabaseSync.prototype.exec, prepare = DatabaseSync.prototype.prepare, sql = [];
  t.mock.method(DatabaseSync.prototype, 'exec', function(tekst) {
    if (this !== p.conn) sql.push({ tekst, mode: prepare.call(this, 'PRAGMA synchronous').get().synchronous });
    return exec.call(this, tekst);
  });
  return { ...p, transaction, store, ledger, voegToe, leesTekst, verwacht, tracker, sql };
}

for (const enc of ['', 'trust-json-test-key']) {
  test('normale en FULL-save zijn byte-identiek, cache geraakt, encryptie=' + Boolean(enc), t => {
    const p = setup(t, enc), cache = require('../server/lib/immutable-json');
    const hook = t.mock.method(cache, 'serialiseer');
    p.voegToe('eerste'); const verwacht = p.verwacht();
    p.db.data.ander.waarde = 99;
    p.save.sleutels(['trustEvidence']);
    assert.equal(hook.mock.callCount(), 1, 'de echte saveplan kiest de gecertificeerde serializer');
    assert.equal(p.leesTekst(), verwacht);
    assert.equal(p.lees('ander').waarde, 1, 'gerichte opslag flusht geen vreemde mutatie');
    assert.deepEqual(p.sql.filter(x => x.tekst === 'COMMIT').map(x => x.mode), [1]);
    p.voegToe('tweede'); const verwachtVol = p.verwacht(); p.sql.length = 0;
    assert.equal(p.saveDuurzaam(['trustEvidence']).duurzaam, true);
    assert.equal(hook.mock.callCount(), 2);
    assert.equal(p.leesTekst(), verwachtVol);
    assert.deepEqual(p.sql.filter(x => x.tekst === 'COMMIT').map(x => x.mode), [2]);
    assert.equal(p.lees('ander').waarde, 1);
    assert.equal(p.ledger.verify('trust:opslag').ok, true);
  });
}

test('mislukte FULL-COMMIT bevestigt geen generatie en retry bewaart de actuele toestand', t => {
  const p = setup(t); p.voegToe('eerste'); p.save.sleutels(['trustEvidence']);
  const oud = p.leesTekst(), stand = p.persistentieStand();
  p.voegToe('tweede');
  const exec = DatabaseSync.prototype.exec; let geraakt = 0;
  const hook = t.mock.method(DatabaseSync.prototype, 'exec', function(tekst) {
    if (this !== p.conn && tekst === 'COMMIT' && geraakt++ === 0) throw new Error('gerichte-commitfout');
    return exec.call(this, tekst);
  });
  assert.throws(() => p.saveDuurzaam(['trustEvidence']), /gerichte-commitfout/);
  assert.equal(geraakt, 1);
  assert.equal(p.leesTekst(), oud);
  assert.equal(p.persistentieStand(), stand);
  assert.ok(p.tracker.snapshot().some(x => x.collectie === 'trustEvidence'));
  hook.mock.restore();
  p.db.data.trustEvidence.metrics.naFout = 7;
  assert.equal(p.saveDuurzaam(['trustEvidence']).duurzaam, true);
  assert.equal(p.leesTekst(), p.verwacht());
  assert.equal(p.lees('trustEvidence').ledger.length, 2);
  assert.equal(p.tracker.snapshot().some(x => x.collectie === 'trustEvidence'), false);
});

test('de echte coordinator rolt gecertificeerde records terug na een opslagfout', t => {
  const p = setup(t);
  p.transaction.atomic('eerste', () => p.voegToe('eerste'));
  const oud = p.leesTekst(), exec = DatabaseSync.prototype.exec;
  const hook = t.mock.method(DatabaseSync.prototype, 'exec', function(tekst) {
    if (this !== p.conn && tekst === 'COMMIT') throw new Error('gerichte-coordinatorfout');
    return exec.call(this, tekst);
  });
  assert.throws(() => p.transaction.atomic('tweede', () => p.voegToe('tweede')), /gerichte-coordinatorfout/);
  hook.mock.restore();
  assert.equal(p.leesTekst(), oud);
  assert.equal(p.verwacht(), oud, 'RAM-rollback laat geen gecachet bewijs in de huidige root achter');
  assert.equal(p.store.get('evidence', 'tweede'), null);
  assert.equal(p.ledger.verify('trust:opslag').ok, true);
  assert.equal(p.transaction.snapshot().acceptingWrites, false, 'cache omzeilt de incidentpoort niet');
});

test('herstart laadt veranderlijke records en een nieuwe root gebruikt geen oude fragmenten', t => {
  const p = setup(t);
  p.transaction.atomic('eerste', () => p.voegToe('eerste'));
  const kind = p.kind(`const assert=require('node:assert/strict'),p=require('./server/db');
    p.db.data=require('./server/db/sqlite').loadSqlite();
    const record=p.db.data.trustEvidence.v3.evidence.eerste;
    assert.equal(Object.isFrozen(record),false);record.value.n=42;
    assert.equal(p.saveDuurzaam(['trustEvidence']).duurzaam,true);`);
  assert.equal(kind.status, 0, kind.stderr);
  assert.equal(p.lees('trustEvidence').v3.evidence.eerste.value.n, 42);
  p.db.data = require('../server/db/sqlite').loadSqlite();
  p.db.data.trustEvidence.v3.evidence.eerste.value.n = 43;
  p.voegToe('tweede'); p.save.sleutels(['trustEvidence']);
  assert.equal(p.leesTekst(), p.verwacht());
  assert.equal(p.lees('trustEvidence').v3.evidence.eerste.value.n, 43);
  assert.equal(p.lees('trustEvidence').ledger.length, 2);
});
