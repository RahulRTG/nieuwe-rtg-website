/* ============================================================================
   DE OPENINGEN: DRIE STANDEN DIE NOOIT DOOR ELKAAR MOGEN LOPEN

   HDI.md par. 7 regel 6 (laag 6, Opportunity). De laag zelf is klein; wat hem
   waardevol maakt is precies wat hier kan zakken. Zeven zinnen:

     1. de drie standen zijn onderscheiden en dragen elk wat ze moeten dragen.
        LET OP: sinds de ouderingang op de kinderopvang bestaat, draagt GEEN
        ENKEL terrein nog `geen-ingang` of `geen-bron` -- alle vijf zijn
        bereikbaar. Die twee standen blijven in de woordenlijst en worden hier
        op `maakRij` getoetst, want een tak die niemand doorloopt kan stil
        breken;
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
     - `bron` van opvang terug op `geen-ingang` zetten (de deur weer dicht): RAAK op 1;
     - een niet te plaatsen knelpunt stil op 'werk' zetten: RAAK op 2;
     - `plekken: null` vervangen door een verzonnen aantal: RAAK op 3;
     - `zelfDoen` ook bij een `geen-ingang` meegeven: RAAK op 5;
     - `dektNiet` niet doorgeven aan het antwoord: RAAK op 5;
     - het `terreinen`-blok beperken tot de geraakte terreinen: RAAK op 6;
     - `dektNiet` van een bron uit de kaart halen: RAAK op 8;
     - de kaart naar een niet-bestaande route laten wijzen: RAAK op 9.

   EEN VAN DIE MUTATIES BEET EERST NIET, en dat staat hier omdat het de fout is
   waar dit bestand tegen bedoeld is. `dektNiet` uit het ANTWOORD halen liet alle
   negen toetsen groen: toets 8 keek naar de KAART, en niemand keek of die zin de
   lezer ook bereikte. Een API-lezer miste dus precies de regel die "bron" van
   "dit is geregeld" onderscheidt, terwijl de meter groen stond. Dat is LAT.md
   regel 9 in het klein; de assertie in toets 5 is de reparatie.

   WAAROM DIT EEN ZUIVERE TOETS IS. Net als de motor raakt deze laag geen opslag
   aan; hij krijgt de knelpunten als argument, en `maakRij` krijgt zelfs de
   kaartregel als argument. De kaart in ./openingen-kaart.js
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

test('1. de drie standen zijn onderscheiden, en dragen elk wat ze moeten dragen', () => {
  /* SINDS 2 SEPTEMBER 2026 DRAAGT GEEN ENKEL TERREIN MEER `geen-ingang` OF
     `geen-bron`. De ouderingang op de kinderopvang (kern/verzorging/opvangleden.js)
     was de laatste `geen-ingang`, en alle vijf de terreinen zijn nu bereikbaar.

     Dat maakt deze toets niet overbodig maar juist nodig: de twee standen
     blijven in de woordenlijst, want een volgend terrein kan onbereikbaar of leeg
     zijn. Zonder een toets erop zou hun gedrag nergens meer worden uitgevoerd, en
     een tak die niemand doorloopt is een tak die stil kan breken. Daarom hangt
     deze toets aan `maakRij` met een kaartregel als argument, en niet aan een
     terrein dat toevallig die stand draagt. */
  const knel = { id: 'x', wat: 'iets', blokkeertWegen: 1 };

  const geenIngang = O.maakRij(knel, 'opvang', { stand: 'geen-ingang',
    wat: 'het bestaat wel', waarom: 'alleen de aanbieder kan erbij', bron: 'ergens.js' });
  assert.equal(geenIngang.ingang, null, 'geen-ingang betekent geen ingang, ook niet een die er half op lijkt');
  assert.equal(geenIngang.zelfDoen, null, 'de zin "dit is de ingang" hoort niet onder iets zonder ingang');
  assert.ok(geenIngang.watErIs, 'bij geen-ingang hoort te staan WAT er dan wel is; anders is het onderscheid onzichtbaar');
  assert.ok(geenIngang.waarom, 'en waarom de mens er niet bij kan');

  const geenBron = O.maakRij(knel, 'vervoer', { stand: 'geen-bron', waarom: 'er is hier niets' });
  assert.equal(geenBron.watErIs, null, 'geen-bron betekent dat er niets is; dan valt er ook niets te beschrijven');
  assert.ok(geenBron.waarom, 'een leegte zonder reden is een gat');
  assert.notEqual(geenBron.stand, geenIngang.stand, 'de twee leegtes horen twee verschillende standen te dragen');

  const brn = O.maakRij(knel, 'werk', { stand: 'bron', ingang: '/api/x', wat: 'iets',
    dektNiet: 'maar het lost dit niet op, en dat is een hele zin', bron: 'ergens.js' });
  assert.equal(brn.ingang, '/api/x', 'een bron hoort zijn ingang te dragen');
  assert.ok(brn.zelfDoen, 'en de zin dat RTG hier niets voor u aanvraagt');

  /* En op de ECHTE kaart: opvang is nu bereikbaar. Deze regel bewaakt dat de
     ouderingang niet stilletjes weer verdwijnt. */
  assert.equal(KAART.KAART.opvang.stand, 'bron',
    'kinderopvang heeft sinds de ouderingang een deur; zakt dit, dan is die deur weg');
  assert.equal(KAART.KAART.opvang.ingang, '/api/opvang');
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

  /* AS 2 IN HET ANTWOORD, en niet alleen in de kaart. Toets 8 keek naar de kaart
     en liet daardoor een mutatie door die `dektNiet` uit het ANTWOORD haalde:
     alle negen toetsen bleven groen terwijl een lezer van de API precies de zin
     miste die "bron" van "dit is geregeld" onderscheidt. Dat is LAT.md regel 9 --
     een toets die op de verkeerde bewering vangt -- en het is de reden dat deze
     regel er apart bij staat. */
  for (const o of r.openingen) {
    if (o.stand !== 'bron') continue;
    assert.ok(o.dektNiet && o.dektNiet.length > 30,
      'de opening voor ' + o.terrein + ' is een bron zonder dektNiet in het ANTWOORD; ' +
      'dan leest "bron" voor de lezer alsnog als "dit lost uw probleem op"');
  }

  /* De tegenhanger -- geen ingang, dus ook geen pad en geen belofte -- staat in
     toets 1 op `maakRij`, omdat geen enkel terrein die stand nog draagt. */
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
      /* AS 2 verplicht. Dit is de toets die de fout van 2 september 2026 had
         gevonden als hij er toen was geweest: `bron` zonder `dektNiet` leest als
         "dit is geregeld", en dat is een belofte die dit huis niet waarmaakt. */
      assert.ok(k.dektNiet && k.dektNiet.length > 30,
        'terrein ' + t + ' is een bron zonder dektNiet; dan leest "bron" als "dit lost uw probleem op"');
    } else {
      assert.ok(!k.ingang, 'een terrein zonder bruikbare ingang hoort er geen te noemen: ' + t);
      assert.ok(k.waarom && k.waarom.length > 20, 'een leegte zonder reden is een gat: ' + t);
    }
    assert.ok(KAART.WOORDEN[t] && KAART.WOORDEN[t].length,
      'terrein ' + t + ' heeft geen woorden en is dus nooit te bereiken');
  }
});

