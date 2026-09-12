/* HET MENSENTAAL-CONTRACT -- klopt het corpus, en dekt de rail het?

   server/kern/stuur/menstaal.json zegt per menselijke zin wat er MAG gebeuren.
   Dit bestand bewaakt twee dingen: dat het corpus zichzelf niet tegenspreekt,
   en dat de deterministische rail er niet stilletjes van afdrijft.

   WAAROM HET CORPUS EN HET RAIL-SCRIPT GESCHEIDEN ZIJN. Een corpus dat ook
   draagt wat de rail DOET, kan zichzelf gelijk geven -- dan toets je of de rail
   doet wat de rail zegt. De verwachting hoort los te staan van de uitvoering,
   en dat is meteen wat hem bruikbaar maakt voor een andere rail (fase 12).

   Elke bewering draagt zijn MUTATIE. Draai los:
     node --test test/menstaal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const corpus = require('../server/kern/stuur/menstaal.json');
const { TREDEN } = require('../server/kern/stuur/plafond');
const { maakCorpusRail, normaliseer } = require('../server/kern/stuur/rail-corpus');
const ZINNEN = require('../server/kern/stuur/rail-corpus-zinnen');

const G = corpus.gevallen;
const L = corpus.woordenlijsten;
const VERPLICHT = ['id', 'input', 'klasse', 'context', 'verwachteRoute', 'ambigu',
  'sideEffectMax', 'maxMandaat', 'blockingVraagMax', 'architectuurKeuzesMax', 'beproefbaar'];

/* De gevallen die vandaag te draaien zijn. FASE4 hangt aan context, en context
   bereikt de resolver nog niet. */
const NU = G.filter(g => g.beproefbaar === 'NU');

test('1. er komt GEEN zesde gezagsvocabulaire bij', () => {
  /* INT-01. `trede` in dit corpus moet letterlijk de lijst van
     kern/stuur/plafond.js zijn -- niet een eigen ladder die er toevallig op
     lijkt en over een jaar iets anders zegt.
     MUTATIE: zet een vijfde trede in menstaal.json, of hernoem er een. */
  assert.deepEqual(L.trede, [...TREDEN],
    'de tredenlijst in menstaal.json wijkt af van kern/stuur/plafond.js');
});

test('2. elk geval draagt alle velden, en niets buiten de woordenlijst', () => {
  /* Een vrij tekstveld levert statussen op die geen enkele afhandeling kent.
     MUTATIE: haal `maxMandaat` bij een geval weg, of zet er `misschien` in. */
  assert.ok(G.length >= 30, 'het corpus hoort minstens 30 gevallen te dragen, is ' + G.length);
  for (const g of G) {
    for (const v of VERPLICHT)
      assert.ok(Object.prototype.hasOwnProperty.call(g, v), g.id + ' mist het veld ' + v);
    assert.ok(L.klasse.includes(g.klasse), g.id + ': onbekende klasse ' + g.klasse);
    assert.ok(L.verwachteRoute.includes(g.verwachteRoute), g.id + ': onbekende route ' + g.verwachteRoute);
    assert.ok(L.trede.includes(g.sideEffectMax), g.id + ': onbekende sideEffectMax ' + g.sideEffectMax);
    assert.ok(L.trede.includes(g.maxMandaat), g.id + ': onbekende maxMandaat ' + g.maxMandaat);
    assert.ok(L.beproefbaar.includes(g.beproefbaar), g.id + ': onbekende beproefbaarheid');
    assert.equal(typeof g.ambigu, 'boolean', g.id + ': ambigu hoort een boolean te zijn');
    assert.equal(typeof g.blockingVraagMax, 'number', g.id + ': blockingVraagMax hoort een getal te zijn');
  }
});

test('3. de kenmerken zijn uniek', () => {
  /* Dezelfde zin komt meermaals voor met een ANDERE context -- dat is de hele
     opzet. De sleutel is dus het kenmerk en niet de zin.
     MUTATIE: geef twee gevallen hetzelfde id. */
  const gezien = new Set();
  for (const g of G) {
    assert.ok(!gezien.has(g.id), 'twee gevallen dragen het kenmerk ' + g.id);
    gezien.add(g.id);
  }
});

