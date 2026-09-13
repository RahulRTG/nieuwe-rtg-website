/* DE EFFECTBON EN DE NAMETING -- de observatie die altijd bestaat, en de vier uitkomsten.

   WAAROM DEZE SUITE BESTAAT. Als de observatie alleen bestaat wanneer een diagnostische
   vlag aanstaat, dan heeft dit huis geen causale runtime maar een meetopstelling. De bon
   staat daarom ALTIJD aan en de zware staatlogging blijft optioneel; wat hier wordt
   afgedwongen is dat die verhouding zo blijft, dat de bon geen payload gaat dragen, en
   dat "niet waargenomen" nooit stilletjes "niet gebeurd" gaat betekenen.

   DE SCHERPSTE EIS IS DE VIERDE UITKOMST. VOORSPELD_NIET_GEZIEN mag alleen vallen waar de
   meter DEKKING had; waar hij blind is hoort NIET_MEETBAAR te staan. Zonder dat
   onderscheid is deze laag een machine die zichzelf gerust stelt.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const effectbon = require('../server/effectbon');
const effectmeter = require('../server/effectmeter');
const staatlog = require('../server/staatlog');
const { nameet, UITKOMSTEN, wegVan } = require('../server/kern/stuur/gevolgcontract/nameting');

const BRON = fs.readFileSync(path.join(__dirname, '..', 'server/effectbon.js'), 'utf8');
const KALE_BRON = BRON.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('1. DE BON STAAT ALTIJD AAN, en de zware staatlogging niet', () => {
  /* De hele reden van deze laag. Zou hij aan een vlag hangen, dan bestaat de observatie
     alleen in een proef -- en dan is elke voorspelling in productie onweerlegbaar. */
  assert.strictEqual(effectbon.aan, true, 'de bon hoort zonder enige vlag te bestaan');
  assert.strictEqual(staatlog.aan, false, 'de zware opslagmeter hoort juist NIET aan te staan');
  /* En de tellers van de effectmeter tellen ook zonder vlag, want de bon staat erop. */
  const uit = effectmeter.perVerzoek((t) => { effectmeter.tel('mail'); return t; });
  assert.strictEqual(uit.mail, 1, 'de tellers horen zonder RTG_STAATLOG te tellen');
});

test('2. perVerzoek NEST NIET: twee schillen delen een teller', () => {
  /* Zonder die regel krijgt de binnenste schil een eigen teller, schrijft tel() daarin,
     en ziet de buitenste nul -- de bon zou dan melden dat er geen mail uitging. */
  const uit = effectmeter.perVerzoek((buiten) => {
    effectmeter.perVerzoek((binnen) => {
      assert.strictEqual(binnen, buiten, 'de binnenste schil maakte een tweede teller');
      effectmeter.tel('sms');
    });
    return buiten;
  });
  assert.strictEqual(uit.sms, 1);
});

test('3. de bon draagt de zeven velden, en GEEN payload', () => {
  const bon = effectbon.maak({
    envelop: { correlatie: 'r1', oorzaak: 'r0', capability: 'POST /api/bank/sepa' },
    voor: 'bankSaldi=3,doorgeefjournaal=9', na: 'bankSaldi=4,doorgeefjournaal=10',
    teller: { opslag: 2, mail: 1, sms: 0 } });
  assert.deepStrictEqual(Object.keys(bon).sort(),
    ['at', 'capability', 'dekking', 'klassen', 'objectrefs', 'oorzaak', 'verzoek']);
  assert.strictEqual(bon.verzoek, 'r1');
  assert.strictEqual(bon.oorzaak, 'r0');
  assert.deepStrictEqual(bon.klassen, ['EXTERN_BEREIKEN', 'GELD_BEWEGEN']);
  /* objectrefs zijn COLLECTIENAMEN en nooit rijen of sleutels: een bon met inhoud is een
     gedragslogboek per lid, en dat is precies wat KOSTEN.md weigert. */
  assert.deepStrictEqual(bon.objectrefs, ['bankSaldi']);
  const tekst = JSON.stringify(bon);
  for (const verboden of ['codenaam', 'iban', 'email', 'body', 'payload'])
    assert.ok(!tekst.toLowerCase().includes(verboden), 'de bon draagt ' + verboden);
});

