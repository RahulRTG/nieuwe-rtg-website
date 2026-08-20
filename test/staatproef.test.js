/* HET OORDEEL VAN DE STAATPROEF, los van een server.

   De ronde start een echte server en muteert per route twee keer; daar komt
   niemand met een mutatie bij. Wat hier wordt getoetst zijn de drie regels
   waarop deze proef kan liegen, en alle drie zijn ze uit een echte valse
   bevinding geboren:

     1. de per-route IJKING -- bewoog er niets, dan zegt "de herhaling bewoog ook
        niets" niets;
     2. de OMGEVINGSRUIS -- doorgeefjournaal en rtgai bewegen bij elk verzoek,
        ook bij een 404;
     3. de EERSTE-AANRAKING -- een kern die zijn la inricht, verandert de
        toestand ook als het verzoek daarna wordt afgewezen.

   Draai los: node --test test/staatproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { weegStaat, zonderRuis, draaiStaatproef } = require('../scripts/lib/staatproef');

const ok = { status: 200 };
const nee = (s) => ({ status: s || 400 });
const d = (...collecties) => ({ aantal: collecties.length, collecties,
  gewijzigd: collecties.map(c => ({ collectie: c, wat: 'aantal' })) });
const niets = d();

/* ---------- bevestigd ---------- */

test('bevestigd en er bewoog iets: dat is de meting', () => {
  const o = weegStaat({ a: ok, b: ok, d01: d('notities'), d12: niets });
  assert.equal(o.state, 'bewezen');
  assert.equal(o.sideEffect, 'bewezen');
  assert.deepEqual(o.collecties, ['notities']);
});

test('DE IJKING: bevestigd zonder dat er iets bewoog, bewijst niets', () => {
  /* Zonder deze regel zou elke route die 200 geeft en niets doet als bewezen
     tellen -- en dat zijn er duizenden. Dit is LAT.md regel 10 per route. */
  const o = weegStaat({ a: ok, b: ok, d01: niets, d12: niets });
  assert.equal(o.state, 'ongemeten');
  assert.equal(o.sideEffect, 'ongemeten');
  assert.equal(o.idempotentie, 'ongemeten');
  assert.match(o.reden, /zonder dat er iets in de opslag bewoog/);
});

test('de herhaling bewoog niets terwijl de eerste dat wel deed: idempotent', () => {
  const o = weegStaat({ a: ok, b: ok, d01: d('agenda'), d12: niets });
  assert.equal(o.idempotentie, 'bewezen');
});

test('de herhaling bewoog opnieuw: hij deed het nog een keer', () => {
  const o = weegStaat({ a: ok, b: ok, d01: d('agenda'), d12: d('agenda') });
  assert.equal(o.idempotentie, 'GEZAKT');
  assert.match(o.idemReden, /opnieuw/);
});

/* ---------- geweigerd ---------- */

test('geweigerd en er bleef niets staan: dat is rollback', () => {
  const o = weegStaat({ a: nee(403), b: nee(403), d01: niets, d12: niets });
  assert.equal(o.rollback, 'bewezen');
  assert.equal(o.state, 'ongemeten', 'er is geen werk gedaan, dus geen belofte om aan af te meten');
});

test('EERSTE-AANRAKING: eenmalig bewogen bij een weigering is inrichting', () => {
  /* De valse bevinding die deze regel opleverde: /api/bank/advies gaf 403 en
     `bankregie` bewoog -- de kern richtte bij eerste gebruik zijn eigen la in.
     Inrichting gebeurt EEN keer; de tweede, even hard geweigerde oproep laat
     alles met rust. */
  const o = weegStaat({ a: nee(403), b: nee(403), d01: d('bankregie'), d12: niets });
  assert.equal(o.rollback, 'bewezen');
  assert.match(o.reden, /inrichting/);
});

test('maar blijft hij ook bij de herhaling bewegen, dan is het wel een bevinding', () => {
  /* De ene uitkomst die echt slecht is: de statuscode klopt en de database niet. */
  const o = weegStaat({ a: nee(403), b: nee(403), d01: d('saldi'), d12: d('saldi') });
  assert.equal(o.rollback, 'GEZAKT');
  assert.match(o.reden, /ook bij de herhaling/);
});