test('4. elke klasse is echt bezet', () => {
  /* Een corpus dat vijf klassen belooft en er drie vult, meet drie klassen.
     MUTATIE: haal alle FOLLOWUP-gevallen weg. */
  for (const k of L.klasse) {
    const n = G.filter(g => g.klasse === k).length;
    assert.ok(n >= 5, 'klasse ' + k + ' heeft maar ' + n + ' geval(len); minstens 5');
  }
});

test('5. dezelfde zin staat onder MEER dan een contextconditie', () => {
  /* Dit is wat het corpus meer maakt dan veertig strings: "die andere" met
     twee alternatieven hoort iets anders te doen dan "die andere" zonder
     vergelijking. Zonder zulke paren toetst het corpus alleen woorden.
     MUTATIE: houd van elke zin maar een variant over. */
  const perZin = new Map();
  for (const g of G) {
    const k = normaliseer(g.input);
    perZin.set(k, (perZin.get(k) || 0) + 1);
  }
  const meervoudig = [...perZin.values()].filter(n => n > 1).length;
  assert.ok(meervoudig >= 3,
    'maar ' + meervoudig + ' zin(nen) komen onder meer dan een context voor; dan meet het corpus woorden en geen gedrag');
});

test('6. een ambigu geval voert NOOIT iets uit', () => {
  /* De scherpste veiligheidsregel van deze laag: bij twee plausibele objecten
     wordt er niet gegokt. Een geval dat zichzelf ambigu noemt en toch een
     effect toestaat, is een gat in het contract zelf.
     MUTATIE: zet `sideEffectMax` van een ambigu geval op `klaarzetten`. */
  for (const g of G.filter(x => x.ambigu)) {
    assert.equal(g.verwachteRoute, 'CLARIFY', g.id + ': ambigu maar niet CLARIFY');
    assert.equal(g.sideEffectMax, 'geen', g.id + ': ambigu en toch een effect toegestaan');
    assert.equal(g.maxMandaat, 'geen', g.id + ': ambigu en toch mandaat boven geen');
  }
});

test('7. een INFORMATION-vraag raakt de operationele motor nooit', () => {
  /* GEEN ENKELE BESTAANDE VRAAG MAG DOOR DE ROUTEWISSEL AUTOMATISCH EEN SIDE
     EFFECT KRIJGEN. In het contract betekent dat: uitleg vragen komt nooit
     boven `geen`.
     MUTATIE: zet een INFORMATION-geval op route OPERATIONAL. */
  for (const g of G.filter(x => x.klasse === 'INFORMATION')) {
    assert.equal(g.verwachteRoute, 'ANSWER', g.id + ': INFORMATION hoort ANSWER te zijn');
    assert.equal(g.sideEffectMax, 'geen', g.id + ': een uitlegvraag mag niets veranderen');
  }
});

test('8. geen enkel geval vraagt meer dan een blokkerende vraag tegelijk', () => {
  /* Punt 10 van de opdracht: maximaal EEN noodzakelijke vraag per moment, en
     nooit een formulier van acht velden.
     MUTATIE: zet blockingVraagMax op 2 bij een geval. */
  for (const g of G)
    assert.ok(g.blockingVraagMax <= 1, g.id + ' vraagt er ' + g.blockingVraagMax + ' tegelijk');
});

test('9. de mens kiest nooit een wereld, app of route', () => {
  /* architectuurKeuzes = 0, over het hele corpus. Dit is een UX-belofte en
     geen gemiddelde: een enkel geval dat het wel vraagt, breekt hem.
     MUTATIE: zet architectuurKeuzesMax op 1 bij een geval. */
  for (const g of G)
    assert.equal(g.architectuurKeuzesMax, 0, g.id + ' laat de mens een architectuurkeuze maken');
});

test('10. het rail-script drijft niet af van het corpus', () => {
  /* Een gescript zin die niet in het contract staat, is een rail die iets
     verstaat waarover niemand een verwachting heeft vastgelegd -- precies de
     stilte waar dit corpus tegen is gebouwd.
     MUTATIE: zet een zin in rail-corpus-zinnen.js die niet in menstaal.json
     staat. */
  const inCorpus = new Set(G.map(g => normaliseer(g.input)));
  for (const zin of Object.keys(ZINNEN))
    assert.ok(inCorpus.has(normaliseer(zin)),
      'de rail verstaat "' + zin + '", maar dat geval staat niet in menstaal.json');
});

