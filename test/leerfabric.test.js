/* De Learning Fabric: de structuur waar elk vak op draait.

   Een leerdoel is hier niet langer een naam met een zin uitleg, maar een knoop
   in een graaf: hij weet wat eronder ligt (vereist), hij kan zichzelf op meer
   dan een manier uitleggen (uitleg), en hij zegt wanneer hij behaald is
   (meting). Deze toets bewaakt de vier dingen die daarbij stuk kunnen zonder
   dat iemand het merkt:

   1. EEN ID VERANDERT NOOIT. Het leerpaspoort van een kind verwijst ernaar,
      decennia later nog. De lijst hieronder is de stand van 19 augustus 2026:
      erbij mag altijd, eraf of hernoemen betekent dat je iemands geschiedenis
      weggooit. Wie een id echt moet vervangen, hoort dat met een migratie te
      doen en niet met een zoek-vervang.
   2. VOORKENNIS LIGT ERVOOR. Een voorwaarde die verderop in de leerlijn staat,
      is geen voorwaarde maar een kringetje in de maak.
   3. GEEN KRINGETJES. A vereist B vereist A laat elk pad oneindig lopen.
   4. DE KEURING DRAAIT BIJ HET OPSTARTEN. Niet in een toets ernaast: een
      leerlijn met een gat is kapot, en kapot hoort luid te zijn.

   Draai los: node --test test/leerfabric.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { DOELEN, UITLEG_SOORTEN, STANDAARD_METING, keurLeerstof, pad } = require('../server/kern/leerstof');
const fabric = require('../server/kern/leerstof-fabric');

/* De ids zoals ze bestonden toen de Fabric erin ging. Deze lijst hoort te
   groeien en nooit te krimpen. */
const BESTAANDE_IDS = [
  "aardrijkskunde.g5.provincies", "aardrijkskunde.g6.kaartlezen", "aardrijkskunde.g7.europa",
  "aardrijkskunde.g8.wereld", "aardrijkskunde.vo.klimaat", "academisch.wo.schrijven",
  "biologie.vo.cellen", "biologie.vo.lichaam", "burgerschap.mbo.kennis",
  "communicatie.hbo.zakelijk", "digitaal.mbo.vaardig", "duits.vo.woordenschat",
  "economie.vo.btw", "engels.g7.woorden", "engels.g8.zinnen",
  "engels.vo.woordenschat", "frans.havo.woordenschat", "geschiedenis.g5.vroeger",
  "geschiedenis.g6.gouden-eeuw", "geschiedenis.g7.wereldoorlogen", "geschiedenis.g8.democratie",
  "geschiedenis.vo.tijdvakken", "informatica.havo.begrippen", "maatschappijleer.vo.rechtsstaat",
  "natuur.g4.dieren", "natuur.g5.planten", "natuur.g6.lichaam",
  "natuur.g7.energie", "natuur.g8.heelal", "natuurkunde.havo.eenheden",
  "natuurkunde.havo.formules", "nederlands.mbo.zakelijk", "nederlands.vo.dt",
  "nederlands.vo.signaalwoorden", "nederlands.vwo.stijlfiguren", "onderzoek.hbo.bronnen",
  "rekenen.g1.meer-minder", "rekenen.g1.tellen-tot-10", "rekenen.g1.vormen",
  "rekenen.g2.erbij-eraf-5", "rekenen.g2.getalrij", "rekenen.g2.tellen-tot-20",
  "rekenen.g3.aftrekken-tot-20", "rekenen.g3.getallen-tot-100", "rekenen.g3.optellen-tot-20",
  "rekenen.g3.splitsen", "rekenen.g4.geld", "rekenen.g4.klok-heel-half",
  "rekenen.g4.optellen-tot-100", "rekenen.g4.tafels-1-5-10", "rekenen.g5.delen",
  "rekenen.g5.getallen-tot-1000", "rekenen.g5.klok-minuten", "rekenen.g5.tafels-tot-10",
  "rekenen.g6.breuken-benoemen", "rekenen.g6.grote-getallen", "rekenen.g6.kommagetallen",
  "rekenen.g6.omtrek-opp", "rekenen.g7.breuken-rekenen", "rekenen.g7.gemiddelde",
  "rekenen.g7.procenten", "rekenen.g7.verhoudingen", "rekenen.g8.grote-bewerkingen",
  "rekenen.g8.meten-metriek", "rekenen.g8.procenten-komma-breuk", "rekenen.g8.verhoudingen-procent",
  "rekenen.mbo.beroep", "rekenen.mbo.geld", "scheikunde.havo.symbolen",
  "statistiek.hbo.gemiddelde", "statistiek.wo.begrippen", "taal.g1.letters-horen",
  "taal.g1.rijmen", "taal.g2.eerste-woorden", "taal.g2.hakken-plakken",
  "taal.g3.mkm-woorden", "taal.g3.tweeklanken", "taal.g4.aai-ooi-oei",
  "taal.g4.sch-ng-nk", "taal.g5.eind-d-t", "taal.g5.open-gesloten",
  "taal.g6.cht-ch", "taal.g6.verkleinwoorden", "taal.g7.leestekens",
  "taal.g7.ww-tt", "taal.g8.samenstellingen", "taal.g8.voltooid-dw",
  "taal.g8.ww-vt", "verkeer.g4.oversteken", "verkeer.g5.fietsen",
  "verkeer.g6.borden", "wetenschap.wo.methode", "wiskunde.havo.lineair",
  "wiskunde.havo.statistiek", "wiskunde.vo.kommagetallen", "wiskunde.vo.opp-omtrek",
  "wiskunde.vo.procenten", "wiskunde.vo.verhoudingen", "wiskunde.vwo.vergelijkingen",];

