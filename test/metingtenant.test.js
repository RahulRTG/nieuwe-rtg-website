/* DE METING DIE EEN TENANT DRAAGT -- en de vier dingen die hem eerlijk houden.

   BESTUUR.md par. 7.5 schreef dit tot vandaag op als ONBEANTWOORDBAAR: zolang
   server/meting.js per routepatroon telt, kan niemand zeggen hoeveel klanten
   een storing merkten. Dat klopte, en het was geen luiheid: een tenant-label
   aan de metrics hangen breekt allebei de harde keuzes van meting.js -- geen
   tijdreeks per klant (dan valt de monitoring om) en geen persoonsgegevens in
   een eindpunt dat gescrapet wordt.

   Het antwoord staat daarom NAAST de metrics en niet erin. En het is een
   ONDERGRENS, geen aantal. Dat verschil is alles: "vijf organisaties" en
   "minstens vijf organisaties, en van een deel weten we het niet" leiden tot
   een ander gesprek met een klant.

   WAT DEZE TOETS BEWIJST:
   1. hij telt organisaties en geen verzoeken, en dezelfde organisatie op twee
      functies is één organisatie;
   2. de codes verlaten de module niet -- er is geen functie die ze teruggeeft;
   3. het niet-toegewezen deel wordt GETELD en niet weggelaten, want dat getal
      zegt hoe ver de ondergrens van het geheel af staat;
   4. hij gaat niet mee naar Prometheus, en "niets gemeten" is geen nul.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - geraaktVan() de aantallen laten OPTELLEN in plaats van de unie te nemen
     -> toets 1 ZAKT (RAAK), en alleen toets 1.
   - `nietToegewezen` niet meer tellen als org null is
     -> toets 3 ZAKT (RAAK), en alleen toets 3.
   - geraakt() bij een onbekende functie `gemeten: true` laten zeggen
     -> toets 4 ZAKT (RAAK), en alleen toets 4.

   Draai los: node --test test/metingtenant.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../server/meting-tenant');

test.beforeEach(() => m.rol());

test('1. het telt organisaties, en dezelfde organisatie telt één keer', () => {
  m.raak('bedrijf', 'O-A', false);
  m.raak('bedrijf', 'O-A', false);   // tweede verzoek van dezelfde klant
  m.raak('bedrijf', 'O-B', true);
  assert.equal(m.geraakt('bedrijf').organisaties, 2, 'verzoeken worden geteld in plaats van organisaties');
  assert.equal(m.geraakt('bedrijf').metFout, 1);

  /* EN OVER FUNCTIES HEEN DE UNIE, niet de som. Optellen zou van een ondergrens
     een bovengrens maken: één klant die twee functies van hetzelfde vermogen
     raakt, zou als twee klanten lezen. */
  m.raak('tenant', 'O-A', true);
  const u = m.geraaktVan(['bedrijf', 'tenant']);
  assert.equal(u.organisaties, 2, 'de unie telt dubbel: ' + JSON.stringify(u));
  assert.equal(u.metFout, 2, 'O-A zag een fout op tenant, O-B op bedrijf');
});

test('2. de codes verlaten deze module niet', () => {
  m.raak('bedrijf', 'O-GEHEIM', true);
  const alles = JSON.stringify([m.geraakt('bedrijf'), m.geraaktVan(['bedrijf']), m.stand()]);
  assert.equal(alles.includes('O-GEHEIM'), false, 'er staat een org-code in een antwoord: ' + alles);
  /* En er is geen functie die ze wél zou geven. Dat is de controle die blijft
     werken als iemand er later een bouwt zonder deze kop te lezen. */
  for (const naam of Object.keys(m)) {
    if (typeof m[naam] !== 'function') continue;
    assert.equal(/codes|orgs|lijst|wie/i.test(naam), false,
      'de export "' + naam + '" klinkt alsof hij organisaties bij naam teruggeeft');
  }
});

test('3. het niet-toegewezen deel wordt geteld en niet weggelaten', () => {
  m.raak('bedrijf', 'O-A', false);
  for (let i = 0; i < 5; i++) m.raak('bedrijf', null, false);   // verkeer zonder organisatie
  const s = m.stand();
  assert.equal(s.organisaties, 1);
  assert.equal(s.nietToegewezen, 5, 'het niet-toegewezen verkeer is stil verdwenen');
  assert.match(s.let, /ONDERGRENS/, s.let);
  assert.match(s.let, /geen beschikbaarheidscijfer/, s.let);
});

test('4. niets gemeten is geen nul, en dit gaat niet mee naar Prometheus', () => {
  const g = m.geraakt('dom-bank-krediet');
  assert.equal(g.gemeten, false, 'een functie zonder verkeer meldt zich als gemeten');
  assert.equal(g.organisaties, 0);
  assert.ok(g.waarom, 'niet gemeten zonder reden leest als nul');

  /* De metrics-tekst wordt door server/meting.js geschreven. Deze module heeft
     er geen functie voor, en dat is de hele grendel. */
  assert.equal(typeof m.tekst, 'undefined', 'deze module schrijft Prometheus-tekst');
  const prom = require('../server/meting').tekst();
  assert.equal(/tenant|organisatie|\borg\b/i.test(prom), false,
    'er staat een tenant-begrip in het Prometheus-antwoord');
});

test('5. de bovengrens kapt af en zegt dat, in plaats van te laag te tellen', () => {
  for (let i = 0; i < m.MAX_ORGS + 10; i++) m.raak('bedrijf', 'O-' + i, false);
  const g = m.geraakt('bedrijf');
  assert.equal(g.organisaties, m.MAX_ORGS, 'de bovengrens hield niet');
  assert.equal(g.afgekapt, true, 'er is afgekapt zonder dat te melden');
});
