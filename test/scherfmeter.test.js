/* ============================================================================
   DE SCHERFMETER: vier getallen die elk iets ANDERS moeten zeggen.

   scripts/scherfmeter.js bestaat omdat twee oorzaken steeds door elkaar liepen:
   een verdeler die onrustig is, en een prijs voor ongemeten bestanden die
   ernaast zit. Een meter die dat onderscheid maakt is alleen iets waard als de
   vier getallen ook echt uit elkaar bewegen -- anders is het een dashboard met
   vier keer hetzelfde cijfer.

   Toets 1 tot en met 4 voeden de meter daarom met VERZONNEN werelden en kijken
   of elk getal afzonderlijk uitslaat -- over de HOOGTE van de echte getallen
   wordt daar niets beweerd, want die verandert bij elke commit en dan meet deze
   toets de repo in plaats van de meter. Toets 5 draait het script wel over de
   echte testmap, en ook daar gaat het over de VORM: dat elk getal er is en dat
   elk ongemeten bestand een prijsbron draagt.

   MUTATIES staan per bewering.

   Draai los: node --test test/scherfmeter.test.js
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { zetDuren } = require('../scripts/lib/delen');

/* HET ECHTE SCRIPT, op een verzonnen wereld. Hier stond eerst een NABOUW van de
   formules, en dat was fout op precies de manier waar dit huis het meest bang
   voor is: de vier mutaties die hem hadden moeten laten zakken (churn altijd
   nul, nieuwe bestanden als churn tellen, ongemeten altijd leeg) deden alle vier
   NIETS, want de toets rekende met zijn eigen kopie. Alleen de vijfde -- die het
   script wel echt aanriep -- sloeg aan.

   Daarom draait alles nu door meetKlasse() zelf, met `bestanden` en
   `behoudWeging` als naad. Wat er getoetst wordt is het script, niet een tweede
   beschrijving ervan. */
const { meetKlasse } = require('../scripts/scherfmeter');

const KLASSE = { id: 'unit', achtervoegsel: '.test.js', modus: 'dekking' };

function meet(kaartObj, namen, vorigePlaatsing) {
  zetDuren(kaartObj, 'geldig');
  try {
    const vorige = vorigePlaatsing
      ? { klassen: { unit: { plaatsing: vorigePlaatsing } } } : null;
    const m = meetKlasse(KLASSE, vorige, { bestanden: namen, behoudWeging: true });
    return { spreidingPct: m.balans.spreidingPct, churn: m.churn,
      plaats: m.plaatsing, ongemeten: m.ongemeten, prijsbron: m.prijsbron };
  } finally { zetDuren(null); }
}

const gelijk = (n, ms) => {
  const k = {};
  for (let i = 0; i < n; i++) k['t' + String(i).padStart(4, '0') + '.test.js'] = ms;
  return k;
};

test('1. balans slaat uit op een verdeling die NIET te balanceren is', () => {
  /* Balans is wat de verdeler probeert te minimaliseren, dus hij hoort laag te
     staan bij normaal werk EN hoog bij werk dat niet te verdelen is. Een meter
     die alleen het eerste laat zien, is geen meter.

     Vier bakken en EEN bestand dat alles is: dan is de spreiding per definitie
     100%, hoe goed de greedy ook is.

     MUTATIE: in scherfmeter.js `zwaarste - lichtste` vervangen door `0`
     -> deze toets ZAKT (RAAK). */
  const vlak = gelijk(400, 1000);
  assert.ok(meet(vlak, Object.keys(vlak)).spreidingPct < 1,
    'vierhonderd gelijke bestanden horen vlak te verdelen');

  const scheef = Object.assign(gelijk(3, 1), { 'reus.test.js': 1000000 });
  assert.ok(meet(scheef, Object.keys(scheef)).spreidingPct > 99,
    'een bestand dat al het werk is, kan niet gebalanceerd worden en dat hoort te blijken');
});

