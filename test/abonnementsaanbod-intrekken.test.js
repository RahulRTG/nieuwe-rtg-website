'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, body, tekenen, kopie } = require('./abonnementsaanbod-fixture.cjs');
const ref = r => ({ contractId: r.contract.id, aanbodHash: r.contract.aanbod.hash });

test('eigen onbetaald voorstel intrekken geeft credit vrij zonder een bestaande afspraak te wijzigen', async () => {
  const bestaand = { id: 'oud', status: 'ACTIEF', afgesprokenCenten: 1234 };
  const f = fixture({ contracten: [bestaand] }), r = await f.motor.aanbod(1, body());
  assert.equal((await f.motor.intrekken(2, ref(r))).status, 404);
  assert.equal((await f.motor.intrekken(1, { ...ref(r), aanbodHash: 'anders' })).status, 409);
  const ingetrokken = await f.motor.intrekken(1, ref(r));
  assert.equal(ingetrokken.ok, true); assert.equal(ingetrokken.contract.status, 'GEEINDIGD');
  assert.equal(ingetrokken.contract.verrekening.status, 'VRIJGEGEVEN');
  assert.deepEqual(f.db.data.contracten.find(c => c.id === 'oud'), bestaand);
  const voor = kopie(f.db.data);
  assert.equal((await f.motor.intrekken(1, ref(r))).herhaald, true); assert.deepEqual(f.db.data, voor);
  assert.equal((await f.motor.aanbod(1, body())).ok, true);
});

test('ondertekend maar niet gestart voorstel kan stoppen; de oorspronkelijke ontvangst blijft bestaan', async () => {
  const f = fixture(), r = await f.motor.aanbod(1, body()); await f.motor.teken(1, tekenen(r));
  const ontvangst = kopie(f.db.data.onboarding);
  assert.equal((await f.motor.intrekken(1, ref(r))).ok, true);
  assert.deepEqual(f.db.data.onboarding, ontvangst);
});

test('iedere betaaltermijn, setup, betaalwaarheid of activering blokkeert vrijgeven', async () => {
  for (const verander of [
    (f, c) => { f.db.data.lidmaatschapBetalingen = [{ contractId: c.id, termijnen: [{ nr: 1, status: 'open' }] }]; },
    (f, c) => { f.db.data.betaalWaarheid = { b1: { context: { contractId: c.id }, status: 'MISLUKT' } }; },
    (_f, c) => { c.setup = { providerId: null }; },
    (_f, c) => { c.activering = { rechtenAt: null }; },
    (_f, c) => { c.status = 'ACTIEF'; }
  ]) {
    const f = fixture(), r = await f.motor.aanbod(1, body()), c = f.db.data.contracten[0]; verander(f, c);
    const voor = kopie(f.db.data);
    assert.equal((await f.motor.intrekken(1, ref(r))).status, 409); assert.deepEqual(f.db.data, voor);
  }
});

test('betaalstart juist vóór het collectieslot en een commitfout worden nooit als intrekking bevestigd', async () => {
  const f = fixture(), r = await f.motor.aanbod(1, body());
  f.stand.voorSlot = () => { f.db.data.betaalWaarheid = { gestart: { context: { contractId: r.contract.id } } }; };
  assert.equal((await f.motor.intrekken(1, ref(r))).status, 409);
  assert.equal(f.db.data.contracten[0].status, 'AANGEBODEN');
  delete f.stand.voorSlot; delete f.db.data.betaalWaarheid;
  const voor = kopie(f.db.data); f.stand.saveFout = true;
  assert.equal((await f.motor.intrekken(1, ref(r))).status, 503); assert.deepEqual(f.db.data, voor);
});
