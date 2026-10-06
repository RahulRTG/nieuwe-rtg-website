'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tracker = require('../server/db/mutatietracker');
const effectmeter = require('../server/effectmeter');
const handeling = require('../server/opzet/handeling');

test('nested mutaties wijzen alleen de top-level collectie aan, zonder inhoud', () => {
  const feiten = [];
  const los = tracker.voegWaarnemerToe(f => feiten.push(f));
  const data = tracker.bewaak({ leden: [{ profiel: { naam: 'A' } }], boekingen: [] });
  try {
    data.leden[0].profiel.naam = 'B';
    data.boekingen.push({ id: 'GEHEIM' });
    assert.deepEqual(tracker.snapshot().map(x => x.collectie).sort(), ['boekingen', 'leden']);
    assert.deepEqual([...new Set(feiten.map(x => x.collectie))].sort(), ['boekingen', 'leden']);
    assert.equal(JSON.stringify(feiten).includes('GEHEIM'), false, 'de aanwijzer lekte een rijwaarde');
    assert.equal(data.leden[0], data.leden[0], 'dezelfde rij hoort dezelfde proxy te houden');
  } finally { los(); }
});

test('een oude bevestiging wist een nieuwere mutatie nooit', () => {
  const data = tracker.bewaak({ regels: [] });
  data.regels.push(1);
  const oud = tracker.snapshot();
  data.regels.push(2);
  tracker.bevestig(oud);
  assert.deepEqual(tracker.snapshot().map(x => x.collectie), ['regels']);
  const actueel = tracker.snapshot();
  tracker.bevestig(actueel);
  assert.deepEqual(tracker.snapshot(), []);
});

test('een delete van een afwezige collectie verzint geen tombstone-mutatie', () => {
  const data = tracker.bewaak({ bestaand: [] });
  delete data.nooitBestaan;
  assert.deepEqual(tracker.snapshot(), []);
});

test('diep bevroren bewijs blijft exact serialiseerbaar achter de opslagproxy', () => {
  const bewijs = Object.freeze({ policyDecision: Object.freeze({
    decision: 'ALLOW', reasonCodes: Object.freeze(['POLICY_OK'])
  }) });
  const data = tracker.bewaak({ trustEvidence: [bewijs] });
  assert.equal(JSON.stringify(data),
    '{"trustEvidence":[{"policyDecision":{"decision":"ALLOW","reasonCodes":["POLICY_OK"]}}]}');
  assert.equal(data.trustEvidence[0].policyDecision, bewijs.policyDecision,
    'een vast kind blijft exact gelijk waar de taal-invariant dat vereist');
});

test('opslag serialiseert de actuele target exact zonder de aanwijzer uit te zetten', () => {
  const bron = { regels: [{ id: 1, profiel: { naam: 'A' } }] };
  const data = tracker.bewaak(bron);
  data.regels[0].profiel.naam = 'B';
  data.regels.push({ id: 2, profiel: { naam: 'C' } });
  const voor = tracker.snapshot();
  assert.equal(tracker.serialiseerVoorOpslag(data.regels), JSON.stringify(bron.regels));
  assert.deepEqual(tracker.snapshot(), voor,
    'alleen een geslaagde opslagcommit mag de vuilgeneratie bevestigen');
});

test('effectbon en handeling delen de exacte aanwijzing zonder wereldscan', () => {
  const data = { huidig: tracker.bewaak({ boekingen: [], profiel: { naam: 'A' } }) };
  const luisteraars = {};
  const req = { id: 'corr-tracker', path: '/api/proef', method: 'POST' };
  const res = { on: (naam, fn) => { (luisteraars[naam] = luisteraars[naam] || []).push(fn); } };
  const mw = handeling.middleware({ data: () => data.huidig, log() {} });
  let teller;
  effectmeter.perVerzoek(t => {
    teller = t;
    mw(req, res, () => {
      data.huidig.boekingen.push({ id: 1 });
      data.huidig.profiel.naam = 'B';
    });
  });
  for (const fn of luisteraars.finish || []) fn();
  assert.deepEqual([...teller.collecties].sort(), ['boekingen', 'profiel']);
  assert.deepEqual(req.handeling.wijzigingen,
    [{ collectie: 'boekingen', van: 0, naar: 1, delta: 1 }]);
  assert.equal(req.handeling.voor, null, 'de bewaakte runtime maakte geen volledige begintelling');
});