/* ---------- de stille controle: doorlopende omgevingsschrijvers ---------- */

test('DE STILLE CONTROLE: wat ook zonder aanroep beweegt, zakt de route niet', () => {
  /* Dit is letterlijk wat zes rtfos-routes overkwam: securityLog en sessions
     bewogen bij de aanroep, bij de herhaling, EN in een venster zonder enige
     aanroep. Dan is het een omgevingsschrijver onder de meetklok, geen gevolg
     van de opdracht -- en de uitslag hoort bewezen te zijn, met de ruis bij
     naam in de reden. */
  const o = weegStaat({ a: nee(401), b: nee(401),
    d01: d('securityLog', 'sessions'), d12: d('securityLog', 'sessions'),
    dStil: d('securityLog', 'sessions') });
  assert.equal(o.rollback, 'bewezen');
  assert.match(o.reden, /stille venster/);
});

test('maar de stille controle wast alleen weg wat hij zelf ZAG bewegen', () => {
  /* De wringer: naast de ruis bewoog er ook iets dat in het stille venster
     stil bleef. Dan blijft het een bevinding, en de reden noemt precies de
     rest -- niet de ruis, die zou het zicht op de echte collectie vertroebelen. */
  const o = weegStaat({ a: nee(401), b: nee(401),
    d01: d('securityLog', 'saldi'), d12: d('securityLog', 'saldi'),
    dStil: d('securityLog') });
  assert.equal(o.rollback, 'GEZAKT');
  assert.match(o.reden, /saldi/);
  assert.match(o.reden, /omgevingsruis securityLog weggelaten/);
  assert.ok(!/saldi.*securityLog|securityLog, saldi/.test(o.reden.split('herhaling:')[1].split('(')[0]),
    'de restlijst noemt de ruis niet meer');
});

test('en een LEEG stil venster wast niets weg: dan was het geen ruis', () => {
  /* Zonder deze kant zou de stille controle een vrijbrief zijn: elke meting
     met een dStil erbij zou schoner lijken. Beweegt er in het stille venster
     NIETS, dan blijft de volle bevinding staan. */
  const o = weegStaat({ a: nee(401), b: nee(401),
    d01: d('saldi'), d12: d('saldi'), dStil: niets });
  assert.equal(o.rollback, 'GEZAKT');
  assert.match(o.reden, /saldi/);
});

test('de stille controle geldt ook voor de idempotentie-herhaling', () => {
  const ruisIdem = weegStaat({ a: ok, b: ok, d01: d('agenda', 'sessions'),
    d12: d('sessions'), dStil: d('sessions') });
  assert.equal(ruisIdem.idempotentie, 'bewezen',
    'een herhaling die alleen omgevingsruis raakte is geen tweede uitvoering');
  const echtIdem = weegStaat({ a: ok, b: ok, d01: d('agenda', 'sessions'),
    d12: d('agenda', 'sessions'), dStil: d('sessions') });
  assert.equal(echtIdem.idempotentie, 'GEZAKT');
  assert.match(echtIdem.idemReden, /agenda/);
});

test('zonder stille meting verandert er niets aan het oude oordeel', () => {
  /* dStil is een verfijning, geen gedragsbreuk: oude aanroepers (en oude
     registers) houden exact dezelfde uitslag. */
  const o = weegStaat({ a: nee(401), b: nee(401),
    d01: d('securityLog', 'sessions'), d12: d('securityLog', 'sessions') });
  assert.equal(o.rollback, 'GEZAKT');
});

/* ---------- de ruis ---------- */

test('OMGEVINGSRUIS gaat eruit voordat er wordt geoordeeld', () => {
  const uit = zonderRuis(d('doorgeefjournaal', 'rtgai', 'notities'), new Set(['doorgeefjournaal', 'rtgai']));
  assert.equal(uit.aantal, 1);
  assert.deepEqual(uit.collecties, ['notities']);
});

