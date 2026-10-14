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

/* EEN KNOP, NIET TWEE (fase 2.3). Er waren er twee: RTG_TEST_MOTOR=webkit voor
   wie zijn browser via startBrowser() start, en RTG_TEST_WEBKIT=1 voor de drie
   toetsen die zelf over de motoren lopen. Wie de ene zette, dacht WebKit aan te
   hebben en had de helft. testMotoren() leest nu dezelfde knop: Chromium blijft
   de referentie, WebKit komt erbij als hij de motor onder toets is. En de oude
   knop wordt niet stil genegeerd -- dan viel WebKit zonder melding weg -- maar
   is een fout die zegt wat ervoor in de plaats kwam. */
test('testMotoren: dezelfde knop als testMotor, en de oude knop is een fout', () => {
  assert.deepEqual(metMotor(undefined, h.testMotoren), ['chromium']);
  assert.deepEqual(metMotor('webkit', h.testMotoren), ['chromium', 'webkit']);
  assert.throws(() => metMotor('firefox', h.testMotoren), /kent alleen chromium en webkit/);
  const oud = process.env.RTG_TEST_WEBKIT;
  process.env.RTG_TEST_WEBKIT = '1';
  try {
    assert.throws(() => metMotor(undefined, h.testMotoren), /RTG_TEST_WEBKIT bestaat niet meer.*RTG_TEST_MOTOR=webkit/);
    assert.throws(() => metMotor('webkit', h.testMotor), /RTG_TEST_WEBKIT bestaat niet meer/);
  } finally { if (oud === undefined) delete process.env.RTG_TEST_WEBKIT; else process.env.RTG_TEST_WEBKIT = oud; }
});

/* MET EEN KNOP DRAAIEN CHROMIUM EN WEBKIT IN DEZELFDE STAND. De zeef voor
   WebKits afbreking hoort dan bij de motor van de PAGINA en niet bij de knop:
   anders slikt een Chromium-pagina in mobile-content dezelfde melding stil in. */
test('letOpFouten: de zeef volgt de motor van de pagina, niet de knop', () => {
  const pagina = (motor) => {
    let luister = null;
    return { on: (s, f) => { if (s === 'pageerror') luister = f; }, url: () => 'http://127.0.0.1:4000/apps/app.html',
      context: () => ({ browser: () => ({ browserType: () => ({ name: () => motor }) }) }), fire: (e) => luister(e) };
  };
  const chromium = pagina('chromium'), webkit = pagina('webkit');
  const fc = [], fw = [];
  h.letOpFouten(chromium, fc); h.letOpFouten(webkit, fw);
  metMotor('webkit', () => { chromium.fire(new Error(EIGEN)); webkit.fire(new Error(EIGEN)); });
  assert.deepEqual(fc, [EIGEN], 'een Chromium-pagina meldt hem niet; doet hij het toch, dan is het een fout');
  assert.deepEqual(fw, []);
  assert.equal(h.afgebrokenIn(fw), 1);
});

/* EEN TOETS MET EEN STRENGERE EIGEN ZEEF (mobile-content laat een afbreking
   alleen toe terwijl hij zelf weg-navigeert) krijgt elke melding ongefilterd
   door; anders zou de algemene zeef hem eerder weghalen dan de strenge hem ziet. */
test('letOpFouten: met eigenZeef komt de afbreking ongefilterd bij de bak', () => {
  let luister = null;
  const page = { on: (s, f) => { if (s === 'pageerror') luister = f; }, url: () => 'http://127.0.0.1:4000/apps/app.html',
    context: () => ({ browser: () => ({ browserType: () => ({ name: () => 'webkit' }) }) }) };
  const gezien = [];
  h.letOpFouten(page, { push: (m) => gezien.push(m) }, { eigenZeef: true });
  metMotor('webkit', () => luister(new Error(EIGEN)));
  assert.deepEqual(gezien, [EIGEN]);
});