test('elk bestaand leerdoel-id bestaat nog: een paspoort verwijst ernaar', () => {
  const nu = new Set(Object.keys(DOELEN));
  const weg = BESTAANDE_IDS.filter(id => !nu.has(id));
  assert.deepEqual(weg, [], 'deze leerdoelen zijn hernoemd of verdwenen; elk paspoort dat ze droeg is nu stuk');
  assert.ok(nu.size >= BESTAANDE_IDS.length, 'de leerlijn hoort te groeien, niet te krimpen');
});

test('de keuring gooit op een vereiste die niet bestaat', () => {
  assert.throws(() => keurLeerstof({
    'a.1': { id: 'a.1', naam: 'A', groep: 1, vereist: ['bestaat.niet'] }
  }), /bestaat niet/);
});

test('de keuring gooit als voorkennis verderop in de leerlijn staat', () => {
  assert.throws(() => keurLeerstof({
    'a.1': { id: 'a.1', naam: 'A', groep: 3, vereist: ['a.2'] },
    'a.2': { id: 'a.2', naam: 'B', groep: 6 }
  }), /verderop in de leerlijn/);
});

test('de keuring gooit op een kringetje in de voorkennis', () => {
  assert.throws(() => keurLeerstof({
    'a.1': { id: 'a.1', naam: 'A', groep: 4, vereist: ['a.2'] },
    'a.2': { id: 'a.2', naam: 'B', groep: 4, vereist: ['a.1'] }
  }), /kringetje/);
});

test('de keuring gooit op een onbekende uitlegsoort en op een lege uitleg', () => {
  assert.throws(() => keurLeerstof({
    'a.1': { id: 'a.1', naam: 'A', groep: 1, uitleg: [{ soort: 'grappig', tekst: 'x' }] }
  }), /onbekende uitlegsoort/);
  assert.throws(() => keurLeerstof({
    'a.1': { id: 'a.1', naam: 'A', groep: 1, uitleg: [{ soort: 'stap', tekst: '   ' }] }
  }), /lege uitleg/);
});

test('de keuring gooit op een meting die niet kan', () => {
  assert.throws(() => keurLeerstof({
    'a.1': { id: 'a.1', naam: 'A', groep: 1, meting: { opgaven: 3, drempel: 5 } }
  }), /onmogelijke meting/);
  // en de gewone vorm mag gewoon
  assert.ok(keurLeerstof({ 'a.1': { id: 'a.1', naam: 'A', groep: 1, meting: { opgaven: 5, drempel: 4 } } }));
});

test('het pad zet voorkennis voor het doel zelf, en elk doel een keer', () => {
  const metVereist = Object.values(DOELEN).find(d => (d.vereist || []).length);
  assert.ok(metVereist, 'er hoort minstens een leerdoel met voorkennis te zijn');
  const rij = pad(metVereist.id, {});
  assert.equal(rij[rij.length - 1].id, metVereist.id, 'het doel zelf staat achteraan');
  assert.equal(new Set(rij.map(x => x.id)).size, rij.length, 'geen enkel doel staat er twee keer in');
  for (const v of metVereist.vereist)
    assert.ok(rij.findIndex(x => x.id === v) < rij.length - 1, 'voorkennis staat voor het doel');
});

test('de standaardmeting geldt waar een doel er zelf geen heeft', () => {
  assert.deepEqual(STANDAARD_METING, { opgaven: 5, drempel: 4 });
  assert.ok(UITLEG_SOORTEN.includes('eenvoudig') && UITLEG_SOORTEN.includes('visueel'));
});

