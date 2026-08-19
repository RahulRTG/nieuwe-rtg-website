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
const { weegStaat, zonderRuis, zonderTijdtik, ruisUit, draaiStaatproef } = require('../scripts/lib/staatproef');

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

/* DE DREMPEL VAN DE RUIS. Hij staat op "in ELKE ronde bewogen", en dat is geen
   detail: zou hij op "ooit bewogen" staan, dan poetst een collectie die een keer
   toevallig meebewoog voortaan echte tweede effecten weg. De ijkingen in
   scripts/staatproef-route.js leveren de telling; deze functie is de regel. */
test('ruis is wat in ELKE ronde bewoog, niet wat er ooit een keer bij zat', () => {
  const geteld = new Map([['doorgeefjournaal', 4], ['wacht', 4], ['agenda', 3], ['notities', 1]]);
  const ruis = ruisUit(geteld, 4);
  assert.deepEqual([...ruis].sort(), ['doorgeefjournaal', 'wacht'],
    'agenda bewoog in drie van de vier rondes en blijft dus gewoon meetellen');
});

test('en een stille ronde vangt de schakelaar die op de klok loopt', () => {
  /* Dit is de meting die drie routes van GEZAKT afhaalde. server/opzet/diensten2.js
     zet elke tien seconden een meting in `db.data.wacht`; landt die tik tussen de
     twee oproepen van een route, dan leek de herhaling iets te doen. In stilte --
     zonder dat er iets gevraagd wordt -- beweegt hij in elke ronde, en dan pas
     mag hij eruit. */
  const stil = new Map([['wacht', 3], ['techniek', 1], ['ledenSites', 1]]);
  const tijdruis = ruisUit(stil, 3);
  assert.deepEqual([...tijdruis], ['wacht']);
  const ruw = d('wacht');
  assert.equal(weegStaat({ a: ok, b: ok, d01: d('wereld'), d12: ruw }).idempotentie, 'GEZAKT',
    'zonder de stille ijking leest een tik van de klok als een tweede effect');
  const schoon = zonderRuis(ruw, tijdruis);
  assert.equal(weegStaat({ a: ok, b: ok, d01: d('wereld'), d12: schoon }).idempotentie, 'bewezen');
  /* En de tragere schakelaars blijven staan: die zijn NIET genegeerd. */
  assert.equal(zonderRuis(d('techniek'), tijdruis).aantal, 1);
});

/* DE TWEEDE RUISREGEL, en de twee voorwaarden die alleen SAMEN veilig zijn.

   Een schakelaar die eens per minuut loopt haalt de globale drempel niet (die
   eist "in elke ronde"), maar kan wel net tussen de twee oproepen van een route
   vallen. Het venster oprekken zou `commandJournaal` meeslepen, en dat is juist
   het auditjournaal van de commandkant. Daarom mag een collectie alleen weg als
   hij OOIT in stilte bewoog EN de route hem bij de EERSTE oproep niet raakte. */
test('een tik van de klok telt niet mee als de route die collectie zelf niet raakte', () => {
  const stilOoit = new Set(['commandAlarmen']);
  const d01 = d('magnaatStudio');                       // wat de route echt deed
  const d12 = d('commandAlarmen');                      // wat er bij de herhaling bewoog
  assert.equal(weegStaat({ a: ok, b: ok, d01, d12 }).idempotentie, 'GEZAKT',
    'zonder deze regel leest een minuuttik als een tweede effect');
  const schoon = zonderTijdtik(d12, d01, stilOoit);
  assert.equal(schoon.aantal, 0);
  assert.equal(weegStaat({ a: ok, b: ok, d01, d12: schoon }).idempotentie, 'bewezen');
});

test('maar raakte de route die collectie WEL bij de eerste oproep, dan blijft hij staan', () => {
  /* De gevaarlijke kant: een route die zijn eigen journaal bij ELKE oproep
     bijschrijft, is precies wat deze kolom hoort te betrappen. Voorwaarde (b)
     houdt hem binnen. */
  const stilOoit = new Set(['commandJournaal']);
  const d01 = d('commandJournaal', 'besluiten');
  const d12 = d('commandJournaal');
  const schoon = zonderTijdtik(d12, d01, stilOoit);
  assert.deepEqual(schoon.collecties, ['commandJournaal'], 'niet weggepoetst');
  assert.equal(weegStaat({ a: ok, b: ok, d01, d12: schoon }).idempotentie, 'GEZAKT');
});

test('en een collectie die NOOIT in stilte bewoog blijft altijd staan', () => {
  /* Voorwaarde (a). Zonder die eis zou elke collectie die de route de tweede
     keer voor het eerst aanraakt verdwijnen -- en dat is nu juist een tweede
     effect met een ander pad, geen ruis. */
  const d01 = d('notities');
  const d12 = d('betalingen');
  const schoon = zonderTijdtik(d12, d01, new Set(['wacht']));
  assert.deepEqual(schoon.collecties, ['betalingen']);
  assert.equal(weegStaat({ a: ok, b: ok, d01, d12: schoon }).idempotentie, 'GEZAKT');
});

/* ---------- de ronde ---------- */

test('drie vingerafdrukken rond twee oproepen, en de ruis wordt toegepast', async () => {
  const afdrukken = [];
  let beurt = 0;
  const uit = await draaiStaatproef({
    post: async () => ({ status: 200 }),
    vingerafdruk: async () => ({ nr: ++beurt }),
    verschilVan: async (voor, na) => { afdrukken.push([voor.nr, na.nr]); return d('doorgeefjournaal', 'agenda'); },
    ruis: new Set(['doorgeefjournaal']),
    routes: [{ method: 'POST', pad: '/api/x', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  assert.equal(beurt, 3, 'drie vingerafdrukken bij de eerste route');
  assert.deepEqual(afdrukken, [[1, 2], [2, 3]]);
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
    verschilVan: async () => d('agenda'),
    routes: [1, 2, 3].map(i => ({ method: 'POST', pad: '/api/r' + i, rol: 'member' })),
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
    routes: [{ method: 'POST', pad: '/api/a', rol: 'member' }, { method: 'POST', pad: '/api/b', rol: 'member' }],
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
    routes: [{ method: 'POST', pad: '/api/a', rol: 'member' }],
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  assert.match(uit.perRoute['POST /api/a'].reden, /vingerafdruk kwam niet terug/);
  assert.equal(uit.perRoute['POST /api/a'].state, 'ongemeten');
});
