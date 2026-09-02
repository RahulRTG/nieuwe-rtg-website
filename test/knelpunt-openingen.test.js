/* ============================================================================
   DE OPENINGEN: DRIE STANDEN DIE NOOIT DOOR ELKAAR MOGEN LOPEN

   HDI.md par. 7 regel 6 (laag 6, Opportunity). De laag zelf is klein; wat hem
   waardevol maakt is precies wat hier kan zakken. Zeven zinnen:

     1. `geen-ingang` is NIET `geen-bron` -- kinderopvang bestaat in dit huis en
        een ouder kan er niet bij. Wie die twee samenvat, vertelt een moeder dat
        er geen opvang is terwijl er een register vol groepen staat;
     2. een knelpunt dat wij niet kunnen plaatsen verdwijnt niet en krijgt geen
        verzonnen terrein;
     3. er komt nooit een aantal plekken of een wachttijd uit -- geen bron
        levert die, en hem tonen zou hem verzinnen;
     4. er zit geen enkele geschiktheidstoets in: er komt nooit uit dat iets
        niets voor u is;
     5. bij een bruikbare ingang staat altijd dat RTG zelf niets aanvraagt;
     6. de stand van ELK terrein komt mee, ook die waar dit knelpunt niet op
        ligt -- anders leest "niets" als een van de drie standen;
     7. er staat geen getal op een mens: geen score, geen rang, geen plaats.

   MET EEN MUTATIE NAGETROKKEN (LAT.md regel 2, en op de JUISTE bewering -- dat
   ging in deze reeks twee keer mis, zie HDI.md par. 7.5 en 7.9):
     - `geen-ingang` van opvang op `geen-bron` zetten: RAAK op 1;
     - een niet te plaatsen knelpunt stil op 'werk' zetten: RAAK op 2;
     - `plekken: null` vervangen door een verzonnen aantal: RAAK op 3;
     - `zelfDoen` ook bij een `geen-ingang` meegeven: RAAK op 5;
     - het `terreinen`-blok beperken tot de geraakte terreinen: RAAK op 6;
     - de kaart naar een niet-bestaande route laten wijzen (/api/rtf/beroepen
       vervangen door /api/rtf/opleidingen): RAAK op 8.

   WAAROM DIT EEN ZUIVERE TOETS IS. Net als de motor raakt deze laag geen opslag
   aan; hij krijgt de knelpunten als argument. De kaart in ./openingen-kaart.js
   is een MEETUITSLAG, en toets 8 houdt vast dat die uitslag zichzelf niet
   tegenspreekt -- een terrein zonder bron dat geen reden draagt, is een gat dat
   zich voordoet als een besluit.

   Draai los: node --test test/knelpunt-openingen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');

const K = require('../server/kern/knelpunt');
const O = require('../server/kern/knelpunt/openingen');
const KAART = require('../server/kern/knelpunt/openingen-kaart');

/* Hetzelfde voorbeeld als test/knelpunt.test.js, zodat de twee lagen op
   dezelfde werkelijkheid staan: Sarah wil verpleegkundige worden en de
   bottleneck is opvang. */
const SARAH = {
  doel: 'verpleegkundige worden',
  randvoorwaarden: [
    { id: 'opvang', wat: 'opvang voor de kinderen tijdens lesuren', stand: 'ontbreekt' },
    { id: 'vervoer', wat: 'kunnen reizen naar de opleiding', stand: 'vervuld' },
    { id: 'inkomen', wat: 'genoeg inkomen tijdens de opleiding', stand: 'ontbreekt' }
  ],
  manieren: [
    { id: 'voltijd', wat: 'voltijd opleiding', nodig: ['opvang', 'vervoer', 'inkomen'] },
    { id: 'deeltijd', wat: 'deeltijd naast mijn werk', nodig: ['opvang', 'vervoer'] }
  ]
};

const opvangVan = (r) => r.openingen.find(o => o.id === 'opvang');

test('1. geen-ingang is niet geen-bron', () => {
  const r = O.voorKnelpunten(K.reken(SARAH).knelpunten);
  const o = opvangVan(r);
  assert.equal(o.terrein, 'opvang');
  assert.equal(o.stand, 'geen-ingang',
    'kinderopvang BESTAAT in dit huis; alleen de ouder kan er niet bij. Dat is een andere uitslag dan "er is niets"');
  assert.ok(/bestaat hier wel/i.test(o.watErIs || ''),
    'bij geen-ingang hoort te staan WAT er dan wel is, anders is het onderscheid onzichtbaar');
  assert.match(o.waarom, /supplier|aanbieder|partnerroute/i,
    'en waarom de mens er niet bij kan');

  // en het terrein dat er echt niets heeft, heet anders
  const vervoer = KAART.KAART.vervoer;
  assert.equal(vervoer.stand, 'geen-bron', 'vervoer heeft in dit huis geen enkel aanbod');
  assert.notEqual(vervoer.stand, KAART.KAART.opvang.stand,
    'de twee leegtes horen twee verschillende standen te dragen');
});

test('2. een knelpunt dat wij niet kunnen plaatsen blijft staan, zonder verzonnen terrein', () => {
  const r = O.voorKnelpunten([{ id: 'xyz', wat: 'iets wat onze woordenlijst niet kent', blokkeertWegen: 1 }]);
  assert.equal(r.openingen.length, 1, 'hij hoort niet uit de lijst te verdwijnen');
  const o = r.openingen[0];
  assert.equal(o.terrein, null, 'er hoort geen terrein te worden geraden');
  assert.equal(o.stand, 'niet-geplaatst');
  assert.match(o.waarom, /woordenlijst/i,
    'en de uitleg hoort te zeggen dat het aan ONS ligt en niet aan zijn knelpunt');
  assert.ok(r.aannames.some(a => /Niet thuisgebracht/.test(a)),
    'wat wij niet konden plaatsen hoort in de aannames te staan, niet stil te verdwijnen');
});

