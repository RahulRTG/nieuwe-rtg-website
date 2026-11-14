'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tracker = require('../server/db/mutatietracker');
const { maakStore } = require('../server/kern/bewijsvlak/v3-store');
const { maakLedger } = require('../server/kern/bewijsvlak/ledger');

function opzet() {
  const root = { ledger: [], v3: {}, metrics: {} };
  const data = tracker.bewaak({ trustEvidence: root });
  const store = maakStore({ stateFor: () => data.trustEvidence.v3 });
  const ledger = maakLedger({ regelsFor: () => data.trustEvidence.ledger, nu: () => '2026-11-12T00:00:00.000Z' });
  const voegToe = i => {
    store.put('evidence', 'e' + i, { id: 'e' + i, nested: { tekst: 'bewijs '.repeat(80), n: i } });
    ledger.append({ boundary: 'trust:proef', evidenceRecordId: 'r' + i, inputHash: 'hash' + i });
  };
  return { root, data, store, ledger, voegToe };
}

test('opslag hergebruikt alleen gecertificeerde records van de echte Trust-schrijvers', () => {
  const { root, data, voegToe } = opzet();
  for (let i = 0; i < 600; i++) voegToe(i);
  const verwacht = JSON.stringify(root);
  assert.equal(tracker.serialiseerVoorOpslag(data.trustEvidence, 'trustEvidence'), verwacht,
    'eerste opslag materialiseert de gecertificeerde fragmenten');
  const native = JSON.stringify, objectAanroepen = [];
  let tekst;
  try {
    JSON.stringify = function(v, ...rest) {
      if (v && typeof v === 'object') objectAanroepen.push(v);
      return native(v, ...rest);
    };
    tekst = tracker.serialiseerVoorOpslag(data.trustEvidence, 'trustEvidence');
  } finally { JSON.stringify = native; }
  assert.equal(tekst, verwacht, 'byte-identiek aan de actuele native toestand');
  assert.equal(objectAanroepen.length, 0, 'geen reeds gecertificeerde record-subtree opnieuw serialiseren');
  voegToe(601);
  assert.equal(tracker.serialiseerVoorOpslag(data.trustEvidence, 'trustEvidence'), JSON.stringify(root));
  delete data.trustEvidence.v3.evidence.e0;
  data.trustEvidence.v3.evidence.e1 = { nieuw: true };
  assert.equal(tracker.serialiseerVoorOpslag(data.trustEvidence, 'trustEvidence'), JSON.stringify(root));
  data.trustEvidence = JSON.parse(JSON.stringify(root));
  data.trustEvidence.v3.evidence.e2.nested.n = 12345;
  assert.equal(tracker.serialiseerVoorOpslag(data.trustEvidence, 'trustEvidence'), JSON.stringify(data.trustEvidence));
});

test('geneste trackerproxy behoudt native get-gedrag bij volledige fallback', () => {
  function maak() {
    let reads = 0;
    const child = { x: 1 };
    Object.defineProperty(child, tracker.NIET_VOLGEN, {
      get() { reads++; child.x++; return false; }
    });
    const raw = { source: { child }, trustEvidence: {} };
    const data = tracker.bewaak(raw);
    data.trustEvidence.holder = { nested: data.source };
    return { raw, data, reads: () => reads };
  }
  const oud = maak(); const verwacht = JSON.stringify(oud.raw.trustEvidence);
  const nieuw = maak();
  assert.equal(tracker.serialiseerVoorOpslag(nieuw.data.trustEvidence, 'trustEvidence'), verwacht);
  assert.equal(nieuw.reads(), oud.reads()); assert.equal(nieuw.reads(), 1);
});
