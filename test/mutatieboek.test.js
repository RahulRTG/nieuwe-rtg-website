/* ============================================================================
   HET MUTATIEBOEK SLUIT.

   WAT HIER BEWAAKT WORDT, EN WAAROM HET GEEN GETAL IS. Over de schrijfroutes van
   dit huis lopen vier tellers die alle vier "routes" heten en alle vier iets
   anders tellen. Zolang de verschillen niet zijn uitgelegd, is elk percentage
   erover onbruikbaar -- en erger: een route kan uit alle vier de tellingen
   vallen en dan nergens rood maken. Dat leest als groen.

   scripts/mutatieboek.js laat elke route van de router in precies EEN bak
   vallen, met de reden waarom hij niet verder komt in de keten. Deze toets
   bewaakt de IDENTITEIT: de optelling van de bakken is gelijk aan het totaal.

   Waarom een identiteit en geen drempel: getallen bewegen mee met elke route die
   erbij komt, en een toets op een getal dwingt dan een nieuwe vastlegging af bij
   elke commit. Een identiteit is stil zolang de boekhouding klopt en luid zodra
   iemand een filter toevoegt dat routes laat verdwijnen. Dat tweede is precies
   het gevaar.

   DE MUTATIES VOOR DIT BESTAND, elk een keer gedraaid en zien zakken:
     1. laat in mutatieboek.js een bak weg uit de optelling (zet ('leest', ...)
        niet in `bakken`) -> "de boekhouding sluit" zakt;
     2. filter in de padparameter-stap zonder de eruit gevallen routes in een bak
        te zetten -> dezelfde toets zakt;
     3. geef in verzoen() een vastgelegd getal terug zonder duiding
        -> "elke afwijking draagt een duiding" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { meet } = require('../scripts/mutatieboek');
const { alleRoutes } = require('../scripts/lib/routes');

const boek = meet();

test('de boekhouding sluit: elke route valt in precies een bak', () => {
  const som = boek.bakken.reduce((n, b) => n + b.aantal, 0);
  assert.equal(som, boek.gemeten.routesTotaal,
    'de optelling van de bakken (' + som + ') wijkt af van het totaal (' + boek.gemeten.routesTotaal + '); ' +
    'er vallen routes buiten de boekhouding');
  assert.equal(boek.gemeten.sluit, true);
  assert.equal(boek.gemeten.somVanDeBakken, boek.gemeten.routesTotaal);
});

test('het totaal is dat van de gedeelde routelijst, en niet een eigen telling', () => {
  /* Een boek dat zijn eigen routes zoekt, is de vijfde teller in plaats van de
     verzoening van de vier die er al zijn. */
  assert.equal(boek.gemeten.routesTotaal, alleRoutes().length);
});

test('elke bak draagt een uitgeschreven reden', () => {
  for (const b of boek.bakken) {
    assert.ok(b.uitleg && b.uitleg.length > 40, b.id + ' mist een uitleg');
    assert.ok(Array.isArray(b.voorbeelden), b.id + ' mist voorbeelden');
  }
});

test('de mutaties zijn de som van de bakken die erna komen', () => {
  /* De keten moet als keten kloppen en niet alleen als optelling: alles wat na
     "leest" en "geen-api" overblijft, is het mutatieboek. */
  const na = ['schakelpad', 'padparameter', 'geen-rol-met-token',
    'beproefbaar-verklaard', 'beproefbaar-onverklaard'];
  const som = boek.bakken.filter(b => na.includes(b.id)).reduce((n, b) => n + b.aantal, 0);
  assert.equal(som, boek.gemeten.mutaties,
    'de mutatiebakken tellen op tot ' + som + ' en het mutatieboek zegt ' + boek.gemeten.mutaties);
});

test('geclassificeerd is iets anders dan beproefbaar, en het boek houdt dat uit elkaar', () => {
  /* DE KERN VAN DE OPZET. Een route met een :parameter kan prima een besluit
     over duplicaatgedrag dragen; hij is alleen niet met twee kale HTTP-oproepen
     te beproeven. Wie die twee door elkaar haalt, gaat de architectuur vervormen
     om een percentage mooi te maken. */
  assert.ok(boek.gemeten.mutatiesVerklaard >= boek.gemeten.beproefbaarVerklaard,
    'er kunnen niet meer beproefbare verklaringen zijn dan verklaringen');
  assert.equal(boek.gemeten.mutatiesVerklaard + boek.gemeten.mutatiesOnverklaard, boek.gemeten.mutaties);
});

test('elke afwijking met een vastgelegde teller draagt een duiding', () => {
  /* Een verschil zonder duiding leest als een fout, terwijl het meestal
     veroudering is -- en dat zijn tegengestelde conclusies. */
  for (const r of boek.verzoening) {
    assert.ok(r.zelfdeVraag && r.zelfdeVraag.length > 10, r.bron + ' zegt niet welke vraag hij stelt');
    if (!r.gelijk) assert.ok(r.duiding && r.duiding.length > 20,
      r.bron + ' ' + r.veld + ' wijkt af zonder duiding');
  }
});

