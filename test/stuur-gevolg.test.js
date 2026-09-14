/* DE GEVOLGVOORSPELLING (server/kern/stuur/gevolg.js, EXECUTIE.md blok 4).

   Een gebruiker vraagt voor het bevestigen niet "welke routes roep je aan" maar
   "wat verandert er dan". Deze laag beantwoordt daar een deel van uit een echte
   meting -- de idempotentieproef noteerde per route WELKE collecties veranderden
   -- en de rest van het werk van deze suite is bewaken dat het ontbrekende deel
   zichtbaar blijft.

   DE SCHERPSTE EIS: "de proef kwam er niet bij" mag NOOIT lezen als "er gebeurt
   niets". Dat zijn twee verschillende dingen en het verschil is precies de
   gevaarlijke kant: een plan dat zegt "raakt niets aan" terwijl niemand heeft
   gekeken, is een geruststelling zonder grond. Over de paden die de AI mag
   bedienen staat 96 van de 176 op onbekend; een voorspelling die dat verzwijgt
   leest als volledigheid (PROOF.md par. 9.1, bon.js).

   En net als plan.js: hij voert niets uit, en hij hangt NAAST het plan. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { voorspel, gevolgVan, GRENZEN } = require('../server/kern/stuur/gevolg');
const { compileer } = require('../server/kern/stuur/plan');

const RUW = fs.readFileSync(path.join(__dirname, '..', 'server/kern/stuur/gevolg.js'), 'utf8');
const BRON = RUW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('1. HIJ VOERT NIETS UIT: geen weg naar een effect in de code', () => {
  for (const verboden of [/\bfetch\s*\(/, /stuurRoep/, /child_process/, /fs\.write/])
    assert.ok(!verboden.test(BRON), 'gevolg.js bevat een weg naar uitvoering: ' + verboden);
});

/* DE ROUTE WORDT GEKOZEN UIT HET REGISTER, NIET INGETYPT. Deze toets stond op
   /api/bank/overboek, en die stond in de proefronde van toen op `gemeten`. Na
   een nieuwe ronde deed hij geen werk meer (402: de bankwereld stond niet klaar)
   en zakte de toets -- terwijl er niets stuk was. Een toets die een MEETUITSLAG
   overtypt, zakt zodra er opnieuw wordt gemeten, en dat leert mensen om niet
   opnieuw te meten. Wat hier vastligt is de EIGENSCHAP: een route met een
   gemeten effect noemt precies de collecties die het register noemt. */
function eenGemetenRoute() {
  const rijen = require('../IDEMPROEF.json').perRoute || [];
  for (const r of rijen)
    for (const k of ['a', 'b', 'c'])
      if (Object.keys((r.opslag || {})[k] || {}).length) return r.pad;
  return null;
}

test('2. een gemeten route noemt zijn collecties, en die komen uit het register', () => {
  const pad = eenGemetenRoute();
  assert.ok(pad, 'geen enkele route in IDEMPROEF.json heeft een gemeten effect -- dan is het ' +
    'register leeg of van vorm veranderd, en dat is zelf de bevinding');
  const g = gevolgVan(pad);
  assert.equal(g.graad, 'gemeten', pad + ' heeft een gemeten effect maar heet niet `gemeten`');
  const rijen = require('../IDEMPROEF.json').perRoute.filter(r => r.pad === pad);
  const echt = new Set();
  for (const r of rijen) for (const k of ['a', 'b', 'c']) for (const c of Object.keys((r.opslag || {})[k] || {})) echt.add(c);
  assert.ok(g.collecties.length, pad + ': graad `gemeten` zonder een enkele collectie');
  assert.deepEqual(g.collecties, [...echt].sort(), 'de voorspelling wijkt af van het register');
});

test('3. NIET GEMETEN IS GEEN "GEEN EFFECT": de graden worden niet door elkaar gehaald', () => {
  const onbekend = gevolgVan('/api/site/publiceer');
  assert.equal(onbekend.graad, 'onbekend', 'een route waar de proef niet bij kwam heet geen "geen effect"');
  assert.match(onbekend.reden, /niet bij|nooit gemeten/i);
  const verzonnen = gevolgVan('/api/bestaat/niet');
  assert.equal(verzonnen.graad, 'onbekend');
  assert.deepEqual(verzonnen.collecties, []);
});

test('4. elke uitslag draagt een graad EN een reden', () => {
  for (const pad of [eenGemetenRoute(), '/api/site/publiceer', '/api/pay/saldo', '/api/zomaar/iets']) {
    const g = gevolgVan(pad);
    assert.ok(['gemeten', 'geen-effect-gemeten', 'onbekend'].includes(g.graad), pad + ': onbekende graad ' + g.graad);
    assert.ok(g.reden && g.reden.length > 20, pad + ': graad zonder reden');
  }
});

