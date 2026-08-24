/* MEET-EEN-DEELVERZAMELING MOET HETZELFDE ZEGGEN ALS MEET-ALLES.

   scripts/norm.js rekende bij elke aanroep de hele wereld uit: 43,5 seconde,
   waarvan 35,7 in een gespawnde keuring over de hele codebase. De ijking
   (test/meterijk.test.js) roept hem 24 keer aan en leest er telkens EEN getal
   uit. `meet({ alleen: [...] })` rekent nu alleen de bronnen uit waarop de
   gevraagde meters berusten -- de tabel METERBRONNEN in norm.js is dat contract.

   Dat is een snelheidstruc met een scherpe rand: zet een meter in de verkeerde
   groep, dan wordt zijn bron niet vernieuwd en geeft hij stil een verkeerd of
   ontbrekend getal. Een meter die liegt is erger dan een meter die er niet is
   (LAT-regel 10), en de ijking zelf leunt erop.

   Deze toets is de handhaver. Hij meet EEN keer alles, en daarna per bron een
   deelverzameling, en eist dat elke meter in beide precies hetzelfde getal
   heeft. Staat een meter in de verkeerde groep, of vergeet iemand hem in de
   tabel te zetten, dan zakt hij hier.

   Waarom per BRON en niet per meter: dan zou de dure keuring acht keer draaien
   voor acht meters die allemaal uit dezelfde uitslag komen. Per bron is de
   dekking even volledig -- elke meter komt langs -- en kost hij een fractie.

   Draai los: node --experimental-sqlite --test test/normsubset.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const norm = require('../scripts/norm.js');

const BRONNEN = norm.METERBRONNEN;
const ALLE_METERS = Object.values(BRONNEN).flat();

let volledig;
test.before(() => { volledig = norm.meet(); });

test('de tabel dekt precies de meters die meet() teruggeeft -- geen meer, geen minder', () => {
  const uitMeet = Object.keys(volledig).sort();
  const uitTabel = [...ALLE_METERS].sort();
  assert.deepEqual(uitTabel, uitMeet,
    'METERBRONNEN en het antwoord van meet() lopen uiteen; een meter zonder bron krijgt stil een verkeerd getal');
  assert.equal(new Set(ALLE_METERS).size, ALLE_METERS.length,
    'geen enkele meter staat in twee bronnen: dan is niet te zeggen wat hem vernieuwt');
});

for (const [bron, meters] of Object.entries(BRONNEN)) {
  test('bron "' + bron + '": een deelmeting geeft exact dezelfde getallen als de volledige', () => {
    const deel = norm.meet({ alleen: meters });
    assert.deepEqual(Object.keys(deel).sort(), [...meters].sort(),
      'een deelmeting geeft precies de gevraagde meters terug en niets anders');
    for (const m of meters) {
      assert.equal(deel[m], volledig[m],
        'meter ' + m + ' staat in bron "' + bron + '" maar geeft daar een ander getal (' +
        deel[m] + ') dan bij een volledige meting (' + volledig[m] + ')');
      assert.notEqual(deel[m], undefined, 'meter ' + m + ' komt als undefined terug uit bron "' + bron + '"');
    }
  });
}

/* EN DE GETALLEN ZELF MOETEN KLOPPEN, NIET ALLEEN MET ELKAAR.

   De toetsen hierboven vergelijken meet() met meet() -- twee wegen door
   DEZELFDE code. Dat is precies wat het contract nodig heeft, maar het is ook
   een blinde vlek: een mechanische mutatie in norm.js verschuift beide kanten
   even hard en de gelijkheid blijft staan. De mutatiemotor liet dat ook zien --
   hij draaide `===` om in norm.js en deze toets bleef groen (MUTATIES.json:
   'overleefd'). Dat is de vorm waar LAT-regel 9 voor waarschuwt.

   Dus hier een paar getallen die LANGS EEN ANDERE WEG zijn uitgerekend: uit de
   map en uit package.json, hier ter plekke, zonder norm.js. Wie de telling in
   norm.js verandert, ziet dat hier. */