test('3. er komt nooit een aantal plekken of een wachttijd uit', () => {
  const r = O.voorKnelpunten(K.reken(SARAH).knelpunten);
  for (const o of r.openingen) {
    assert.equal(o.plekken, null, 'geen bron levert vrije plekken per opening; een getal zou verzonnen zijn');
    assert.equal(o.wachttijd, null, 'idem voor de wachttijd');
  }
  assert.ok(r.aannames.some(a => /verzinnen/.test(a)),
    'dat er geen aantallen zijn hoort in de aannames te staan');
});

test('4. er zit geen geschiktheidstoets in', () => {
  const r = O.voorKnelpunten(K.reken(SARAH).knelpunten);
  assert.match(r.grens, /nooit uit dat iets niets voor u is/,
    'het antwoord hoort zelf te zeggen dat het niets afwijst');
  const heel = JSON.stringify(r);
  assert.ok(!/komt u niet in aanmerking|voldoet niet|niet geschikt|afgewezen/i.test(heel),
    'er hoort nergens een afwijzing in het antwoord te staan');
});

test('5. bij een bruikbare ingang staat dat RTG zelf niets aanvraagt', () => {
  const r = O.voorKnelpunten([
    { id: 'inkomen', wat: 'genoeg inkomen', blokkeertWegen: 1 },
    { id: 'opvang', wat: 'opvang voor de kinderen', blokkeertWegen: 1 }
  ]);
  const werk = r.openingen.find(o => o.terrein === 'werk');
  assert.equal(werk.stand, 'bron');
  assert.ok(werk.ingang, 'een echte bron hoort een ingang te noemen');
  assert.match(werk.zelfDoen, /reserveert niets/,
    'bij een ingang hoort de zin dat RTG hier niets voor u aanvraagt (COMMERCE.md par. 3)');

  // en bij een stand die GEEN ingang is, hoort er ook geen ingang en geen belofte te staan
  const opvang = opvangVan(r);
  assert.equal(opvang.ingang, null, 'zonder ingang hoort er geen pad te staan waar de mens niet langs kan');
  assert.equal(opvang.zelfDoen, null,
    'de zin "dit is de ingang" onder iets waar geen ingang is, is een belofte die niet waar is');
});

test('6. de stand van elk terrein komt mee, ook de niet-geraakte', () => {
  const r = O.voorKnelpunten([{ id: 'inkomen', wat: 'genoeg inkomen', blokkeertWegen: 1 }]);
  assert.equal(r.terreinen.length, KAART.TERREINEN.length,
    'alle terreinen horen mee te komen; anders leest "niets gevonden" als een van de drie standen');
  const namen = r.terreinen.map(t => t.terrein);
  for (const t of KAART.TERREINEN) assert.ok(namen.includes(t), 'terrein ' + t + ' ontbreekt');
  for (const t of r.terreinen) {
    if (t.stand !== 'bron') {
      assert.ok(t.waarom && t.waarom.length > 20,
        'terrein ' + t.terrein + ' heeft geen bron en geen reden; een leegte zonder reden is een gat');
    }
  }
});

test('7. er staat geen getal op een mens', () => {
  const r = O.voorKnelpunten(K.reken(SARAH).knelpunten);
  for (const o of r.openingen) {
    for (const sleutel of Object.keys(o)) {
      assert.ok(!/score|cijfer|rang|kans|positie|percentiel/i.test(sleutel),
        'een opening draagt een score-achtig veld (' + sleutel + '); dat hoort hier niet te bestaan');
    }
  }
});

test('8. de kaart spreekt zichzelf niet tegen', () => {
  for (const t of KAART.TERREINEN) {
    const k = KAART.KAART[t];
    assert.ok(k, 'terrein ' + t + ' staat in TERREINEN maar niet in de kaart');
    assert.ok(['bron', 'geen-ingang', 'geen-bron'].includes(k.stand), 'onbekende stand op ' + t);
    if (k.stand === 'bron') {
      assert.ok(k.ingang && k.ingang.startsWith('/api/'), 'een bron hoort een echte ingang te noemen: ' + t);
    } else {
      assert.ok(!k.ingang, 'een terrein zonder bruikbare ingang hoort er geen te noemen: ' + t);
      assert.ok(k.waarom && k.waarom.length > 20, 'een leegte zonder reden is een gat: ' + t);
    }
    assert.ok(KAART.WOORDEN[t] && KAART.WOORDEN[t].length,
      'terrein ' + t + ' heeft geen woorden en is dus nooit te bereiken');
  }
  /* En de ingangen die de kaart noemt, bestaan ook echt. Een kaart die naar een
     dood pad wijst is erger dan een lege kaart: hij stuurt een mens ergens
     heen. Dit is de fout die MAGNAATLAB.md par. 3 beschrijft als een cap die
     een document noemt en die nergens bestaat. */
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'routes', 'rtfschool.js'), 'utf8') +
    require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'routes', 'member', 'werk', 'rtf.js'), 'utf8');
  for (const t of KAART.TERREINEN) {
    const k = KAART.KAART[t];
    if (k.stand !== 'bron') continue;
    assert.ok(bron.includes("'" + k.ingang + "'"),
      'de kaart noemt ' + k.ingang + ' als ingang, maar die route staat niet in de bron');
  }
});