test('elke mutatie draagt precies een formele status', () => {
  const som = boek.statussen.reduce((n, st) => n + st.aantal, 0);
  assert.equal(som, boek.gemeten.mutaties,
    'de statussen tellen op tot ' + som + ' en er zijn ' + boek.gemeten.mutaties + ' mutaties');
  assert.equal(boek.gemeten.statusSluit, true);
  for (const st of boek.statussen) assert.ok(st.uitleg && st.uitleg.length > 30, st.id + ' mist een uitleg');
});

test('precies een status hoort naar nul, en dat is de onverklaarde', () => {
  const naarNul = boek.statussen.filter(st => st.moetNaarNul).map(st => st.id);
  assert.deepEqual(naarNul, ['NOG_NIET_GECLASSIFICEERD'],
    'bewust niet-idempotent is KLAAR en geen tekort; wie die ook naar nul wil, vervormt de architectuur');
});

test('een status over beproefbaarheid is geen besluit over duplicaatgedrag', () => {
  /* DE TOETS TEGEN SCHIJNZEKERHEID. "4661 mutaties, 4661 met een status" mag
     nooit gelezen worden als "4661 verklaard": van bijna duizend daarvan is
     alleen bekend dat de proef er niet bij kan, en dat is een uitspraak over
     het instrument en niet over de route. */
  /* DEZE TOETS IS BIJGESTELD TOEN DE METING ERBIJ KWAM, en het is belangrijk
     waarom hij eerst zakte in plaats van meeschoof.

     Hij legde vast: de semantische statussen ZIJN de verklaringen. Dat was waar
     zolang een status maar een grond kon hebben. Sinds IDEMPROEF.json als tweede
     grond meetelt, dragen ook gemeten routes een semantische status -- en toen
     zakte deze toets met 1200 !== 184. Dat was precies goed: hij ving de
     samenvouwing waar de nieuwe code op mikte.

     De identiteit die overblijft is strenger dan de oude, want hij noemt de
     grond: het BESLUITgetal is exact het aantal verklaringen, en de gemeten
     routes staan ernaast in een eigen getal. */
  const metSemantiek = boek.statussen.filter(st => st.semantiek).reduce((n, st) => n + st.aantal, 0);
  assert.equal(boek.gemeten.metBesluitOverDuplicaat, boek.gemeten.mutatiesVerklaard,
    'het besluitgetal hoort exact de verklaringen uit idemsleutels.js te zijn');
  assert.equal(metSemantiek,
    boek.gemeten.metBesluitOverDuplicaat + boek.gemeten.metGemetenDuplicaatgedrag,
    'een semantische status komt uit een besluit OF uit een waarneming, en die twee horen op te tellen tot het geheel');
  assert.equal(boek.gemeten.zonderBesluitOverDuplicaat,
    boek.gemeten.mutaties - boek.gemeten.mutatiesVerklaard);
  assert.ok(boek.gemeten.zonderBesluitOverDuplicaat > boek.gemeten.nogNietGeclassificeerd,
    'er horen mutaties te zijn die wel een status maar geen besluit dragen; anders vervaagt het onderscheid');
});

test('de statustelling klopt met IDEMSCHULD.json, of zegt waarom niet', () => {
  /* Twee registers over hetzelfde huis. Ze horen hetzelfde getal te geven; doen
     ze dat niet, dan draagt de verzoening de duiding. */
  const rij = boek.verzoening.find(r => r.bron === 'IDEMSCHULD.json');
  assert.ok(rij, 'IDEMSCHULD.json hoort in de verzoening te staan');
  if (!rij.gelijk) assert.ok(rij.duiding.length > 20, 'een afwijking zonder duiding');
});

test('de redenen zonder proefsleutel komen uit de gedeelde bewakerskaart', () => {
  /* Niet uit een tweede berekening in dit boek: de eerste versie deed dat wel en
     gaf voor alle duizend dezelfde generieke zin, terwijl er drie verschillende
     reparaties achter zitten. */
  const redenen = boek.zonderRolPerReden;
  assert.ok(redenen.length >= 3,
    'er horen meerdere soorten redenen te zijn, gevonden: ' + redenen.length);
  const totaal = redenen.reduce((n, r) => n + r.aantal, 0);
  const bak = boek.bakken.find(b => b.id === 'geen-rol-met-token');
  assert.equal(totaal, bak.aantal, 'de redenen tellen niet op tot de bak');
});

/* ============================================================================
   EEN GEMETEN STATUS IS GEEN BESLUIT.

   WAT ER MIS GING, en het ging mis in dezelfde wijziging die de regel
   opschreef. Toen de meting als tweede grond onder een formele status kwam,
   telde `metBesluitOverDuplicaat` nog steeds de STATUS en niet de GROND. Zolang
   een status alleen uit een verklaring kon komen was dat hetzelfde getal; daarna
   niet meer. Het boek meldde in een klap "1200 van de 4661 dragen een besluit
   over duplicaatgedrag" terwijl er over 1012 daarvan alleen was WAARGENOMEN dat
   de server een herhaling merkte.

   Dat is exact de samenvouwing die de kop van scripts/lib/idemmeting.js
   verbiedt. Hij glipte erlangs omdat de regel wel in de tekst stond en de
   telling niet meebewoog -- LAT.md regel 10: een meter die je niet hebt zien
   zakken is geen meter.

   DE MUTATIE: laat semantiekVan('verklaard') weer over alle graden tellen ->
   deze toets zakt.
   ========================================================================== */