/* De generatoren zelf. Deze toets komt uit een echte fout: de eerste versie
   van "delen met rest" zette het antwoord als voorbeeld in de vraag
   ("schrijf als 1 rest 1"), en dan heeft iedereen alles goed zonder dat
   iemand het merkt. Een oefening waarin het antwoord al staat, is geen
   oefening maar een leesopdracht. */
const { opgave, SOORTEN, MEERKEUZE } = require('../server/kern/leerstof-gen');

test('geen vaste tekst in een vraag is ooit het antwoord', () => {
  /* De scherpe versie van "verklap je antwoord niet". Dat een antwoord soms
     samenvalt met een getal uit de som is geen lek maar rekenen: bij "1 x 7 ="
     staat de 7 er nu eenmaal. Het echte lek is een VASTE tekst in de vraag die
     het antwoord kan zijn -- zoals het voorbeeld dat "delen met rest" ooit
     meegaf ("schrijf als 3 rest 2"), dat bij 17 : 5 letterlijk de oplossing
     was. Vandaar de meting: staat het antwoord in de vraag EN staat diezelfde
     tekst in vrijwel elke andere vraag van dit leerdoel, dan hoort hij bij het
     sjabloon en niet bij de som. */
  const TREKKINGEN = 150;
  const lek = [];
  /* Op woordgrens en niet op substring: in "je betaalt met 20 euro" zit de
     tekst "2", en dat is geen antwoord dat verklapt wordt maar een toevallig
     stukje van een ander getal. */
  const staatIn = (vraag, a) => new RegExp('(^|[^0-9A-Za-z,])' +
    a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9A-Za-z,]|$)').test(vraag);
  for (const d of Object.values(DOELEN)) {
    // meerkeuzevragen noemen hun opties met opzet; werkwoordspelling toont het
    // hele werkwoord waar de stam in zit (zie de toets hieronder)
    if (MEERKEUZE.includes(d.gen.soort) || d.gen.soort === 'dt') continue;
    const vragen = [], antwoorden = [];
    for (let i = 0; i < TREKKINGEN; i++) {
      const o = opgave(d.gen);
      vragen.push(String(o.v));
      antwoorden.push(String(o.a).trim());
    }
    for (let i = 0; i < TREKKINGEN; i++) {
      const a = antwoorden[i];
      if (!a || !staatIn(vragen[i], a)) continue;
      const vast = vragen.filter(v => staatIn(v, a)).length / TREKKINGEN;
      if (vast >= 0.9) { lek.push(d.id + ': "' + a + '" staat in ' + Math.round(vast * 100) + '% van de vragen'); break; }
    }
  }
  assert.deepEqual(lek, [], 'deze leerdoelen dragen hun antwoord in de vaste vraagtekst');
});

test('een opgave die al af is, is geen opgave', () => {
  /* Afronden gaf ooit getallen die al rond waren ("rond 3300 af op
     honderdtallen"). Dat is geen makkelijke som maar helemaal geen som, en
     het antwoord staat er dan bovendien bij. Zelfde soort fout, andere vorm
     dan hierboven -- vandaar een eigen toets. */
  for (let i = 0; i < 500; i++) {
    const o = opgave({ soort: 'afronden', stappen: [10, 100, 1000] });
    const getal = o.v.match(/\d+/);
    assert.ok(getal, 'de afrondvraag noemt een getal');
    assert.notEqual(getal[0], String(o.a), 'dit getal was al afgerond: ' + o.v);
  }
});

test('elke generatorsoort maakt een opgave met een vraag en een antwoord', () => {
  const gebruikt = new Set(Object.values(DOELEN).map(d => d.gen.soort));
  for (const soort of gebruikt) assert.ok(SOORTEN.includes(soort), 'onbekende soort in de leerlijn: ' + soort);
  for (const d of Object.values(DOELEN)) {
    const o = opgave(d.gen);
    assert.ok(String(o.v || '').trim(), d.id + ' maakt een lege vraag');
    assert.ok(String(o.a || '').trim(), d.id + ' maakt een leeg antwoord');
    // wie opties teruggeeft, staat op de meerkeuzelijst -- en andersom
    if (o.opties) assert.ok(MEERKEUZE.includes(d.gen.soort), d.gen.soort + ' geeft opties maar staat niet op de meerkeuzelijst');
  }
});

