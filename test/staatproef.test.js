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
        toestand ook als het verzoek daarna wordt afgewezen;
     4. de BOEKHOUDING VAN DE AANROEP -- de kostenmeter en de auditjournalen
        bewegen bij ELKE aanroep, ook de tweede, en dat hoort. Zonder die vierde
        klasse las de proef "de herhaling bewoog de toestand opnieuw: kosten",
        werd dat in de bewijsmatrix een gezakte cel, in VERTROUWEN.json een
        `geschorst`, en zette server/middleware/schorspoort.js negen routes met
        een 503 dicht -- terwijl er in geen van de negen iets tweemaal gebeurde.

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

/* DE HERNIEUWING VALT BUITEN HET MEETVENSTER.

   Een route die 401 geeft ook met een geldig token liet deze proef bij elke
   oproep opnieuw inloggen -- binnen f0..f1. Een inlog schrijft zelf weg, dus
   stond dat in het verschil en las de uitslag als "geweigerd en de toestand
   veranderde toch". Zes routes lang, over iets wat de proef zelf deed. */
test('na een hernieuwing begint de meting opnieuw, zodat de inlog er niet in valt', async () => {
  const afdrukken = [];
  let beurt = 0, ingelogd = 0;
  const uit = await draaiStaatproef({
    /* Deze route blijft 401 geven, ook na de hernieuwing -- precies het geval
       waar het misging. */
    post: async () => ({ status: 401 }),
    vingerafdruk: async () => ({ nr: ++beurt }),
    verschilVan: async (voor, na) => { afdrukken.push([voor.nr, na.nr]); return d(); },
    hernieuw: async () => { ingelogd++; return true; },
    /* `methode` en niet `method`. De motor bouwt zijn sleutel als
       methode + ' ' + pad, dus met de Engelse variant heet deze route
       "undefined /api/x" en vindt de laatste bewering hem niet -- een
       TypeError op undefined.rollback, precies waar de scherf op zakte. Tien
       andere plekken in dit bestand hadden het al goed; deze ene niet. */
    routes: [{ methode: 'POST', pad: '/api/x', rol: 'office' }],
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  assert.equal(ingelogd, 1, 'er wordt hooguit EEN keer hernieuwd, niet bij elke oproep');
  assert.equal(beurt, 4, 'vier vingerafdrukken: een verworpen start, en daarna het echte venster');
  assert.deepEqual(afdrukken, [[2, 3], [3, 4]],
    'het venster begint NA de inlog (2), niet ervoor (1) -- anders telt de inlog als routewerk');
  assert.equal(uit.perRoute['POST /api/x'].rollback, 'bewezen');
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

test('een hernieuwde login vervuilt het meetvenster niet', async () => {
  /* Het mechanisme achter zes valse rtfos-bevindingen: een 401 liet doe()
     opnieuw inloggen, en die login schreef securityLog en sessions BINNEN het
     venster van de route. Nu: vuurt de hernieuwing, dan gaat het venster weg
     en start de meting opnieuw met een verse afdruk NA de login. De toets
     bootst het na: de login beweegt de toestand (verschil over het weggegooide
     venster), de route zelf beweegt niets -- en de uitslag hoort dan schoon
     'geweigerd en er bleef niets staan' te zijn, met precies EEN hernieuwing
     en EEN extra afdruk. */
  let beurt = 0, logins = 0, oproep = 0;
  const uit = await draaiStaatproef({
    post: async () => { oproep++; return { status: 401 }; },
    hernieuw: async () => { logins++; return true; },
    vingerafdruk: async () => ({ nr: ++beurt }),
    /* Alleen het venster dat de login omvat (tussen afdruk 1 en 2) beweegt;
       daarna is alles stil. */
    verschilVan: async (voor) => (voor.nr === 1 ? d('securityLog', 'sessions') : niets),
    routes: [{ methode: 'POST', pad: '/api/rtfos/iets', rol: 'office' }],
    tokenVoor: () => 't', lijfVoor: () => ({})
  });
  const rij = uit.perRoute['POST /api/rtfos/iets'];
  assert.equal(logins, 1, 'hoogstens een login per routemeting');
  assert.equal(oproep, 4, 'aanroep, hernieuwde aanroep, herhaalde meting, herhaling');
  assert.equal(beurt, 4, 'de weggegooide afdruk kost er precies een extra');
  assert.equal(rij.rollback, 'bewezen',
    'de login-schrijfacties horen niet aan de route toegerekend: ' + rij.reden);
});

test('rondes STAPELEN: vers wint, oud blijft, en de telling gaat over de samenvoeging', () => {
  /* Zonder stapeling overschreef een begrensde ronde het hele register en
     zakte de normtand op een KLEINERE meting in plaats van slechtere code. */
  const { stapelRijen } = require('../scripts/lib/staatproef');
  const oud = [
    { methode: 'POST', pad: '/api/a', state: 'bewezen', sideEffect: 'bewezen', rollback: 'ongemeten', idempotentie: 'bewezen', op: '2026-08-01T00:00:00Z' },
    { methode: 'POST', pad: '/api/b', state: 'ongemeten', sideEffect: 'ongemeten', rollback: 'GEZAKT', idempotentie: 'ongemeten' }
  ];
  const vers = { 'POST /api/b': { methode: 'POST', pad: '/api/b', state: 'ongemeten', sideEffect: 'ongemeten', rollback: 'bewezen', idempotentie: 'ongemeten' },
    'POST /api/c': { methode: 'POST', pad: '/api/c', state: 'bewezen', sideEffect: 'bewezen', rollback: 'ongemeten', idempotentie: 'GEZAKT' } };
  const uit = stapelRijen(oud, '2026-08-10T00:00:00Z', vers, '2026-08-20T00:00:00Z');

  assert.equal(uit.rijen.length, 3, 'twee oude en een nieuwe, met een hermeting ertussen');
  assert.equal(uit.versGemeten, 2);
  const per = Object.fromEntries(uit.rijen.map(r => [r.methode + ' ' + r.pad, r]));
  assert.equal(per['POST /api/a'].op, '2026-08-01T00:00:00Z', 'een eigen op-stempel blijft staan');
  assert.equal(per['POST /api/b'].op, '2026-08-20T00:00:00Z', 'vers wint en draagt het verse stempel');
  assert.equal(per['POST /api/b'].rollback, 'bewezen', 'de hermeting vervangt het oude oordeel');
  assert.deepEqual(uit.telling, { state: 2, sideEffect: 2, rollback: 1, rollbackGezakt: 0,
    idemBewezen: 1, idemGezakt: 1, ongemeten: 0 }, 'de telling gaat over de samenvoeging');
  /* En een oude rij ZONDER eigen stempel erft die van het oude register --
     nooit het verse, want dan lijkt oud bewijs jonger dan het is. */
  const zonder = stapelRijen([{ methode: 'GET', pad: '/api/x', state: 'ongemeten', rollback: 'ongemeten' }],
    '2026-07-01T00:00:00Z', {}, '2026-08-20T00:00:00Z');
  assert.equal(zonder.rijen[0].op, '2026-07-01T00:00:00Z');
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


/* ---------- de vierde klasse: boekhouding van de aanroep ---------- */

test('BOEKHOUDING: een herhaling die alleen de kostenmeter raakte, is geen tweede uitvoering', () => {
  /* Dit is de negen routes van 2 september 2026, in het klein. `kosten` beweegt
     niet vanzelf -- alleen als je belt -- dus het stille venster vindt hem nooit.
     De belofte van deze kolom gaat over de OPDRACHT, en die is niet herhaald.

     Mutatie nagetrokken: `kosten` uit BOEKHOUDING halen laat deze toets zakken
     op GEZAKT, en dan staat de boardroom-export weer op 503. */
  const o = weegStaat({ a: ok, b: ok, d01: d('bestellingen', 'kosten'), d12: d('kosten'),
    dStil: niets });
  assert.equal(o.idempotentie, 'bewezen');
  assert.match(o.idemReden, /boekhouding van de aanroep/);
  assert.match(o.idemReden, /kosten/, 'en hij noemt de collectie, zodat zichtbaar blijft dat een tweede aanroep geld kost');
});

test('en dat geldt ook voor een auditjournaal, want die lijst komt uit de code', () => {
  /* `kantoorAudit` staat in server/kern/auditsporen.js. Deze toets zakt dus ook
     als die afleiding wordt losgelaten en er weer een lijst met de hand in dit
     bestand komt te staan. */
  const o = weegStaat({ a: ok, b: ok, d01: d('exports', 'kantoorAudit'), d12: d('kantoorAudit'),
    dStil: niets });
  assert.equal(o.idempotentie, 'bewezen');
  assert.match(o.idemReden, /kantoorAudit/);
});

test('DE WRINGER: boekhouding wast alleen zichzelf weg, niet de echte collectie', () => {
  /* Zonder deze toets zou een te ruime vierde klasse elke tweede uitvoering
     kunnen verbergen -- precies de fout waar de ruisparagraaf van staatproef.js
     voor waarschuwt. Beweegt er naast de kosten ook een echte collectie, dan
     blijft het een bevinding, en de reden noemt allebei apart. */
  const o = weegStaat({ a: ok, b: ok, d01: d('bestellingen', 'kosten'),
    d12: d('bestellingen', 'kosten'), dStil: niets });
  assert.equal(o.idempotentie, 'GEZAKT');
  assert.match(o.idemReden, /bestellingen/);
  assert.match(o.idemReden, /boekhouding van de aanroep: kosten/);
});

test('een GEWEIGERD verzoek dat alleen boekhouding naliet, is geen gezakte rollback', () => {
  /* Aankloppen wordt opgeschreven, ook als de deur dichtblijft. Dat is geen
     toestand die bleef staan. Maar bewoog er ook iets echts, dan wel -- de
     tweede helft van deze toets is de grendel daarop. */
  const goed = weegStaat({ a: nee(400), b: nee(400), d01: d('kosten'), d12: d('kosten'),
    dStil: niets });
  assert.equal(goed.rollback, 'bewezen');
  assert.match(goed.reden, /boekhouding van de aanroep/);

  const fout = weegStaat({ a: nee(400), b: nee(400), d01: d('kosten', 'vacatures'),
    d12: d('kosten', 'vacatures'), dStil: niets });
  assert.equal(fout.rollback, 'GEZAKT');
  assert.match(fout.reden, /vacatures/);
});