test('5. de voorspelling over een plan telt het onbekende MEE en noemt het', () => {
  /* Ook hier een gemeten route uit het register in plaats van een ingetypte:
     wat de toets vasthoudt is dat de telling sluit en dat het onbekende deel
     wordt GENOEMD, niet welke route deze maand toevallig gemeten is. */
  const gemeten = eenGemetenRoute();
  const plan = compileer({ doel: 'gemengd', stappen: [
    { id: 'a', capability: gemeten },
    { id: 'b', capability: '/api/agenda/toevoegen' },
    { id: 'c', capability: '/api/site/publiceer' }] }, 'member');
  const g = voorspel(plan);
  assert.equal(g.telling.gemeten + g.telling['geen-effect-gemeten'] + g.telling.onbekend, 3);
  assert.ok(g.telling.onbekend >= 1, 'geen enkele onbekende stap -- verdacht');
  assert.match(g.samenvatting, /NIET gemeten/, 'de samenvatting verzwijgt wat niet gemeten is');
  assert.match(g.grens, /onbekend/);
  assert.ok(g.geraakteCollecties.length, 'een plan met een gemeten stap raakt geen enkele collectie');
});

test('6. de voorspelling verandert het plan niet: PLAN bezit niets', () => {
  const plan = compileer({ doel: 'x', stappen: [{ id: 'a', capability: '/api/bank/overboek' }] }, 'member');
  const voor = JSON.stringify(plan);
  voorspel(plan);
  assert.equal(JSON.stringify(plan), voor, 'voorspel() heeft het plan aangeraakt');
});

test('7. de grenzen staan IN de uitslag en niet alleen in een commentaarregel', () => {
  const g = voorspel(compileer({ doel: 'x', stappen: [{ id: 'a', capability: '/api/pay/saldo' }] }, 'member'));
  assert.ok(Array.isArray(g.grenzen) && g.grenzen.length >= 4, 'te weinig uitgeschreven grenzen');
  assert.equal(g.grenzen.length, GRENZEN.length);
  assert.ok(g.grenzen.some(x => /invoer van de proef/i.test(x)), 'de invoergrens ontbreekt');
  assert.ok(g.grenzen.some(x => /mail|derde partij/i.test(x)), 'de buitenwereld-grens ontbreekt');
});

test('8. een leeg of afgewezen plan levert een lege maar eerlijke voorspelling', () => {
  const g = voorspel({ uitvoerbaar: false, stappen: [] });
  assert.deepEqual(g.geraakteCollecties, []);
  assert.ok(g.samenvatting.length > 10);
  assert.equal(g.telling.onbekend, 0);
});

/* ---------------------------------------------------------------------------
   DE TWEEDE AS: de VERKLARING naast de meting
   (server/kern/stuur/gevolgcontract/voorspelling.js, EXECUTIE.md blok 4).

   De meting hierboven is hard en smal. Wat zij per definitie niet kan zien --
   wat er BUITEN de opslag gebeurt, en wat er bij een mislukking achterblijft --
   staat in een verklaring van een mens. Deze blok bewaakt drie dingen: de twee
   assen worden nooit opgeteld, een contract dat de keuring niet haalt telt niet
   als verklaring, en de regel die eruit volgt WEIGERT VANDAAG NIETS.

   Die laatste is de belangrijkste. "Een plan gaat alleen over handelingen waarvan
   het gevolg voldoende bekend is" is precies het soort regel dat CONTROLPLANE.md
   eerst in de schaduw laat lopen; met 87 van de 173 paden ongemeten zou afdwingen
   het halve stuur stilzetten, en dan wordt de regel losgedraaid in plaats van
   gehaald.
   ------------------------------------------------------------------------- */
const vp = require('../server/kern/stuur/gevolgcontract/voorspelling');