test('en zonder die filter meldt een weigering een bevinding over het journaal', () => {
  /* De tegenproef: dit is letterlijk wat de eerste ronde deed, negentien keer
     op rij. */
  const ruw = d('doorgeefjournaal', 'rtgai');
  assert.equal(weegStaat({ a: nee(404), b: nee(404), d01: ruw, d12: ruw }).rollback, 'GEZAKT');
  const schoon = zonderRuis(ruw, new Set(['doorgeefjournaal', 'rtgai']));
  assert.equal(weegStaat({ a: nee(404), b: nee(404), d01: schoon, d12: schoon }).rollback, 'bewezen');
});

/* ---------- de ronde ---------- */

test('drie afdrukken rond twee oproepen, plus een STILLE als beide vensters bewogen', async () => {
  /* Bewoog het bij de aanroep EN bij de herhaling, dan volgt de stille
     controle: een vierde afdruk zonder enige aanroep ertussen. Hier blijft
     het stille venster leeg, dus de bevinding blijft volledig staan -- de
     controle is een zeef, geen vrijbrief (zie de weegStaat-toetsen boven). */
  const afdrukken = [];
  let beurt = 0;
  const uit = await draaiStaatproef({
    post: async () => ({ status: 200 }),
    vingerafdruk: async () => ({ nr: ++beurt }),
    verschilVan: async (voor, na) => { afdrukken.push([voor.nr, na.nr]);
      return na.nr >= 4 ? niets : d('doorgeefjournaal', 'agenda'); },
    ruis: new Set(['doorgeefjournaal']),
    routes: [{ methode: 'POST', pad: '/api/x', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  assert.equal(beurt, 4, 'drie meetafdrukken en een stille controle');
  assert.deepEqual(afdrukken, [[1, 2], [2, 3], [3, 4]]);
  const rij = uit.perRoute['POST /api/x'];
  assert.deepEqual(rij.collecties, ['agenda'], 'het journaal hoort er niet meer bij te staan');
  assert.equal(rij.idempotentie, 'GEZAKT');
});

test('de laatste afdruk van een route is de eerste van de volgende', async () => {
  /* Tussen F2 van route N en F0 van route N+1 gebeurt er niets, dus die twee
     zijn per definitie gelijk. Twee keer vragen is een derde van het werk
     weggooien, en het werk is ~190 ms per afdruk. Zonder deze regel loopt een
     volledige ronde bijna anderhalf keer zo lang. */
  let beurt = 0;
  const uit = await draaiStaatproef({
    post: async () => ({ status: 200 }),
    vingerafdruk: async () => ({ nr: ++beurt }),
    /* Alleen het eerste venster beweegt; dan is er geen stille controle nodig
       en telt deze toets zuiver het hergebruik tussen routes. */
    verschilVan: async (voor) => (voor.nr % 2 === 1 ? d('agenda') : niets),
    routes: [1, 2, 3].map(i => ({ methode: 'POST', pad: '/api/r' + i, rol: 'member' })),
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  assert.equal(beurt, 7, 'drie routes: 3 + 2 + 2, niet 9');
  assert.equal(uit.afdrukken, 7);
});

test('bewoog er bij GEEN ENKELE route iets, dan meldt de ronde zichzelf blind', async () => {
  /* Zonder deze controle levert een niet-aangesloten vingerafdruk een keurige
     lijst met nullen op -- de gevaarlijkste uitkomst die dit ding kan geven. */
  const uit = await draaiStaatproef({
    post: async () => ({ status: 200 }),
    vingerafdruk: async () => ({}),
    verschilVan: async () => niets,
    routes: [{ methode: 'POST', pad: '/api/a', rol: 'member' }, { methode: 'POST', pad: '/api/b', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  assert.ok(uit.meterStuk);
  assert.match(uit.meterStuk, /bewoog de vingerafdruk/);
});

test('een vingerafdruk die niet terugkomt is een kapotte MEETOPSTELLING, geen bevinding', async () => {
  const uit = await draaiStaatproef({
    post: async () => ({ status: 200 }),
    vingerafdruk: async () => null,
    verschilVan: async () => niets,
    routes: [{ methode: 'POST', pad: '/api/a', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  assert.match(uit.perRoute['POST /api/a'].reden, /vingerafdruk kwam niet terug/);
  assert.equal(uit.perRoute['POST /api/a'].state, 'ongemeten');
});