test('11. wat het corpus NU noemt, verstaat de rail ook echt', () => {
  /* De dekkingsmaat, en met opzet een RATEL en geen eis van 100%: een geval in
     het contract zetten is goedkoop, het scripten kost werk. Wat niet mag, is
     dat de dekking ZAKT.
     MUTATIE: haal een gescripte zin uit rail-corpus-zinnen.js. */
  const rail = maakCorpusRail({});
  const gedekt = NU.filter(g => rail.kentZin(g.input));
  const ondergrens = 21;
  assert.ok(gedekt.length >= ondergrens,
    'de rail dekt ' + gedekt.length + ' van de ' + NU.length + ' NU-gevallen; de ratel staat op ' +
    ondergrens + '. Verlaag hem niet stilletijd -- script het geval, of zet het op FASE4 met de reden.');
});

test('12. elk geval dat op NU staat, is ook echt te draaien', () => {
  /* HIER STOND EEN ONDERGRENS, en die was verkeerd om. De regel luidde "er
     moeten minstens tien gevallen op FASE4 blijven staan", en daarmee strafte
     hij precies wat vooruitgang is: een vooruitlopende belofte alsnog scripten
     en meten. Toen er drie geldgevallen en een bevestigingsgeval bijkwamen,
     zakte hij -- terwijl er niets slechter was geworden.

     Wat hij PROBEERDE te beschermen is echt: het contract mag niet groeien met
     gevallen die niemand kan draaien, want dan ziet de dekking er beter uit
     door iets toe te voegen dat niets doet. Dat is nu rechtstreeks getoetst in
     plaats van via een telling: een geval op NU moet door de rail HERKEND
     worden. Wordt het dat niet, dan geeft hij NIET_HERKEND, komt de zin tot
     `geen`, en meldt de proef doodleuk "binnen het contract" -- een groene rij
     die niets heeft gemeten.
     MUTATIE: zet een FASE4-geval op NU zonder er een corpusregel bij te
     schrijven. */
  const RAIL = require('../server/kern/stuur/rail-corpus').maakCorpusRail({});
  const menscontext = require('../server/kern/stuur/menscontext');
  const { handtekening } = require('../server/kern/stuur/menscontext-uit');
  for (const g of G.filter(x => x.beproefbaar === 'NU')) {
    const r = g.contextGeval ? menscontext.saneer(g.contextGeval) : null;
    const h = r ? handtekening(r) : '';
    const zin = h ? g.input + '\n\nActieve context: ' + h : g.input;
    assert.ok(RAIL.kentZin(zin),
      g.id + ' staat op NU maar de rail kent hem niet; hij geeft NIET_HERKEND en de proef telt ' +
      'hem als "binnen het contract" zonder iets te hebben gemeten:\n    ' + zin.replace(/\n+/g, ' | '));
  }

  /* En een geval dat WEL op FASE4 staat, hoort een reden te hebben om te
     wachten: een contextconditie, of een `let op` dat zegt waar het op wacht. */
  for (const g of G.filter(x => x.beproefbaar === 'FASE4'))
    assert.ok(g.context !== 'geen' || g['let op'],
      g.id + ' wacht op FASE4 zonder contextconditie en zonder uitgeschreven reden');
});

/* ---------------------------------------------------------------------------
   DE AFDWINGING VAN HET CONTRACT (scripts/menstaalproef.js).

   Het contract zegt per zin hoe ver hij mag komen; de proef leest uit het
   stuurspoor hoe ver hij KWAM. Wat hieronder staat is niet de proef zelf --
   die draait tegen een echte server en is zijn eigen bewijs -- maar de ene
   BESLISSING erin die je fout kunt hebben zonder dat iets rood wordt. */

