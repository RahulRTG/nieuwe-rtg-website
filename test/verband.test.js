/* ============================================================================
   DE VERBANDIJKING -- en de ene fout die haar waardeloos zou maken.

   scripts/verband.js vraagt of een onafhankelijke waarnemer de wet->wachter-
   randen terugvindt die WETTEN.json verklaart. Die vraag heeft precies een
   faalvorm die van buiten niet te zien is: een sensor die het veld `handhaver`
   LEEST, vindt alles terug en meldt honderd procent. De meter is dan niet fout
   maar leeg, en hij ziet er beter uit dan de eerlijke versie.

   Toets 1 is daarom de belangrijkste van dit bestand, en hij leest de BRON.
   Dat is dezelfde vorm als test/codegrens.test.js: een document houdt niemand
   tegen die morgen `w.handhaver` in een sensor schrijft, een toets wel.

   ELKE BEWERING HIER IS EEN MUTATIE GEZIEN ZAKKEN.

   Draai los: node --test test/verband.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const V = require('../scripts/verband.js');
const BRON = fs.readFileSync(path.join(WORTEL, 'scripts/verband.js'), 'utf8');

/* MUTATIE GEZIEN ZAKKEN: in maakSensoren() een sensor toegevoegd die
   `w.handhaver` teruggeeft; recall sprong naar 56/56 en deze toets zakte. */
test('1. geen enkele sensor leest het veld dat hij moet terugvinden', () => {
  /* Het blok tussen maakSensoren( en de sluitende return is waar de sensoren
     wonen. Daarbuiten MAG handhaver gelezen worden -- daar zit de grondwaarheid. */
  const begin = BRON.indexOf('function maakSensoren');
  const eind = BRON.indexOf('/* ------------------------------------------------------------------- meten */');
  assert.ok(begin > 0 && eind > begin, 'het sensorblok is niet te vinden; is het hernoemd, pas dan ook ' +
    'deze toets aan -- een grens die zijn eigen doel niet meer vindt, houdt niets tegen');

  const sensorblok = BRON.slice(begin, eind);
  assert.doesNotMatch(sensorblok, /\.handhaver/,
    'een sensor leest `handhaver`, en dat is precies het veld dat hij zelfstandig moet terugvinden. ' +
    'Daarmee ijkt de machine zichzelf en is de recall per definitie 100% -- de duurste vorm van vals groen.');
  assert.doesNotMatch(sensorblok, /isWachter/,
    'de sensoren horen niet te weten welke bestanden uberhaupt wachters zijn op grond van het referentieveld');
});

/* MUTATIE GEZIEN ZAKKEN: de wettekst-sensor de drempel op 0 gezet, zodat hij
   elke wachter voorstelt; recall werd 56/56 en deze toets zakte op de ijking. */
test('2. zelfijking: een verzonnen wet levert geen volle bak voorstellen op', () => {
  const { wetten } = require('../WETTEN.json');
  const echteWachters = [...new Set(wetten.flatMap(w => (w.handhaver || []).filter(V.isWachter)))];
  const sensoren = V.maakSensoren(echteWachters, {});

  const onzin = {
    id: 'verzonnen', wet: 'Een kabouter verplaatst nooit een stoeptegel zonder kruiwagen.',
    bron: { bestand: 'BESTAATNIET.md', anker: 'kruiwagenbeleid' },
    sabotage: { bestand: 'server/kern/bestaatniet.js' },
  };
  for (const [naam, fn] of Object.entries(sensoren)) {
    const voorstel = fn(onzin) || [];
    assert.equal(voorstel.length, 0,
      'sensor "' + naam + '" stelt ' + voorstel.length + ' wachters voor voor een verzonnen wet; ' +
      'een sensor die altijd iets voorstelt haalt zijn recall met ruis in plaats van met kennis');
  }
});

/* MUTATIE GEZIEN ZAKKEN: de doelbestand-sensor uitgezet; unie viel van 54 naar
   53 en de per-sensor recall van 32 naar 0 -- deze toets zakte op de vloer. */