test('9. de twee assen staan APART en worden nooit opgeteld', () => {
  const plan = compileer({ doel: 'gemengd', stappen: [
    { id: 'a', capability: '/api/bank/sepa' },
    { id: 'b', capability: '/api/agenda/bewaar' }
  ] }, 'member');
  const u = vp.voorspelMet(plan);
  for (const s of u.stappen) {
    /* De meting blijft exact wat gevolgVan() zegt: de schil vult aan en corrigeert
       niets. Zou zij de graad opwaarderen omdat er een verklaring is, dan zou een
       verklaring een meting kunnen vervangen -- en dat is het valse groen waar de
       hele laag tegen is gebouwd. */
    assert.equal(s.graad, gevolgVan(s.capability).graad, s.capability + ': de meting is gewijzigd');
    assert.equal(typeof s.verklaring.stand, 'string', s.capability + ': geen tweede as');
  }
  assert.equal(u.stappen[0].verklaring.stand, 'VOLLEDIG', '/api/bank/sepa heeft een contract');
  assert.equal(u.stappen[1].verklaring.stand, 'ONBEKEND');
  assert.match(u.stappen[1].verklaring.reden, /geen enkel gevolgcontract/);

  /* HET GEVAARLIJKE GEVAL, en het stond er eerst NIET in. De mutatie "waardeer de
     graad op naar `gemeten` zodra er een volledige verklaring staat" liet deze
     toets groen: in de fixture hierboven is het pad met een contract toch al
     gemeten, en het ongemeten pad heeft geen contract. Precies de combinatie die
     de bewering draagt -- ONGEMETEN MET EEN VOLLEDIGE VERKLARING -- ontbrak.

     Die combinatie bestaat vandaag in geen enkel echt pad, dus het register wordt
     geinjecteerd. Een verklaring mag een meting AANVULLEN en nooit VERVANGEN: wie
     hier `gemeten` gaat schrijven omdat iemand het heeft opgeschreven, heeft het
     stempel van de proef aan een mens gegeven. */
  const blindMetContract = { '/api/agenda/bewaar': {
    capability: '/api/agenda/bewaar',
    gevolgen: [
      { soort: 'direct', graad: 'vermoed', wat: 'de agenda krijgt een item', reden: 'gelezen in de route' },
      { soort: 'afgeleid', graad: 'vermoed', wat: 'de dag raakt voller', reden: 'volgt eruit' },
      { soort: 'buiten', graad: 'vermoed', wat: 'geen enkel gevolg buiten de opslag', reden: 'geen bericht' },
      { soort: 'mislukking', graad: 'vermoed', wat: 'er blijft niets half staan', reden: 'een schrijfactie' }
    ],
    nagekeken: 'de toets'
  } };
  const m = vp.voorspelMet(compileer({ doel: 'y',
    stappen: [{ id: 'a', capability: '/api/agenda/bewaar' }] }, 'member'), blindMetContract);
  assert.equal(m.stappen[0].verklaring.stand, 'VOLLEDIG', 'de geinjecteerde verklaring hoort te gelden');
  assert.equal(m.stappen[0].graad, 'onbekend',
    'een volledige verklaring heeft de METING opgewaardeerd -- zij vult aan, zij vervangt niet');
  /* En hij is dan wel niet meer BLIND: dat is de bedoeling van de tweede as. Die
     twee uitspraken staan naast elkaar zonder elkaar te overschrijven. */
  assert.equal(m.verklaring.zouAfwijzen, 0);
});

test('10. DE SCHADUWREGEL WEIGERT NIETS, en noemt de paden erbij', () => {
  const plan = compileer({ doel: 'blind', stappen: [
    { id: 'a', capability: '/api/agenda/bewaar' },
    { id: 'b', capability: '/api/bank/sepa' }
  ] }, 'member');
  const u = vp.voorspelMet(plan);
  assert.equal(plan.uitvoerbaar, true, 'een onbekend gevolg mag een plan NIET afwijzen');
  assert.equal(u.verklaring.afgedwongen, false);
  assert.equal(u.verklaring.zouAfwijzen, 1);
  /* Een AANTAL alleen laat een SWAP door: een pad dat blind wordt en een dat
     bekend wordt, geeft hetzelfde getal. Vandaar de paden. */
  assert.deepEqual(u.verklaring.paden, ['/api/agenda/bewaar']);
  assert.ok(u.verklaring.waarom.length > 30, 'de schaduw zegt waarom, niet alleen hoeveel');
});

test('11. `geen-effect-gemeten` telt als BEKEND, en een volledige verklaring ook', () => {
  /* Een besluit, en het staat in voorspelling.js uitgeschreven: "de proef kwam er
     niet bij" en "de proef draaide en er bewoog niets" zijn twee dingen. Ze door
     elkaar halen is exact de fout die gevolg.js in zijn eigen GRENZEN benoemt. */
  assert.equal(vp.blindVoorGevolg({ graad: 'geen-effect-gemeten', verklaring: { stand: 'ONBEKEND' } }), false);
  assert.equal(vp.blindVoorGevolg({ graad: 'onbekend', verklaring: { stand: 'ONBEKEND' } }), true);
  /* En de twee assen VULLEN elkaar aan: een ongemeten pad met een volledige
     verklaring is niet blind. */
  assert.equal(vp.blindVoorGevolg({ graad: 'onbekend', verklaring: { stand: 'VOLLEDIG' } }), false);
});