test('13. een voorstel is `klaarzetten` en geen `tonen`', () => {
  /* DE SCHERPSTE REGEL VAN DE PROEF. Een 428 betekent dat de server een
     VOORSTEL teruggaf: er is niets uitgevoerd, maar er staat wel iets klaar.
     Wie die twee samenvoegt, laat een voorstel eruitzien als kijken -- en dan
     komt een zin die iets klaarzet ongemerkt door een contract dat `tonen`
     zegt.
     MUTATIE: haal de EXECUTED/NOT_RUN-tak uit bereikteTrede(); dan valt een
     voorstel terug op `geen` en meldt de proef 0 te ver op een zin die wel
     degelijk iets klaarzette. */
  const { bereikteTrede } = require('../scripts/menstaalproef');
  /* HET GEVAL MOET DE TAK ISOLEREN, anders bewijst hij niets. Op
     /api/agenda/toevoegen (niveau `voorstel`) geeft het PAD al `klaarzetten`,
     dus daar zijn twee mechanismen het eens en kun je niet zien welke werkte --
     de eerste versie van deze toets deed dat, en de mutatie overleefde het.
     Het scherpe geval is een LEESpad dat tóch een voorstel teruggaf: dan zegt
     het beleidsniveau `tonen` en is het de 428 die de waarheid draagt. */
  const voorstel = bereikteTrede({ perFase: {}, merken: [
    { fase: 'CAPABILITY_SELECTED', stand: 'PASS', detail: { pad: '/api/agenda/mijn' } },
    { fase: 'EXECUTED', stand: 'NOT_RUN', detail: { status: 428, voorstel: true } }] });
  assert.equal(voorstel.trede, 'klaarzetten',
    'een 428-voorstel telt niet als kijken, ook niet op een leespad');
  /* DE OUDE VORM TELT OOK. Het merk zet `voorstel: true` pas sinds 12 september
     2026; sporen van daarvoor dragen alleen de status. Die mogen niet ineens
     als weigering lezen, want dan verschuift de betekenis van elk bewaard
     register met terugwerkende kracht.
     MUTATIE: laat bereikteTrede alleen op `detail.voorstel` kijken. */
  assert.equal(bereikteTrede({ perFase: {}, merken: [
    { fase: 'CAPABILITY_SELECTED', stand: 'PASS', detail: { pad: '/api/agenda/mijn' } },
    { fase: 'EXECUTED', stand: 'NOT_RUN', detail: { status: 428 } }] }).trede, 'klaarzetten',
    'een spoor van voor het vlaggetje leest nu als een weigering');

  /* EN EEN WEIGERING IS GEEN VOORSTEL. Allebei NOT_RUN, en alleen de eerste
     zet iets klaar; de tweede mag de trede niet verhogen.
     MUTATIE: laat een weigering ook `klaarzetten` opleveren. */
  const geweigerd = bereikteTrede({ perFase: {}, merken: [
    { fase: 'CAPABILITY_SELECTED', stand: 'PASS', detail: { pad: '/api/agenda/mijn' } },
    { fase: 'EXECUTED', stand: 'NOT_RUN', detail: { status: 403, geweigerd: true } }] });
  assert.equal(geweigerd.trede, 'tonen',
    'een geweigerde aanroep zette niets klaar; hij hoort de trede niet te verhogen');
  assert.ok(geweigerd.uit.some((u) => /geweigerd/.test(u)),
    'het spoor zegt niet dat de aanroep is geweigerd: ' + geweigerd.uit.join('; '));

  /* En op een schrijfpad komt hij er hoe dan ook: dan dragen het niveau en de
     428 hetzelfde antwoord. */
  assert.equal(bereikteTrede({ perFase: {}, merken: [
    { fase: 'CAPABILITY_SELECTED', stand: 'PASS', detail: { pad: '/api/agenda/toevoegen' } },
    { fase: 'EXECUTED', stand: 'NOT_RUN', detail: { status: 428 } }] }).trede, 'klaarzetten');

  /* Een leespad blijft `tonen`. */
  const lezen = bereikteTrede({ perFase: {}, merken: [
    { fase: 'CAPABILITY_SELECTED', stand: 'PASS', detail: { pad: '/api/agenda/mijn' } },
    { fase: 'EXECUTED', stand: 'PASS', detail: { status: 200 } }] });
  assert.equal(lezen.trede, 'tonen');

  /* Niets geselecteerd is `geen`. */
  assert.equal(bereikteTrede({ perFase: {}, merken: [] }).trede, 'geen');

  /* EN GEEN SPOOR IS GEEN `geen`. Dat is het verschil tussen "ik kon niet
     kijken" en "er gebeurde niets"; de antwoordrail heeft eigen handelingen
     die niet langs het stuur lopen, en die als `geen` tellen zou van deze
     proef een geruststelling maken.
     MUTATIE: laat bereikteTrede() zonder spoor `geen` teruggeven. */
  assert.equal(bereikteTrede(null).trede, null, 'geen spoor mag nooit als `geen` lezen');
  assert.equal(bereikteTrede({}).trede, null);
});