test('3. de unie vindt de bekende randen terug, en iedere misser draagt zijn naam', () => {
  const pad = path.join(WORTEL, 'VERBAND.json');
  assert.ok(fs.existsSync(pad), 'VERBAND.json ontbreekt; draai `npm run verband`. Een ontbrekend register ' +
    'is geen groen: niet-gemeten mag nooit als in orde langskomen');
  const j = JSON.parse(fs.readFileSync(pad, 'utf8'));

  /* Sinds de splitsing (LAT.md regel 14) staan de twee relaties als eigen velden
     in WETTEN.json. `handhaver` blijft in deze som meetellen zolang de legacy-
     terugval bestaat; test/wetrelatie.test.js houdt die lijst leeg. */
  const verklaard = require('../WETTEN.json').wetten
    .flatMap(w => [...(w.bewaaktDoor || []), ...(w.draagt || []), ...(w.handhaver || [])]).length;
  assert.equal(j.telling.randenWachter + j.telling.randenImplementatie, verklaard,
    'de twee soorten randen horen samen alle verklaarde paden te dekken; klopt dat niet, ' +
    'dan valt er een soort stil buiten de ijking');

  /* De vloer staat op 50 en niet op 54: een NIEUWE wet met een wachter die geen
     enkele sensor ziet, is gewoon werk. Stil wegzakken is dat niet. */
  assert.ok(j.telling.gevonden >= 50,
    'de unie is gezakt naar ' + j.telling.gevonden + ' van ' + j.telling.randenWachter +
    '; gemist: ' + j.gemist.map(g => g.wet).join(', '));

  for (const g of j.gemist) {
    assert.ok(g.wet && g.wachter, 'een gemiste rand zonder naam is niet na te lopen, en dan wordt ' +
      'het aantal een getal dat iemand ooit accepteert');
  }
});

/* MUTATIE GEZIEN ZAKKEN: de vijf sensoren in de uitslag vervangen door een
   enkel `betrouwbaarheid`-percentage; zakte hier. */
test('4. elke rand draagt WELKE sensoren hem zagen, en nooit een percentage', () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'VERBAND.json'), 'utf8'));
  assert.ok(Object.keys(j.sensoren).length >= 4, 'de ijking leunt op meerdere onafhankelijke waarnemers; ' +
    'met een sensor is er geen tweede mening');

  for (const [naam, s] of Object.entries(j.sensoren)) {
    assert.equal(typeof s.recall, 'number', 'sensor ' + naam + ' draagt geen eigen recall');
    assert.equal(typeof s.voorstellen, 'number', 'sensor ' + naam + ' draagt geen aantal voorstellen; ' +
      'zonder dat getal is recall zonder prijs, en dan wint altijd de breedste sensor');
  }

  for (const r of j.randen) {
    assert.ok(Array.isArray(r.gezienDoor), 'een rand hoort te zeggen welke sensoren hem zagen');
    assert.ok(!('betrouwbaarheid' in r) && !('confidence' in r),
      'een rand draagt een samengesteld zekerheidscijfer, en dat verbergt juist het verschil ' +
      'tussen een causale waarneming en een woordoverlap');
  }

  assert.match(j.grens, /NOOIT tot een cijfer gemiddeld/,
    'dat de sensoren niet middelbaar zijn, hoort in het register zelf te staan en niet alleen in commentaar');
  assert.match(j.grens, /PRECISIE niet/,
    'het register hoort te zeggen dat over de precisie niets is vastgesteld');
});

/* MUTATIE GEZIEN ZAKKEN: in meet() de terugval op `geenBron` vervangen door een
   lege lijst; zakte hier, want dan meldt een sensor die niet kon kijken een nul. */
test('5. een sensor die niet kon kijken meldt dat, en niet nul', () => {
  assert.match(BRON, /geenBron/, 'de causale sensor leunt op MUTATIES.json; ontbreekt dat register, dan ' +
    'hoort de sensor "geen bron" te melden en geen nul -- een meter die niet kon kijken is iets anders ' +
    'dan een meter die niets zag (BESTUUR.md)');
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'VERBAND.json'), 'utf8'));
  for (const [naam, s] of Object.entries(j.sensoren)) {
    assert.ok(s.bron === 'gemeten' || s.bron === 'geenBron',
      'sensor ' + naam + ' draagt geen herkomst van zijn uitslag');
  }
});
