'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const tracker = require('../server/db/mutatietracker');
const { maakStore } = require('../server/kern/bewijsvlak/v3-store');
const { maakLedger } = require('../server/kern/bewijsvlak/ledger');

for (const bewaakt of [false, true]) {
  test('store herstelt RAM na savefout, tracker=' + bewaakt, () => {
    const raw = { trustEvidence: { v3: {} } }, data = bewaakt ? tracker.bewaak(raw) : raw;
    const store = maakStore({ stateFor: () => data.trustEvidence.v3,
      save() { throw new Error('opslag geweigerd'); } });
    assert.throws(() => store.put('evidence', 'e1', { id: 'e1', waarde: 1 }), /opslag geweigerd/);
    assert.equal(store.get('evidence', 'e1'), null);
    assert.deepEqual(raw.trustEvidence.v3.evidence, {});
  });
  test('ledger herstelt RAM na savefout, tracker=' + bewaakt, () => {
    const raw = { trustEvidence: { ledger: [] } }, data = bewaakt ? tracker.bewaak(raw) : raw;
    const ledger = maakLedger({ regelsFor: () => data.trustEvidence.ledger,
      save() { throw new Error('opslag geweigerd'); } });
    assert.throws(() => ledger.append({ boundary: 'test', evidenceRecordId: 'e1' }), /opslag geweigerd/);
    assert.deepEqual(raw.trustEvidence.ledger, []);
  });
}

test('rollback verwijdert geen vervangend store-record of nieuwere ledgerregel', () => {
  const data = tracker.bewaak({ trustEvidence: { v3: {}, ledger: [] } });
  const vervanging = { id: 'e1', waarde: 'ander' };
  const store = maakStore({ stateFor: () => data.trustEvidence.v3,
    save() { data.trustEvidence.v3.evidence.e1 = vervanging; throw new Error('fout'); } });
  assert.throws(() => store.put('evidence', 'e1', { id: 'e1', waarde: 1 }), /fout/);
  assert.deepEqual(store.get('evidence', 'e1'), vervanging);
  const nieuw = { evidenceRecordId: 'e2', boundary: 'test' };
  const ledger = maakLedger({ regelsFor: () => data.trustEvidence.ledger,
    save() { data.trustEvidence.ledger.push(nieuw); throw new Error('fout'); } });
  assert.throws(() => ledger.append({ boundary: 'test', evidenceRecordId: 'e1' }), /fout/);
  assert.deepEqual(data.trustEvidence.ledger.at(-1), nieuw);
  assert.equal(data.trustEvidence.ledger.length, 2);
});