test('12. een contract dat de keuring niet haalt, telt NIET als verklaring', () => {
  /* Anders draagt een plan zekerheid die op een afgekeurde regel rust. Het echte
     register is bevroren en bevat terecht geen afgekeurd contract, dus de lezer
     wordt GEINJECTEERD -- zonder dat zou deze regel groen staan zonder ooit
     gedraaid te zijn (zelfde snit als `norm.meet({ leesMutaties })`). */
  const kapot = { '/api/bank/sepa': {
    capability: '/api/bank/sepa',
    gevolgen: [{ soort: 'direct', graad: 'gemeten', collectie: 'verzonnenCollectie',
      wat: 'saldo daalt', reden: 'verzonnen' }],
    nagekeken: 'de toets'
  } };
  const na = vp.verklaringVan('/api/bank/sepa', kapot);
  assert.equal(na.stand, 'ONBEKEND');
  /* En het verdwijnt niet STIL: de reden zegt dat er wel een contract is en dat
     het zakte. "Er staat niets" en "er staat iets dat niet draagt" zijn twee
     verschillende antwoorden. */
  assert.match(na.reden, /haalt de keuring niet/);
});

test('13. de voorspelling verandert het plan nog steeds niet', () => {
  /* Regel uit de kop van gevolg.js, en de tweede as mag hem niet slopen: PLAN
     bezit niets. De eerste versie van deze stap zette de gevolgkennis PER STAP in
     plan.js, en dat is precies wat deze toets tegenhoudt. */
  const plan = compileer({ doel: 'x', stappen: [{ id: 'a', capability: '/api/bank/sepa' }] }, 'member');
  const voor = JSON.stringify(plan);
  vp.voorspelMet(plan);
  assert.equal(JSON.stringify(plan), voor, 'de voorspelling heeft het plan aangeraakt');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/kern/stuur/plan.js'), 'utf8');
  assert.ok(!/gevolgcontract|gevolgVanStap/.test(bron),
    'plan.js is de gevolgkennis gaan bezitten; zij hangt ERNAAST (zie gevolg.js, slotalinea)');
});

/* ---------------------------------------------------------------------------
   GEEN WERK GAAT VOOR GEMETEN -- de volgorde in gevolgVan(), en waarom zij
   ertoe doet.

   Zij stond omgekeerd, en dat leverde 153 van de 4923 paden een `gemeten` op
   terwijl de idempotentieproef ze op 404 of 403 had zien stranden. Het scherpste
   geval: /api/office/bank/handtekening/bevestig gaf drie keer 404 en tussendoor
   bewoog `wacht` -- de proef draait alles tegen EEN server, dus dat was werk van
   een buur. IDEMPROEF.json noemt zo'n route zelf `ongemeten`; deze laag maakte er
   `gemeten` van, en sprak dus zijn eigen bron tegen.

   MUTATIEPROEF: zet in server/kern/stuur/gevolg.js de `collecties.length`-tak
   terug boven de `geenWerk`-tak en deze toets zakt op de eerste assertie.
   --------------------------------------------------------------------------- */
test('5. een route die geen werk deed heet ONBEKEND, ook als er iets bewoog', () => {
  const rijen = require('../IDEMPROEF.json').perRoute || [];
  /* Een echt geval uit het register zoeken in plaats van er een te verzinnen: de
     regel bestaat om wat de proef MEET, en een fixture zou hier de bron vervangen
     door de aanname die getoetst moet worden. */
  const kaart = new Map();
  for (const r of Object.values(rijen)) {
    if (!r || r.methode !== 'POST' || typeof r.pad !== 'string') continue;
    const h = kaart.get(r.pad) || { col: new Set(), geenWerk: false };
    for (const k of ['a', 'b', 'c']) for (const n of Object.keys((r.opslag || {})[k] || {})) h.col.add(n);
    if (/deed geen werk/.test(String(r.reden || ''))) h.geenWerk = true;
    kaart.set(r.pad, h);
  }
  const gevallen = [...kaart].filter(([, h]) => h.geenWerk && h.col.size);
  /* Nul gevallen is geen groen: dan bewaakt deze toets niets en hoort iemand te
     kijken of het register van vorm is veranderd. */
  assert.ok(gevallen.length, 'geen enkel pad in het register combineert "geen werk" met een ' +
    'bewogen collectie -- dan meet deze toets niets meer');

  for (const [pad, h] of gevallen.slice(0, 25)) {
    const g = gevolgVan(pad);
    assert.equal(g.graad, 'onbekend', pad + ' deed geen werk en heet toch ' + g.graad);
    assert.deepEqual(g.collecties, [], pad + ': een onbekende uitslag draagt geen collectielijst, ' +
      'want dan leest hij alsof er wel iets is vastgesteld');
    /* En wat er WEL bewoog verdwijnt niet: weglaten zou een tweede soort stilte zijn. */
    for (const naam of h.col) assert.match(g.reden, new RegExp(naam),
      pad + ': de reden noemt niet wat er bewoog (' + naam + ')');
  }
});