test('4. een collectie ZONDER indeling draagt geen klasse en verdwijnt niet', () => {
  /* `doorgeefjournaal` groeit bij elk verzoek, ook bij lezen. Hij is niet ingedeeld en
     levert dus geen klasse -- maar hij wordt wel GETELD, want "er bewoog iets dat niemand
     heeft ingedeeld" is iets anders dan "er gebeurde niets". */
  const bon = effectbon.maak({ envelop: { correlatie: 'r2' },
    voor: 'doorgeefjournaal=9', na: 'doorgeefjournaal=10', teller: { opslag: 1, mail: 0, sms: 0 } });
  assert.deepStrictEqual(bon.klassen, []);
  assert.deepStrictEqual(bon.objectrefs, []);
  assert.strictEqual(bon.dekking.collectiesZonderIndeling, 1);
  assert.strictEqual(bon.dekking.schreefOpslag, true,
    'er is geschreven, en dat hoort apart van de klassen te staan');
});

test('5. DE BLINDE ZONES STAAN IN DE BON, en krimpen met de diepte', () => {
  const ondiep = effectbon.maak({ envelop: {}, voor: '', na: '', teller: {} });
  for (const z of effectbon.BLIND_ONDIEP) assert.ok(ondiep.dekking.blind.includes(z), z);
  for (const z of effectbon.BLIND_ALTIJD) assert.ok(ondiep.dekking.blind.includes(z), z);
  /* De blinde zones van de effectmeter zijn GELEEND en niet overgeschreven: een tweede
     lijst zou uiteenlopen zodra daar een choke point bij komt. */
  assert.deepStrictEqual(effectbon.BLIND_ALTIJD.slice(), effectmeter.NIET_GEMETEN.slice());
});

test('6. de bon bouwt niets na: hij leent staatlog en effectcollecties', () => {
  /* Een tweede implementatie van "wat is er gebeurd" is LAT.md regel 4 op de plek waar
     het het duurst is. Toets op de BRON, want een weg die er niet is kan ook niet per
     ongeluk gebruikt worden. */
  assert.ok(/require\('\.\/staatlog'\)/.test(KALE_BRON), 'hij hoort staatlog te lenen');
  assert.ok(/effectcollecties/.test(KALE_BRON), 'hij hoort de indeling te lenen');
  for (const verboden of [/createHash/, /JSON\.stringify/, /PER_COLLECTIE/])
    assert.ok(!verboden.test(KALE_BRON), 'de bon bouwt zelf ' + verboden + ' en dat hoort geleend');
});

test('7. DE VIER UITKOMSTEN, elk met zijn eigen geval', () => {
  const bon = (extra) => Object.assign({ verzoek: 'r', capability: 'POST /api/x', klassen: [],
    dekking: { schreefOpslag: false, diep: false, blind: ['bestand', 'externe-aanroep'] } }, extra || {});
  const eerste = (u) => u.rijen[0];

  assert.strictEqual(eerste(nameet(['GELD_BEWEGEN'],
    bon({ klassen: ['GELD_BEWEGEN'] }))).uitkomst, 'VOORSPELD_EN_GEZIEN');
  assert.strictEqual(eerste(nameet(['GELD_BEWEGEN'], bon())).uitkomst, 'VOORSPELD_NIET_GEZIEN');
  assert.strictEqual(eerste(nameet([], bon({ klassen: ['EXTERN_BEREIKEN'] }))).uitkomst,
    'GEZIEN_NIET_VOORSPELD');
  assert.strictEqual(eerste(nameet(['UITGAANDE_AANROEP'], bon())).uitkomst, 'NIET_MEETBAAR');
  assert.deepStrictEqual(UITKOMSTEN.slice().sort(),
    ['GEZIEN_NIET_VOORSPELD', 'NIET_MEETBAAR', 'VOORSPELD_EN_GEZIEN', 'VOORSPELD_NIET_GEZIEN']);
});