test('metBesluitOverDuplicaat telt alleen VERKLAARDE routes, nooit gemeten', () => {
  const u = boek;
  const g = u.gemeten;
  const verklaard = u.bewijsgraad.perGraad.find(x => x.id === 'verklaard');
  assert.ok(verklaard, 'de bewijsgraad hoort een verklaarde bak te hebben');
  assert.ok(g.metBesluitOverDuplicaat <= verklaard.aantal,
    'er kunnen nooit meer besluiten zijn dan verklaarde routes: ' +
    g.metBesluitOverDuplicaat + ' > ' + verklaard.aantal);
  const gemeten = u.bewijsgraad.perGraad.find(x => x.id === 'gemeten');
  if (gemeten && gemeten.aantal) {
    assert.ok(g.metGemetenDuplicaatgedrag > 0,
      'waargenomen duplicaatgedrag hoort een EIGEN getal te hebben, niet op te gaan in het besluitgetal');
    assert.notEqual(g.metBesluitOverDuplicaat, g.metBesluitOverDuplicaat + g.metGemetenDuplicaatgedrag,
      'besluit en waarneming horen twee getallen te blijven');
  }
});

test('de meting kan de belofte "elke mutatie heeft een bekende semantiek" niet opblazen', () => {
  /* Het getal dat die belofte draagt mag niet stijgen doordat er gemeten is.
     Meten zegt iets over het INSTRUMENT en niets over de semantiek van de route. */
  const u = boek;
  const { SLEUTELS } = require('../server/lib/idemsleutels');
  assert.equal(u.gemeten.metBesluitOverDuplicaat + u.gemeten.zonderBesluitOverDuplicaat,
    u.gemeten.mutaties, 'de twee helften horen samen het aantal mutaties te zijn');
  assert.ok(u.gemeten.metBesluitOverDuplicaat <= Object.keys(SLEUTELS).length,
    'er kunnen nooit meer besluiten zijn dan verklaringen in idemsleutels.js');
});

/* ============================================================================
   DE RESTBAK STAAT OP NUL, EN DAT MAG NIET STIL TERUGGROEIEN.

   NOG_NIET_GECLASSIFICEERD is de enige status die naar nul hoort, en hij staat
   er. Zonder grendel groeit dat getal terug zodra iemand een schrijfroute
   toevoegt: precies zoals IDEMSCHULD.json dat voor de verklaringen bewaakt.

   WAAROM DEZE TOETS EEN VOORWAARDE HEEFT, en waarom dat geen ontsnapping is.
   De classificatie leunt op twee gronden: de verklaring in idemsleutels.js, en
   de METING in IDEMPROEF.json. Die tweede komt door een versheidspoort
   (scripts/lib/idemmeting.js) die fail-closed is: op een vuile boom of een
   oudere commit levert zij niets, en dan springt dit getal terug naar enkele
   duizenden. Dat is geen defect maar het ontwerp -- liever een eerlijk hoog
   getal dan een status op verouderd bewijs.

   Een harde `=== 0` zou daarom rood staan bij elke ongecommitte wijziging, en
   een toets die om de verkeerde reden rood staat leert iedereen hem weg te
   kijken (LAT.md regel 9). De toets eist dus nul ZODRA de poort open staat, en
   zegt anders waarom hij niets kan eisen -- dat is een uitspraak over de
   opstelling en niet over de routes.

   DE MUTATIE: haal een regel uit server/lib/idemsleutels-restbak.js en meet
   opnieuw -> deze toets zakt.
   ========================================================================== */
test('geen enkele mutatie is onverklaard EN ongemeten (als de meting vers is)', () => {
  const g = boek.gemeten;
  if (!boek.bewijsgraad.metingGebruikt) {
    /* Geen stille overslag: de reden hoort in de uitvoer te staan, zodat een
       groene ronde zonder meting te onderscheiden is van een met meting. */
    assert.ok(boek.bewijsgraad.metingReden && boek.bewijsgraad.metingReden.length > 20,
      'een gesloten poort hoort te zeggen waarom, anders is groen niet te lezen');
    return;
  }
  assert.equal(g.nogNietGeclassificeerd, 0,
    'er staan ' + g.nogNietGeclassificeerd + ' mutaties zonder besluit en zonder waarneming; ' +
    'elke nieuwe schrijfroute hoort een verklaring te krijgen in server/lib/idemsleutels*.js');
});

test('elke mutatie draagt precies een status, en de optelling sluit', () => {
  const g = boek.gemeten;
  assert.equal(g.statusSluit, true,
    'de statussen tellen op tot ' + g.statusSom + ' en er zijn ' + g.mutaties + ' mutaties');
});
