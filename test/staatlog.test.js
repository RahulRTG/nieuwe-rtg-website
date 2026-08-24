/* DE STAATMETER: heeft een verzoek de opslag veranderd? (TAKEN.md 4.30)

   De idempotentieproef keek alleen naar het ANTWOORD, en liep daarop vast: een
   route die bij elke oproep hetzelfde teruggeeft, verraadt van buitenaf niet of
   hij twee keer heeft gewerkt. server/staatlog.js levert het tweede meetpunt --
   de lengte per collectie, als antwoordkop, alleen met RTG_STAATLOG=1.

   Wat hier het zwaarst weegt is `verschil()` met een negeerlijst. Zonder die
   lijst zou dit meetpunt meteen blind zijn: `doorgeefjournaal` schrijft een
   regel per verzoek, ook bij lezen, dus élke oproep zou "werk gedaan" lijken.
   Dat is gemeten en het was de eerste vorm die niet werkte.

   Draai los: node --test test/staatlog.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const staatlog = require('../server/staatlog');

test('lees(): de kop wordt weer een map', () => {
  assert.deepEqual(staatlog.lees('orders=3,leden=12'), { orders: 3, leden: 12 });
  assert.deepEqual(staatlog.lees(''), {}, 'een lege kop is een lege stand, geen fout');
  assert.deepEqual(staatlog.lees(null), {}, 'en een ontbrekende kop ook niet');
});

test('lees(): een collectienaam met een = erin gaat niet stuk', () => {
  // gesplitst op de LAATSTE =, want de naam is van ons en de waarde is een getal
  assert.deepEqual(staatlog.lees('raar=naam=7'), { 'raar=naam': 7 });
});

test('verschil(): alleen wat echt bewoog, met de richting erbij', () => {
  assert.deepEqual(staatlog.verschil('a=1,b=2', 'a=1,b=2'), {}, 'niets bewogen');
  assert.deepEqual(staatlog.verschil('a=1', 'a=3'), { a: 2 }, 'twee erbij');
  assert.deepEqual(staatlog.verschil('a=3', 'a=1'), { a: -2 }, 'en eraf telt ook');
  assert.deepEqual(staatlog.verschil('', 'nieuw=1'), { nieuw: 1 }, 'een collectie die er nog niet was');
});

test('verschil(): de geijkte ruis blijft eruit -- anders is de meter meteen blind', () => {
  /* `doorgeefjournaal` groeit bij ELK verzoek, ook bij lezen. Zonder deze
     uitsluiting zou elke oproep eruitzien alsof er werk is gedaan, en dan meet
     dit meetpunt niets meer dan "er is een verzoek geweest". */
  const negeer = new Set(['doorgeefjournaal']);
  assert.deepEqual(staatlog.verschil('orders=1,doorgeefjournaal=10', 'orders=1,doorgeefjournaal=11', negeer), {},
    'alleen de ruis bewoog: dat telt niet als werk');
  assert.deepEqual(staatlog.verschil('orders=1,doorgeefjournaal=10', 'orders=2,doorgeefjournaal=11', negeer), { orders: 1 },
    'maar echt werk naast de ruis wordt wel gezien');
});

test('stand(): zonder opslag geeft hij een lege stand en geen fout', () => {
  // in deze toets is er geen geladen database; dat mag geen uitzondering geven
  assert.equal(typeof staatlog.stand(), 'string');
});

test('DE POORT: zonder RTG_STAATLOG doet de module niets', () => {
  /* Dit hoort in de proef en niet in productie. De haak moet dus weigeren
     zolang de vlag niet aanstaat -- en dat is te zien, niet te geloven. */
  staatlog.begin('');
  let gehaakt = 0;
  const nepApp = { use() { gehaakt++; } };
  assert.equal(staatlog.haak(nepApp), false, 'geen haak zonder vlag');
  assert.equal(gehaakt, 0, 'en er is niets aan de keten toegevoegd');

  staatlog.begin('1');
  assert.equal(staatlog.haak(nepApp), true, 'met de vlag wel');
  assert.equal(gehaakt, 1);
  staatlog.begin('');   // de proef laat de vlag niet aan staan voor de volgende toets
});

test('haak(): zet de kop op het antwoord, en breekt res.json niet', () => {
  staatlog.begin('1');
  let middleware = null;
  staatlog.haak({ use(fn) { middleware = fn; } });
  assert.equal(typeof middleware, 'function');

  const koppen = {};
  let doorgegeven = null;
  const res = { headersSent: false, setHeader(k, v) { koppen[k] = v; }, json(x) { doorgegeven = x; return 'origineel'; } };
  middleware({}, res, () => {});
  const uit = res.json({ ok: true });
  assert.equal(typeof koppen['X-RTG-Staat'], 'string', 'de kop staat er');
  assert.deepEqual(doorgegeven, { ok: true }, 'het antwoord gaat ongewijzigd door');
  assert.equal(uit, 'origineel', 'en de teruggaafwaarde ook');
  staatlog.begin('');
});