test('taal draait op regels en niet op vijf vaste woordparen', () => {
  const taal = Object.values(DOELEN).filter(d => d.vak === 'taal' && d.groep != null);
  assert.ok(taal.length >= 28, 'de leerlijn taal po telt ' + taal.length + ' doelen');
  for (let g = 1; g <= 8; g++)
    assert.ok(taal.filter(d => d.groep === g).length >= 3, 'groep ' + g + ' heeft te weinig taaldoelen');
  assert.deepEqual(taal.filter(d => !(d.uitleg || []).length).map(d => d.id), [], 'elk taaldoel hoort meer dan een uitleg te hebben');

  /* De spellingdoelen draaien op een woordbank plus een regel; de motor maakt
     de foute variant zelf. Een bank van vijf woorden is geen bank maar een
     rijtje, en dat is precies wat deze leerlijn eerst was. */
  for (const d of taal.filter(x => x.gen.soort === 'spel'))
    assert.ok(d.gen.woorden.length >= 10, d.id + ' heeft een woordbank van ' + d.gen.woorden.length + ' woorden');
});

test('de hele bibliotheek draait op regels en tabellen, van groep 1 tot het wo', () => {
  /* De omslag waar het bij het vullen om ging: geen enkel leerdoel put nog uit
     een handgeschreven vragenlijst, en elk doel kan zichzelf op meer dan een
     manier uitleggen. Zakt deze toets, dan is er een leerdoel bijgekomen dat
     terugvalt op de oude vorm -- en die is na twee sessies een geheugenspel. */
  const alle = Object.values(DOELEN);
  assert.deepEqual(alle.filter(d => d.gen.soort === 'mc').map(d => d.id), [],
    'deze leerdoelen putten nog uit een vaste vragenlijst');
  assert.deepEqual(alle.filter(d => !(d.uitleg || []).length).map(d => d.id), [],
    'deze leerdoelen leggen zichzelf maar op een manier uit');

  // en elke fase van de ladder draagt zijn doelen maar EEN keer
  const { PER_FASE } = require('../server/kern/leerstof');
  for (const fase of Object.keys(PER_FASE))
    assert.equal(new Set(PER_FASE[fase]).size, PER_FASE[fase].length,
      'fase ' + fase + ' heeft dubbele leerdoelen');
});

test('het hele basisonderwijs draait op de Fabric, en elk vak is oefenbaar', () => {
  /* De belofte uit SCHOOL.md paragraaf 7: elke leerling kan elke schooldag elk
     actief vak oefenen. Voor het po is dat meetbaar: elk vak heeft leerdoelen,
     elk leerdoel heeft een generator, en elk leerdoel legt zichzelf op meer
     dan een manier uit. */
  const po = Object.values(DOELEN).filter(d => d.groep != null);
  const perVak = {};
  for (const d of po) perVak[d.vak] = (perVak[d.vak] || 0) + 1;
  for (const vak of ['rekenen', 'taal', 'aardrijkskunde', 'geschiedenis', 'natuur', 'verkeer', 'engels'])
    assert.ok(perVak[vak] >= 4, 'vak ' + vak + ' heeft maar ' + (perVak[vak] || 0) + ' leerdoelen in het po');
  assert.deepEqual(po.filter(d => !(d.uitleg || []).length).map(d => d.id), [],
    'elk po-leerdoel hoort zichzelf op meer dan een manier uit te leggen');
  assert.ok(po.length >= 100, 'het po telt ' + po.length + ' leerdoelen');

  /* En geen enkel vak hangt nog aan een handgeschreven vragenlijstje: 'mc' met
     vijf vragen was precies de vorm die na twee sessies een geheugenspel is. */
  const vast = po.filter(d => d.gen.soort === 'mc');
  assert.deepEqual(vast.map(d => d.id), [], 'deze po-leerdoelen putten nog uit een vaste vragenlijst');
});

test('rekenen is de proef op de som: een leerlijn met voorkennis en meer dan een uitleg', () => {
  const rek = Object.values(DOELEN).filter(d => d.vak === 'rekenen' && d.groep != null);
  assert.ok(rek.length >= 45, 'de leerlijn rekenen po telt ' + rek.length + ' doelen');
  for (let g = 1; g <= 8; g++)
    assert.ok(rek.filter(d => d.groep === g).length >= 4, 'groep ' + g + ' heeft te weinig leerdoelen');
  const zonderVoorkennis = rek.filter(d => !(d.vereist || []).length);
  assert.ok(zonderVoorkennis.length <= 4, 'alleen de allereerste doelen horen zonder voorkennis te staan');
  const zonderUitleg = rek.filter(d => !(d.uitleg || []).length);
  assert.deepEqual(zonderUitleg.map(d => d.id), [], 'elk rekendoel hoort meer dan een uitleg te hebben');
  // en de graaf loopt door tot in het vervolgonderwijs
  const beroep = pad('rekenen.mbo.beroep', {});
  assert.ok(beroep.length >= 15, 'de weg naar beroepsrekenen loopt terug tot de basisschool');
  assert.ok(beroep.some(x => x.groep === 1), 'en begint bij groep 1');
});
