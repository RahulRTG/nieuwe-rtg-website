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
  assert.deepEqual(staatlog.lees('orders=3,leden=12'), { orders: { n: 3, h: null }, leden: { n: 12, h: null } });
  assert.deepEqual(staatlog.lees('orders=3:aabbccdd'), { orders: { n: 3, h: 'aabbccdd' } }, 'stand 2 draagt ook de afdruk');
  assert.deepEqual(staatlog.lees(''), {}, 'een lege kop is een lege stand, geen fout');
  assert.deepEqual(staatlog.lees(null), {}, 'en een ontbrekende kop ook niet');
});

test('lees(): een collectienaam met een = erin gaat niet stuk', () => {
  // gesplitst op de LAATSTE =, want de naam is van ons en de waarde is een getal
  assert.deepEqual(staatlog.lees('raar=naam=7'), { 'raar=naam': { n: 7, h: null } });
});

test('verschil(): alleen wat echt bewoog, met de richting erbij', () => {
  assert.deepEqual(staatlog.verschil('a=1,b=2', 'a=1,b=2'), {}, 'niets bewogen');
  assert.deepEqual(staatlog.verschil('a=1', 'a=3'), { a: 2 }, 'twee erbij');
  assert.deepEqual(staatlog.verschil('a=3', 'a=1'), { a: -2 }, 'en eraf telt ook');
  assert.deepEqual(staatlog.verschil('', 'nieuw=1'), { nieuw: 1 }, 'een collectie die er nog niet was');
});

/* ---------------------------------------------------------------------------
   STAND 2: DE WIJZIGING OP ZIJN PLAATS

   Hier hield stand 1 op, en dat stond als grens in de kop van staatlog.js: een
   status van 'open' naar 'betaald' zetten verandert geen enkele lengte. Voor de
   creatie-routes was dat geen bezwaar, maar het liet elke route die alleen
   BIJWERKT op "geen verschil gezien" staan -- en dat is precies de groep die na
   4.30 nog ongemeten was.
   --------------------------------------------------------------------------- */
test('STAND 2: gelijke lengte, andere inhoud is ook een verandering', () => {
  assert.deepEqual(staatlog.verschil('passen=2:aaaaaaaa', 'passen=2:bbbbbbbb'), { passen: 'gewijzigd' },
    'het veld eronder is veranderd terwijl de lengte gelijk bleef');
  assert.deepEqual(staatlog.verschil('passen=2:aaaaaaaa', 'passen=2:aaaaaaaa'), {},
    'twee keer dezelfde waarde zetten is GEEN verandering -- en dat is de hele winst');
});

test('STAND 2: de lengte gaat voor op de afdruk', () => {
  /* Groeit een collectie EN verandert de inhoud, dan is "er is er een bij
     gekomen" het bruikbare feit; "gewijzigd" zou dat verbergen. */
  assert.deepEqual(staatlog.verschil('orders=1:aaaa', 'orders=2:bbbb'), { orders: 1 });
});

test('STAND 2: een stand zonder afdruk mengt zich zonder ruis', () => {
  /* Stand 1 en stand 2 kunnen niet in een ronde voorkomen, maar een oude en een
     nieuwe kop naast elkaar mag nooit "gewijzigd" opleveren uit het niets. */
  assert.deepEqual(staatlog.verschil('a=2', 'a=2:aabbccdd'), {}, 'geen afdruk aan een kant: geen oordeel');
  assert.deepEqual(staatlog.verschil('a=2:aabbccdd', 'a=2'), {});
});

test('afdruk(): dezelfde inhoud geeft dezelfde afdruk, een andere niet', () => {
  assert.equal(staatlog.afdruk([{ a: 1 }]), staatlog.afdruk([{ a: 1 }]));
  assert.notEqual(staatlog.afdruk([{ a: 1 }]), staatlog.afdruk([{ a: 2 }]));
  /* Een cyclus mag geen uitzondering geven en ook geen VERSE waarde: dan zou
     zo'n collectie bij elk verzoek "gewijzigd" heten en ruis toevoegen. */
  const cyclus = {}; cyclus.zelf = cyclus;
  assert.equal(staatlog.afdruk(cyclus), staatlog.afdruk(cyclus));
});

test('DE STAND ZELF: stand 2 telt ook objecten, stand 1 niet', () => {
  /* `bankPassen` is een OBJECT, geen array. In stand 1 had die geen lengte en
     was bank/pas/uitgeven dus onzichtbaar -- geen randgeval maar een gemeten gat. */
  const nep = { lijst: [1, 2], kaart: { a: 1, b: 2 }, leeg: [], niks: null, getal: 7 };
  const echt = require('../server/db/state');
  const bewaar = echt.db.data;
  try {
    echt.db.data = nep;
    staatlog.begin('1');
    assert.equal(staatlog.stand(), 'lijst=2', 'stand 1 ziet alleen gevulde arrays');
    staatlog.begin('2');
    const s = staatlog.lees(staatlog.stand());
    assert.deepEqual(Object.keys(s).sort(), ['kaart', 'lijst'], 'stand 2 ziet het object erbij');
    assert.equal(s.kaart.n, 2, 'en telt zijn sleutels');
    assert.ok(s.lijst.h && s.kaart.h, 'allebei met een afdruk');
  } finally { echt.db.data = bewaar; staatlog.begin(''); }
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
  assert.equal(staatlog.diep, false, 'stand 1 is de goedkope stand');
  staatlog.begin('2');
  assert.equal(staatlog.aan, true, 'stand 2 haakt ook');
  assert.equal(staatlog.diep, true, 'en zet de inhoudsafdruk aan');
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