test('10. een randvoorwaarde die twee terreinen raakt, wordt niet voor u gekozen', () => {
  /* DE FOUT DIE DIT AANWEES, en hij kwam uit een ronde tegen een draaiende
     server en niet uit nadenken. `terreinVan` gaf de EERSTE treffer in de
     volgorde van TERREINEN, en dus belandde "kunnen reizen naar de opleiding" op
     `opleiding` (dat woord staat erin en staat eerder in de lijst) en "een woning
     waar de kinderen kunnen slapen" op `opvang` (want "kinderen"). Het terrein
     waar het knelpunt werkelijk over ging werd stil weggegooid, en de mens kreeg
     een ingang die zijn probleem niet raakte. Willekeur die eruitziet als een
     oordeel -- dezelfde vorm als de afkapgrens uit EXECUTIE.md die midden in een
     gelijke score sneed. */
  const r = O.voorKnelpunten([
    { id: 'reizen', wat: 'kunnen reizen naar de opleiding', blokkeertWegen: 1 },
    { id: 'woning', wat: 'een woning waar de kinderen kunnen slapen', blokkeertWegen: 1 }
  ]);
  const terreinenVoor = (id) => r.openingen.filter(o => o.id === id).map(o => o.terrein).sort();

  assert.deepEqual(terreinenVoor('reizen'), ['opleiding', 'vervoer'],
    'beide rakende terreinen horen terug te komen; vervoer wegvallen laten is de fout zelf');
  assert.deepEqual(terreinenVoor('woning'), ['opvang', 'wonen'],
    'ook hier: opvang raakt op "kinderen", wonen op "woning", en er wordt niet gekozen');

  assert.ok(r.aannames.some(a => /meer dan een terrein/.test(a) && /niet gekozen/.test(a)),
    'dat er meer dan een terrein raakte hoort in de aannames te staan; anders leest de dubbele rij als een fout');
});