test('de getallen kloppen met een telling die norm.js niet heeft gedaan', () => {
  const fs = require('fs');
  const path = require('path');
  const testMap = path.join(__dirname);
  const inMap = fs.readdirSync(testMap);
  assert.equal(volledig.testbestanden, inMap.filter(f => f.endsWith('.test.js')).length,
    'testbestanden telt iets anders dan het aantal .test.js-bestanden in test/');
  assert.equal(volledig.e2eBestanden, inMap.filter(f => f.endsWith('.e2e.js')).length,
    'e2eBestanden telt iets anders dan het aantal .e2e.js-bestanden in test/');

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(volledig.dependencies, Object.keys(pkg.dependencies || {}).length,
    'dependencies telt iets anders dan package.json zegt');
  assert.equal(volledig.dependencies, 0,
    'de RUNTIME hoort zonder npm-pakketten te draaien; staat er nu wel een, dan is dat een besluit en geen meting');
  assert.equal(volledig.devPakketten, Object.keys(pkg.devDependencies || {}).length,
    'devPakketten telt iets anders dan package.json zegt');

  /* En de dure kant: een percentage dat buiten 0..100 valt is geen meting maar
     een rekenfout, en die zou anders alleen opvallen als de norm net verschuift. */
  assert.ok(volledig.dekkingPct > 0 && volledig.dekkingPct <= 100,
    'dekkingPct valt buiten 0..100: ' + volledig.dekkingPct);
  assert.ok(volledig.endpointsZonderTest >= 0 && Number.isInteger(volledig.endpointsZonderTest),
    'endpointsZonderTest is geen geheel getal >= 0: ' + volledig.endpointsZonderTest);
});

test('een onbekende meter is een FOUT en geen lege uitslag', () => {
  assert.throws(() => norm.meet({ alleen: ['zzBestaatNiet'] }), /kent de meter/,
    'een typefout in een meternaam hoort te gooien; een leeg antwoord zou als "geen verschil" doorgaan');
});

/* EN DE BESPARING MOET ER ZIJN. Zonder deze toets kan iemand nodig() op `true`
   vastzetten "voor de zekerheid" en dan is de ijking weer een kwartier langer
   zonder dat iets klaagt (LAT-regel 10). De keuring is de dure bron; een
   deelmeting die hem niet nodig heeft, hoort merkbaar sneller te zijn. */
test('de besparing bestaat: een meting zonder de keuring is veel sneller dan een volledige', () => {
  const t0 = Date.now();
  norm.meet({ alleen: ['testbestanden'] });
  const goedkoop = Date.now() - t0;
  const t1 = Date.now();
  norm.meet({ alleen: ['dekkingPct'] });
  const duur = Date.now() - t1;
  assert.ok(goedkoop * 4 < duur,
    'een meter zonder de keuring (' + goedkoop + ' ms) hoort veel goedkoper te zijn dan een meter mét (' +
    duur + ' ms); staat nodig() nog wel aan?');
});

/* ============================================================================
   EN NU EEN LAAG DIEPER: DE KEURING ZELF IS OPDEELBAAR.

   De toetsen hierboven bewaken dat een deelverzameling BRONNEN hetzelfde zegt
   als alles. Maar de duurste bron -- de keuring -- was zelf nog ondeelbaar: acht
   meters, en voor elk ervan startte er een volledige keuring over de codebase.

   Gemeten, los, op deze codebase:

     dekking       40,08 s     <- start de routekaart, dus een echte server
     ongebruikt    11,49 s
     beloftes       0,32 s
     dubbelingen    0,08 s
     i18n / privacy / uitschieters / pariteit samen 0,04 s

   Twee analyses zijn 99,2% van de tijd. De ijking van keuringTeGroot betaalde
   dus 46 seconden voor een analyse van 0,01 seconde -- zes van die ijkingen
   waren samen 290 van de 374 seconden van de ijklus.

   scripts/keuring.js neemt nu `--alleen <analyses>`, en norm.js leidt uit
   KEURING_ANALYSES af welke hij nodig heeft. Dat is dezelfde scherpe rand als
   hierboven, een verdieping lager: staat een meter bij de verkeerde analyse,
   dan komt zijn getal uit een ronde die niet naar zijn onderwerp heeft gekeken.
   ========================================================================== */
