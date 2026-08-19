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

test('geen enkele generator zet zijn eigen antwoord in de vraag', () => {
  const lek = [];
  for (const d of Object.values(DOELEN)) {
    /* Meerkeuzevragen noemen hun opties met opzet in de vraag ("meer, minder
       of evenveel?"); daar IS het antwoord een van de genoemde woorden. De
       regel geldt voor de vragen waar je zelf een antwoord moet intikken. */
    if (MEERKEUZE.includes(d.gen.soort)) continue;
    /* Werkwoordspelling is de ene echte uitzondering: bij "ik ___ (vinden)"
       staat de stam per definitie in het hele werkwoord. Dat IS de opgave --
       de stam eruit halen -- en niet een verklapt antwoord. */
    if (d.gen.soort === 'dt') continue;
    for (let i = 0; i < 25; i++) {
      const o = opgave(d.gen);
      const a = String(o.a).trim();
      /* Korte antwoorden (een cijfer, "meer", "1/2") komen vanzelf in een
         vraagtekst voor -- "Tel de stippen" bevat geen getal, maar
         "17 : 5" bevat wel de 5. Daarom alleen alarm bij antwoorden van
         minstens vier tekens die letterlijk in de vraag staan. */
      if (a.length >= 4 && String(o.v).includes(a)) lek.push(d.id + ': ' + o.v + ' -> ' + a);
    }
  }
  assert.deepEqual(lek.slice(0, 3), [], 'deze opgaven verklappen hun eigen antwoord');
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