test('2. churn en balans bewegen ONAFHANKELIJK -- dat is de hele reden dat het er twee zijn', () => {
  /* DE KERNBEWERING VAN DEZE METER. Als churn en balans altijd samen bewegen,
     dan meet je twee keer hetzelfde en had een van de twee gekund. Hier staat
     een geval waar de balans PERFECT blijft en de churn toch hoog is: precies
     de situatie die drie rondes diagnose kostte.

     MUTATIE: in scherfmeter.js de churn-berekening `toen[n] !== plaats[n]`
     vervangen door `false` -> deze toets ZAKT (RAAK). */
  /* ACHTHONDERD EN NIET VIERHONDERD, en dat is geen smaak. Met 401 bestanden in
     vier bakken draagt een bak er 101 en de rest 100; de spreiding is dan 0,99%
     en rondt af op 1,0. De bewering "de balans blijft perfect" zakte daarop --
     op de KORREL van de proef en niet op het gedrag. Bij 801 is diezelfde ene
     bestand 0,5%, en dan zegt de bewering wat ze bedoelt. */
  const kaart = gelijk(800, 1000);
  const namen = Object.keys(kaart);
  const voor = meet(kaart, namen);

  /* Een bestand erbij dat vooraan in de sorteervolgorde komt en dus de hele
     toewijzing opschuift, terwijl alle gewichten gelijk blijven. */
  const kaart2 = Object.assign({}, kaart, { 'aaa-nieuw.test.js': 1000 });
  const na = meet(kaart2, Object.keys(kaart2), voor.plaats);

  assert.ok(na.spreidingPct < 1, 'de balans blijft perfect: alle gewichten zijn gelijk');
  assert.ok(na.churn.verhuisd > 0,
    'en toch verhuizen er bestanden -- balans en churn zijn twee assen, geen een');
  assert.equal(na.churn.nieuw, 1, 'het nieuwe bestand telt als nieuw en niet als verhuisd');
  assert.equal(na.churn.gedeeld, 800, 'de vergelijking gaat over de bestanden die er toen ook waren');
});

test('3. een nieuw bestand telt als nieuw en nooit als churn', () => {
  /* Zonder deze knip leest elke toegevoegde toets als verplaatsing, en dan
     staat de meter permanent hoog om de verkeerde reden -- precies waarom hij
     geen ratel krijgt zolang hij dat niet goed doet.

     MUTATIE: in scherfmeter.js `toen[n] !== undefined` weglaten uit het filter
     -> deze toets ZAKT (RAAK): het nieuwe bestand telt dan als verhuisd. */
  const kaart = gelijk(40, 1000);
  const namen = Object.keys(kaart);
  const voor = meet(kaart, namen);
  const kaart2 = Object.assign({}, kaart, { 'zzz-nieuw.test.js': 1000 });
  const na = meet(kaart2, Object.keys(kaart2), voor.plaats);

  assert.equal(na.churn.gedeeld, 40);
  assert.equal(na.churn.nieuw, 1);
  assert.ok(!Object.keys(voor.plaats).includes('zzz-nieuw.test.js'),
    'het nieuwe bestand stond niet in de vorige plaatsing en kan dus niet verhuisd zijn');
});

test('4. ongemeten telt alleen wat werkelijk geen meting heeft', () => {
  /* MUTATIE: in scherfmeter.js `!kaart.gewicht.get(n)` vervangen door `false`
     -> deze toets ZAKT (RAAK). */
  const kaart = gelijk(200, 1000);
  const namen = Object.keys(kaart).concat(['nieuw-a.test.js', 'nieuw-b.test.js']);
  const uit = meet(kaart, namen);
  assert.equal(uit.ongemeten, 2, 'twee bestanden zonder meting');
  assert.equal(meet(kaart, Object.keys(kaart)).ongemeten, 0, 'en nul als alles gemeten is');
});

test('5. het script zelf draait, en zijn uitslag klopt met het register', () => {
  /* De vier toetsen hierboven draaien op de rekenkern. Deze draait het ECHTE
     script over de echte testmap: een meter die alleen op verzonnen invoer
     werkt, is een rekenoefening. Er wordt niets over de HOOGTE beweerd -- die
     verandert bij elke commit -- alleen over de vorm, en dat elk getal er is.

     MUTATIE: in scherfmeter.js `meetKlasse` laten teruggeven zonder `prijsbron`
     -> deze toets ZAKT (RAAK). */
  const { meet: meetEcht, KLASSEN } = require('../scripts/scherfmeter');
  const uit = meetEcht();

  for (const k of KLASSEN) {
    const m = uit.klassen[k.id];
    assert.ok(m, 'klasse ' + k.id + ' hoort gemeten te worden');
    assert.ok(m.bestanden > 0, k.id + ' hoort bestanden te hebben');
    assert.equal(typeof m.balans.spreidingPct, 'number');
    assert.equal(m.balans.perScherf.length, 4, 'vier scherven');
    assert.equal(typeof m.ongemeten, 'number');
    assert.ok(m.prijsbron && typeof m.prijsbron === 'object', 'prijsbron hoort een indeling te zijn');
    /* Elk ongemeten bestand hoort in de prijsbron terug te komen: een geschat
       gewicht zonder herkomst is precies wat deze meter moet uitsluiten. */
    const geteld = Object.values(m.prijsbron).reduce((a, b) => a + b, 0);
    assert.equal(geteld, m.ongemeten,
      'elk ongemeten bestand hoort een prijsbron te dragen (' + geteld + ' tegen ' + m.ongemeten + ')');
  }
});