test('de keuringtabel is volledig, en wie erin ontbreekt wordt LANGZAAM en niet stil verkeerd', () => {
  const tabel = norm.KEURING_ANALYSES;
  assert.ok(tabel && Object.keys(tabel).length, 'de tabel bestaat');
  /* stuk en scheef tellen bevindingen over ALLE analyses heen; die horen er
     juist NIET in te staan, want dan zou een deelronde ze te laag zetten en
     zou een kleiner getal als een betere score gelden. */
  for (const m of ['keuringStuk', 'keuringScheef']) {
    assert.equal(tabel[m], undefined,
      m + ' hoort NIET in de tabel: hij telt over alle analyses heen, dus een deelronde geeft een te laag getal');
  }
  /* En elke meter die er wel in staat, noemt bestaande analyses. */
  const bekend = new Set(require('../scripts/keuring.js').ALLE_ANALYSES);
  for (const [meter, analyses] of Object.entries(tabel)) {
    assert.ok(BRONNEN.keuring.includes(meter), meter + ' staat in de keuringtabel maar is geen keuringmeter');
    for (const a of analyses) assert.ok(bekend.has(a), meter + ' vraagt om onbekende analyse "' + a + '"');
  }
});

test('een deelronde van de keuring geeft exact hetzelfde getal als de volle ronde', () => {
  /* ELKE METER APART, en dat is niet uit netheid maar omdat het anders niets
     bewijst. Eerst stonden keuringTeGroot en keuringOmvang hier samen in een
     groep. Toen ik keuringTeGroot bij de VERKEERDE analyse zette, bleef deze
     toets groen: de groep vroeg samen om allebei de analyses, dus de verkeerd
     ingedeelde meter kreeg zijn getal alsnog van de analyse van zijn buurman
     (AFGESLAGEN). Een groepsmeting kan een verkeerde indeling per definitie niet
     zien.

     Apart meten kost hier niets -- 0,11 s, 0,11 s en 0,18 s -- want dat is nou
     juist wat deze reparatie mogelijk maakt. De dekkingstrio staat er niet bij:
     die drie kosten 37 s samen en worden al gedekt door de bron-toets hierboven,
     die de volle keuring draait. */
  for (const groep of [['keuringTeGroot'], ['keuringOmvang'], ['keuringDubbeling']]) {
    const deel = norm.meet({ alleen: groep });
    for (const m of groep) {
      assert.equal(typeof deel[m], 'number',
        m + ' kwam niet als getal terug uit de deelronde (' + JSON.stringify(deel[m]) + '); ' +
        'een analyse die niet gedraaid heeft hoort undefined te geven en geen nul, maar hier HOORT hij te draaien');
      assert.equal(deel[m], volledig[m],
        m + ' zegt in een deelronde ' + deel[m] + ' en in de volle ronde ' + volledig[m] +
        '; dan komt zijn getal uit een ronde die niet naar zijn onderwerp heeft gekeken');
    }
  }
});

test('een deelronde levert GEEN stuk/scheef, en dat is opzet en geen omissie', () => {
  /* Rechtstreeks op de keuring, want norm.js vraagt bij die twee meters juist de
     volle ronde aan. De eigenschap die hier vastligt is die van keuring.js zelf:
     een deelronde weet niet hoeveel bevindingen er in het geheel zijn, en zegt
     dat met null in plaats van met een te laag getal (LAT-regel 3). */
  const { keur } = require('../scripts/keuring.js');
  const deel = keur(['uitschieters']);
  assert.equal(deel.volledig, false);
  assert.deepEqual(deel.analyses, ['uitschieters']);
  assert.equal(deel.stuk, null, 'stuk hoort null te zijn bij een deelronde, niet 0');
  assert.equal(deel.scheef, null, 'scheef ook');
  assert.equal(deel.beter, null, 'beter ook');
  assert.equal(typeof deel.cijfers.uitschieters.teGroot, 'number', 'wat er WEL gevraagd is, staat er gewoon');
  assert.equal(deel.cijfers.dekking, undefined, 'en wat niet gevraagd is, ontbreekt in plaats van nul te zijn');
});