test('8. "NIET WAARGENOMEN" WORDT NOOIT "NIET GEBEURD" waar de meter blind was', () => {
  /* De scherpste eis. Er IS geschreven, maar niet in een ingedeelde collectie, en in de
     ondiepe stand is een wijziging op zijn plaats onzichtbaar. Dan zegt "niet gezien"
     niets over de handeling -- alleen over de meter. */
  const blind = { verzoek: 'r', klassen: [],
    dekking: { schreefOpslag: true, diep: false, blind: ['wijziging-zonder-lengteverschil'] } };
  const u = nameet(['GELD_BEWEGEN'], blind);
  assert.strictEqual(u.rijen[0].uitkomst, 'NIET_MEETBAAR');
  assert.match(u.rijen[0].reden, /zegt hier niets/);

  /* En met DEKKING wordt het wel een signaal: dezelfde invoer, maar diep gemeten. */
  const diep = nameet(['GELD_BEWEGEN'], Object.assign({}, blind,
    { dekking: { schreefOpslag: true, diep: true, blind: [] } }));
  assert.strictEqual(diep.rijen[0].uitkomst, 'VOORSPELD_NIET_GEZIEN',
    'met volledige dekking hoort dit juist WEL een bevinding te zijn');

  /* En de derde vorm: er is helemaal niet geschreven. Het choke point stond aan en telde
     nul, dus dit is het relevante signaal en geen blinde vlek. */
  const nul = nameet(['GELD_BEWEGEN'], Object.assign({}, blind,
    { dekking: { schreefOpslag: false, diep: false, blind: [] } }));
  assert.strictEqual(nul.rijen[0].uitkomst, 'VOORSPELD_NIET_GEZIEN');
  assert.match(nul.rijen[0].reden, /telde nul/);
});

test('9. er komt GEEN samengesteld cijfer boven de vier uitkomsten', () => {
  /* Een "voorspellingsscore" van 3 op 4 middelt precies de vierde uitkomst weg, en die
     is de reden dat deze laag bestaat (BEWIJSMACHINE.md, keuringsregel 48). */
  const u = nameet(['GELD_BEWEGEN', 'UITGAANDE_AANROEP'], { klassen: ['GELD_BEWEGEN'],
    dekking: { schreefOpslag: true, diep: false, blind: ['externe-aanroep'] } });
  for (const verboden of ['score', 'pct', 'percentage', 'cijfer', 'confidence'])
    assert.ok(!Object.keys(u).some(k => k.toLowerCase().includes(verboden)), 'er staat een ' + verboden);
  assert.deepStrictEqual(Object.keys(u).sort(), ['capability', 'reden', 'rijen', 'telling', 'verzoek']);
  /* De telling is per uitkomst en niet opgeteld. */
  assert.deepStrictEqual(Object.keys(u.telling).sort(), UITKOMSTEN.slice().sort());
});

test('10. de weg per klasse is een uitspraak over de METER en niet over de handeling', () => {
  /* `UITGAANDE_AANROEP` is niet onmeetbaar omdat hij ongevaarlijk is, maar omdat er geen
     choke point bestaat. Zodra dat er komt, hoort deze tabel mee te bewegen. */
  assert.strictEqual(wegVan('UITGAANDE_AANROEP'), 'geen');
  assert.strictEqual(wegVan('EXTERN_BEREIKEN'), 'bericht');
  assert.strictEqual(wegVan('GELD_BEWEGEN'), 'opslag');
  assert.strictEqual(wegVan('IETS_NIEUWS'), 'opslag',
    'een onbekende klasse hoort op de opslagweg te vallen en niet op "geen": ' +
    'anders wordt een nieuw werkwoord stil onmeetbaar verklaard');
});

