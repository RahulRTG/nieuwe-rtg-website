/* DE WEBKIT-STAND VAN DE BROWSERTOETSEN (test/helper.js, fase 2 van CONSOLIDATIE.md).

   testMotor() kent precies twee motoren en noemt een andere een fout;
   afbrekingsTekst() herkent alleen WebKits melding voor een afgebroken verzoek
   naar de EIGEN origin; en webkitAfbreking() laat die melding alleen in
   WebKit-stand buiten de fouten. Draai los: node --test test/webkitstand.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helper');

function metMotor(m, werk) {
  const oud = process.env.RTG_TEST_MOTOR;
  if (m === undefined) delete process.env.RTG_TEST_MOTOR; else process.env.RTG_TEST_MOTOR = m;
  try { return werk(); } finally { if (oud === undefined) delete process.env.RTG_TEST_MOTOR; else process.env.RTG_TEST_MOTOR = oud; }
}
const EIGEN = 'Fetch API cannot load http://127.0.0.1:4000/api/comm/inbox due to access control checks.';

test('testMotor: standaard chromium, webkit op verzoek, en een onbekende motor is een fout', () => {
  assert.equal(metMotor(undefined, h.testMotor), 'chromium');
  assert.equal(metMotor(' WebKit ', h.testMotor), 'webkit');
  assert.throws(() => metMotor('firefox', h.testMotor), /kent alleen chromium en webkit/);
});

test('afbrekingsTekst: alleen de eigen origin, alleen in precies die vorm', () => {
  assert.equal(h.afbrekingsTekst(EIGEN, '127.0.0.1:4000'), true);
  assert.equal(h.afbrekingsTekst('Fetch API cannot load https://elders.test/x due to access control checks.', '127.0.0.1:4000'), false, 'een vreemde origin blijft een fout');
  assert.equal(h.afbrekingsTekst('TypeError: Load failed', '127.0.0.1:4000'), false, 'een echte netwerkfout blijft een fout');
  assert.equal(h.afbrekingsTekst(EIGEN, ''), false);
});

test('webkitAfbreking: alleen in WebKit-stand telt de afbreking niet als fout', () => {
  assert.equal(metMotor('webkit', () => h.webkitAfbreking(EIGEN, 'http://127.0.0.1:4000')), true);
  assert.equal(metMotor(undefined, () => h.webkitAfbreking(EIGEN, 'http://127.0.0.1:4000')), false, 'Chromium meldt hem niet, dus daar is hij een echte fout');
  assert.equal(metMotor('webkit', () => h.webkitAfbreking(EIGEN, 'http://127.0.0.1:5000')), false, 'een andere poort is een andere origin');
});

/* DE TELLING STAAT NAAST DE BAK, NIET EROP. Run 38331448632 zag paytegoed en
   reisschermen zakken op `[ afgebroken: 13 ]` tegen `[]`: een lijst zonder een
   enkele fout, maar met een eigenschap erop, en deepEqual kijkt ook daarnaar. */
test('letOpFouten: een WebKit-afbreking wordt geteld en laat de foutenlijst leeg', () => {
  let luister = null;
  const page = { on: (soort, f) => { if (soort === 'pageerror') luister = f; }, url: () => 'http://127.0.0.1:4000/apps/app.html' };
  const fouten = [];
  h.letOpFouten(page, fouten);
  metMotor('webkit', () => { luister(new Error(EIGEN)); luister(new Error(EIGEN)); });
  assert.deepEqual(fouten, [], 'twee afbrekingen, nul fouten -- en deepEqual ziet niets anders dan een lege lijst');
  assert.equal(h.afgebrokenIn(fouten), 2);
  metMotor('webkit', () => luister(new Error('TypeError: Load failed')));
  assert.deepEqual(fouten, ['TypeError: Load failed'], 'een echte netwerkfout blijft een fout');
  metMotor(undefined, () => luister(new Error(EIGEN)));
  assert.equal(fouten.length, 2, 'in Chromium-stand is dezelfde melding wel een fout');
  assert.equal(h.afgebrokenIn([]), 0);
});
