'use strict';
/* Audit P1-4: een gebroken auditspoor is een BEVINDING voor het alarm, geen
   stille 409. Twee wegen erheen: de periodieke ronde over alle journalen
   (ook als niemand schrijft) en de requestmerge die een gebroken keten tegenkomt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const keten = require('../server/lib/keten');
const wacht = require('../server/lib/auditwacht');
const { mergeHandeling } = require('../server/pg/verzoeksporen');

const rij = n => { const l = []; for (let i = 0; i < n; i++) keten.noteerIn(l, { at: 'a' + i, wat: 'w' + i }, 0); return l; };

test('de ronde loopt ALLE journalen na en wijst een gestripte hash aan', () => {
  wacht._wis();
  const vak = {};
  const j = require('../server/kern/command/journaal').maakJournaal({ db: { data: {} }, save() {}, crypto, vak: () => vak });
  j.noteer({ actor: 'a', actie: 'een' }); j.noteer({ actor: 'a', actie: 'twee' });
  const db = { data: { handelingLog: rij(5), inzageLog: rij(3), securityLog: rij(2),
    apiSpoor: { commandJournaal: vak.commandJournaal }, commandJournaal: [] } };
  const goed = wacht.controleer(db);
  assert.deepEqual(Object.keys(goed).sort(), ['apiSpoor', 'commandJournaal', 'handelingLog', 'inzageLog', 'securityLog']);
  assert.ok(Object.values(goed).every(x => x.ok));
  assert.equal(wacht.bevinding(), null);
  const r = { ...db.data.handelingLog[2], wat: 'vervalst' }; delete r.hash; db.data.handelingLog[2] = r;
  db.data.apiSpoor.commandJournaal[0].actie = 'vervalst';
  const uit = wacht.controleer(db);
  assert.equal(uit.handelingLog.ok, false); assert.equal(uit.apiSpoor.ok, false);
  assert.match(wacht.bevinding(), /handelingLog/); assert.match(wacht.bevinding(), /apiSpoor/);
  /* Hersteld (uit een back-up) is weer heel, en de bevinding verdwijnt. */
  db.data.handelingLog = rij(5); db.data.apiSpoor.commandJournaal = [];
  wacht.controleer(db);
  assert.equal(wacht.bevinding(), null);
});

test('de requestmerge meldt een gebroken database-keten met een eigen code, niet als conflict', () => {
  wacht._wis();
  const basis = rij(3), ons = basis.map(x => ({ ...x }));
  keten.noteerIn(ons, { at: 'nieuw', wat: 'ons' }, 0);
  const hun = basis.map(x => ({ ...x })); hun[1] = { ...hun[1], wat: 'vervalst' };
  assert.throws(() => mergeHandeling(basis, ons, hun), e => e.code === 'PG_AUDIT_KETEN_GEBROKEN' && e.journaal === 'handelingLog');
  assert.match(wacht.bevinding(), /handelingLog \(requestmerge\/database/);
});

test('een al gecommitte regel komt er bij een gelijktijdige merge niet twee keer in', () => {
  const basis = rij(2);
  const ons = basis.map(x => ({ ...x })), hun = basis.map(x => ({ ...x }));
  const gedeeld = { at: 'zelfde', wat: 'voorregel', verzoek: 'r1' };
  keten.noteerIn(ons, gedeeld, 0); keten.noteerIn(ons, { at: 'eind', wat: 'eindregel', verzoek: 'r1' }, 0);
  keten.noteerIn(hun, gedeeld, 0); keten.noteerIn(hun, { at: 'vast', wat: 'vastgelegd', verzoek: 'r1' }, 0);
  const samen = mergeHandeling(basis, ons, hun);
  assert.equal(samen.filter(r => r.wat === 'voorregel').length, 1);
  assert.equal(samen.length, 5);
  assert.equal(keten.verifieer(samen).ok, true);
});