test('11. de middleware zet de kop en breekt het antwoord niet', () => {
  /* Geen echte server: een nagemaakte app, req en res. Dat toetst de bedrading -- dat de
     bon in res.end wordt gemaakt en dat een fout daarin het antwoord niet sloopt. */
  const lagen = [];
  const app = { use: (fn) => lagen.push(fn) };
  assert.strictEqual(effectbon.haak(app), true);
  assert.strictEqual(lagen.length, 1);

  const koppen = {};
  let geeindigd = false;
  const res = { headersSent: false, setHeader: (k, v) => { koppen[k] = v; }, end: () => { geeindigd = true; } };
  const req = { envelop: { correlatie: 'r9', capability: 'POST /api/x' } };
  lagen[0](req, res, () => { effectmeter.tel('mail'); res.end(); });
  assert.strictEqual(geeindigd, true, 'het antwoord is niet afgemaakt');
  assert.strictEqual(koppen['X-RTG-Effectbon'], 'EXTERN_BEREIKEN');
  const bon = effectbon.laatste('r9');
  assert.ok(bon, 'de bon hoort in de ring te staan');
  assert.deepStrictEqual(bon.klassen, ['EXTERN_BEREIKEN']);
});

test('12. een verzoek zonder enig effect draagt `geen-klasse` en niet `geen`', () => {
  /* "Geen klasse waargenomen" is iets anders dan "geen effect": de bon zegt het eerste,
     want het tweede kan hij niet weten (zie de blinde zones). */
  const lagen = [];
  effectbon.haak({ use: (fn) => lagen.push(fn) });
  const koppen = {};
  const res = { headersSent: false, setHeader: (k, v) => { koppen[k] = v; }, end: () => {} };
  lagen[0]({ envelop: { correlatie: 'r10' } }, res, () => res.end());
  assert.strictEqual(koppen['X-RTG-Effectbon'], 'geen-klasse');
});

test('13. de voorspeller wordt ERIN GEHANGEN en niet opgehaald', () => {
  /* De richting is de hele truc: deze laag mag kern LEZEN, maar zij hoort niet te weten
     dat er een geldketen bestaat -- en kern hoort niets naar de serverlaag te duwen.
     server/opzet/kern-geldketen.js kent beide en geeft de functie mee. Toets op de BRON,
     want een require die er niet is kan ook niet per ongeluk ontstaan. */
  assert.ok(!/geldketen/.test(KALE_BRON), 'de bon kent de geldketen en hoort dat niet te doen');
  assert.ok(/zetVoorspeller/.test(KALE_BRON));
  /* En de bedrading staat werkelijk in opzet, niet alleen in de kop hier. */
  const opzet = fs.readFileSync(path.join(__dirname, '..', 'server/opzet/kern-geldketen.js'), 'utf8');
  assert.ok(/zetVoorspeller\(/.test(opzet), 'opzet hangt de voorspeller er niet in');
  assert.ok(/voorspellingVan/.test(opzet), 'en hij haalt hem uit de keten');
});

test('14. DE HELE KETEN: voorspeld tegen waargenomen, met de vierde uitkomst erbij', () => {
  const oud = effectbon.zetVoorspeller((v) => (v === 'k1' ? ['GELD_BEWEGEN', 'UITGAANDE_AANROEP'] : null));
  assert.strictEqual(oud, true);
  try {
    const bon = effectbon.maak({ envelop: { correlatie: 'k1', capability: 'POST /api/x' },
      voor: 'bankSaldi=3', na: 'bankSaldi=5', teller: { opslag: 2, mail: 0, sms: 0 } });
    const per = {};
    for (const r of bon.nameting.rijen) per[r.klasse] = r.uitkomst;
    assert.strictEqual(per.GELD_BEWEGEN, 'VOORSPELD_EN_GEZIEN');
    /* En de vierde uitkomst staat er expliciet: een provideraanroep komt langs geen enkel
       choke point, dus "niet gezien" zou hier een leugen zijn. */
    assert.strictEqual(per.UITGAANDE_AANROEP, 'NIET_MEETBAAR');

    /* ZONDER VOORSPELLING GEEN NAMETING, en niet een nameting van vier keer niets: dat
       laatste leest als "we hebben gekeken en niets gevonden". */
    const zonder = effectbon.maak({ envelop: { correlatie: 'k2' }, voor: '', na: '', teller: {} });
    assert.strictEqual(zonder.nameting, undefined);
  } finally { effectbon.zetVoorspeller(null); }
});