test('9. elke ingang die de kaart noemt bestaat echt', () => {
  /* Een kaart die naar een dood pad wijst is erger dan een lege kaart: hij
     stuurt een mens ergens heen. Dat is de fout die MAGNAATLAB.md par. 3
     beschrijft -- een cap die een document noemt en die nergens bestaat, met een
     toets eromheen die groen bleef omdat hij zijn eigen invoer verzon.

     De hele routeboom wordt gelezen en niet twee bestanden: met twee bestanden
     is deze toets zelf de volgende plek waar een nieuwe ingang stil langs komt. */
  const fs = require('fs'), path = require('path');
  const wortel = path.join(__dirname, '..', 'server');
  let bron = '';
  (function lees(map) {
    for (const naam of fs.readdirSync(map)) {
      if (naam === 'node_modules' || naam === 'data') continue;
      const p = path.join(map, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) lees(p);
      else if (naam.endsWith('.js')) bron += fs.readFileSync(p, 'utf8');
    }
  })(wortel);

  for (const t of KAART.TERREINEN) {
    const k = KAART.KAART[t];
    if (k.stand !== 'bron') continue;
    const regel = new RegExp("app\\.post\\(\\s*'" + k.ingang.replace(/\//g, '\\/') + "'\\s*,");
    assert.ok(regel.test(bron),
      'de kaart noemt ' + k.ingang + ' als ingang van ' + t + ', maar die route staat niet in server/');
  }

  /* OF DIE INGANG EEN POORT HEEFT, WORDT HIER MET OPZET NIET GETOETST. Die vraag
     is van keuringsregel 28 (scripts/check.js), die hem over alle routes stelt en
     drie poortvormen kent -- middleware, een poort-hulpje in de handler, en een
     handler die zelf 401/403 kan antwoorden. Die regel is over drie rondes
     bijgesteld en de kop erboven noemt de drie manieren waarop een simpelere
     versie ernaast zat.

     Mijn eerste poging hier was zo'n simpelere versie: hij keek alleen naar
     middleware, en verklaarde /api/rtf/beroepen daarom voor een open deur. Dat is
     onjuist -- de poort zit daar in de handler (`profiel(req, res)` weigert met
     403 zonder gezinscode en profieltoken). Een tweede, zwakkere poortmeter naast
     regel 28 is precies wat LAT.md regel 4 verbiedt, en hij zou hier een vals
     alarm hebben opgeleverd over een route die niets mankeert. */
});
