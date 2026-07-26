/* Muisvrij bedienen (public/shared/handenvrij.js): de zinsontleding.

   De balk, de microfoon en de stem leven in de browser; de bedoeling-uit-een-zin
   is een pure functie en die is hier los getoetst. Dat is ook de plek waar het
   fout kan gaan met gevolgen: leest de ontleding een gewone opdracht per ongeluk
   als navigatie, dan gaat de gebruiker ergens naartoe in plaats van dat er iets
   gebeurt. Leest hij hem als iets ANDERS dan een vraag, dan zou een half-verstane
   spraakzin een handeling kunnen worden. Vandaar dat toets 5 de belangrijkste is:
   alles wat niet zeker navigatie is, hoort onveranderd naar Rahul te gaan.

   Draai los: node --experimental-sqlite --test test/handenvrij.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/shared/handenvrij');

// een pagina met een paar plekken, zoals de balk ze uit de DOM oppikt
const nep = () => { let n = 0; return { tel: () => n, doen: () => { n++; } }; };
function plekkenVan(namen) {
  return namen.map(naam => ({ naam, doen: () => {} }));
}
const PLEKKEN = plekkenVan(['De Salon', 'Bestellen', 'Reizen', 'Mijn pas', 'Spelen']);

test('1. kaal: hoofdletters, accenten en tekens gaan eraf', () => {
  assert.equal(H.kaal('Ga naar de Salon!'), 'ga naar de salon');
  assert.equal(H.kaal('Café'), 'cafe', 'accenten samengevoegd en weg');
  assert.equal(H.kaal('  dubbele   ruimte '), 'dubbele ruimte');
  assert.equal(H.kaal(null), '');
});

test('2. een sprong naar een bekende plek wordt herkend, in alle vormen', () => {
  for (const zin of ['open de Salon', 'ga naar de salon', 'naar salon', 'toon de Salon',
    'laat me de Salon zien', 'breng me naar de salon', 'SALON', 'Salon.']) {
    const b = H.versta(zin, PLEKKEN);
    assert.equal(b.soort, 'ga', 'niet herkend: ' + zin);
    assert.equal(b.plek.naam, 'De Salon', 'verkeerde plek bij: ' + zin);
  }
});

test('3. de vaste bewegingen (terug, scrollen, sluiten, stil)', () => {
  const paren = [['terug', 'terug'], ['vorige', 'terug'], ['vooruit', 'vooruit'],
    ['sluit', 'sluit'], ['laat maar', 'sluit'], ['omhoog', 'omhoog'], ['naar onder', 'omlaag'],
    ['bovenaan', 'begin'], ['onderaan', 'eind'], ['wat kan ik zeggen', 'lijst'],
    ['stil', 'stil'], ['praat maar', 'luid']];
  for (const [zin, soort] of paren) assert.equal(H.versta(zin, PLEKKEN).soort, soort, 'mis bij: ' + zin);
});

test('4. de plek wordt uitgevoerd, en alleen die', () => {
  const a = nep(), b = nep();
  const plekken = [{ naam: 'Bestellen', doen: a.doen }, { naam: 'Betalen', doen: b.doen }];
  H.versta('open bestellen', plekken).plek.doen();
  assert.equal(a.tel(), 1);
  assert.equal(b.tel(), 0, 'de andere plek blijft ongemoeid');
});

test('5. een gewone opdracht wordt NOOIT navigatie', () => {
  /* Dit is de kern. Deze zinnen bevatten allemaal woorden die op navigatie
     lijken ("naar", "open", "boven"), maar het zijn opdrachten. Ze horen
     onveranderd bij Rahul te komen, met de geld-drempel en de bevestiging die
     daar zitten. Zou een van deze als sprong worden gelezen, dan gebeurt er
     niets van wat de gebruiker vroeg. */
  const opdrachten = [
    'boek een taxi naar huis',
    'stuur 20 euro naar Imran',
    'open de deur van kamer 12',
    'reserveer een tafel voor vier vanavond',
    'ga je gang en bestel het gebruikelijke',
    'naar wie is die factuur gestuurd',
    'zet de verwarming boven de 20 graden',
    'toon me hoeveel ik deze maand heb uitgegeven',
    'betaal de rekening van tafel 6'
  ];
  for (const zin of opdrachten) {
    const b = H.versta(zin, PLEKKEN);
    assert.equal(b.soort, 'vraag', 'werd geen vraag: ' + zin);
    assert.equal(b.zin, zin, 'de zin moet ONGEWIJZIGD doorgaan naar Rahul');
  }
});

test('6. bij twijfel tussen twee plekken kiest hij er geen', () => {
  // "be" past op Bestellen en Betalen; dan is niets doen beter dan gokken
  const plekken = plekkenVan(['Bestellen', 'Betalen']);
  assert.equal(H.zoekPlek('be', plekken), null);
  assert.equal(H.versta('open be', plekken).soort, 'vraag');
  // met een naam die maar op een plek past, gaat het wel
  assert.equal(H.versta('open bestel', plekken).plek.naam, 'Bestellen');
});

test('7. zonder bekende plekken valt alles terug op Rahul', () => {
  assert.equal(H.versta('open de Salon', []).soort, 'vraag');
  assert.equal(H.versta('open de Salon', null).soort, 'vraag');
  // de vaste bewegingen werken wel altijd: die hebben geen plekken nodig
  assert.equal(H.versta('terug', []).soort, 'terug');
});

test('8. een lege of onzinnige zin doet niets', () => {
  assert.equal(H.versta('', PLEKKEN).soort, 'niets');
  assert.equal(H.versta('   ', PLEKKEN).soort, 'niets');
  assert.equal(H.versta(null, PLEKKEN).soort, 'niets');
  assert.equal(H.versta('!!!', PLEKKEN).soort, 'niets');
});

test('9. het wekwoord: wie niet tegen Rahul praat, wordt niet gehoord', () => {
  // aangesproken: het wekwoord eraf, de rest met de oorspronkelijke tekst
  assert.equal(H.gericht('Rahul, open de Salon', false), 'open de Salon');
  assert.equal(H.gericht('rahul open de Salon', false), 'open de Salon');
  assert.equal(H.gericht('Hey Rahul, boek een taxi', false), 'boek een taxi');
  // alleen zijn naam: aangesproken, maar zonder opdracht (leeg, niet null)
  assert.equal(H.gericht('Rahul', false), '');
  assert.equal(H.gericht('Rahul?', false), '');
  // niet aangesproken en niet wakker: helemaal negeren
  assert.equal(H.gericht('geef mij het zout even aan', false), null);
  assert.equal(H.gericht('open de Salon', false), null);
  // wel wakker (net iets gezegd): een vervolgzin mag zonder wekwoord
  assert.equal(H.gericht('en nu naar Reizen', true), 'en nu naar Reizen');
});

test('10. een naam die op Rahul lijkt is niet Rahul', () => {
  // geen woordgrens = niet aangesproken; anders zou "Rahula" of "rahulstraat"
  // de microfoon laten happen op iets wat niet tegen hem gezegd is
  assert.equal(H.gericht('Rahulstraat 12 is het adres', false), null);
  assert.equal(H.gericht('over Rahul gesproken, hij belde net', false), null);
});

/* ---------- de geldgrens ----------
   Vanaf hier gaat het niet meer over gemak maar over geld. geldZin() bepaalt of
   een zin standaard getypt moet worden. De weegschaal hangt hier bewust andersom
   dan bij navigatie: te veel herkennen is hinderlijk, te weinig herkennen kost
   geld. Toets 12 is daarom de belangrijkste van dit bestand. */

test('11. een vraag over geld is geen opdracht en mag gewoon met de mond', () => {
  // Anders zou je niet eens meer mogen VRAGEN wat iets kost zonder te typen.
  for (const zin of [
    'wat kost een taxi naar huis',
    'hoeveel heb ik nog op mijn pas',
    'hoe boek ik een taxi?',
    'is er nog plek vanavond?',
    'kan ik dit ergens goedkoper krijgen',
    'wanneer wordt mijn abonnement afgeschreven'
  ]) assert.equal(H.geldZin(zin), false, 'werd onterecht als geld gelezen: ' + zin);
});

test('12. alles wat geld kost of vastlegt wordt herkend', () => {
  /* Deze lijst is de kern. Glipt hier iets doorheen, dan kan een half verstaan
     woord een betaling of een boeking worden. Bij twijfel hoort het hier te
     staan, ook als dat betekent dat iemand vaker moet typen. */
  for (const zin of [
    'boek een taxi naar huis',
    'stuur 20 euro naar Imran',
    'betaal dit',
    'betaal de rekening van tafel 6',
    'reken de tafel af',
    'maak 50 euro over naar mijn spaarrekening',
    'bestel het gebruikelijke',
    'tik Imran een tientje',
    'reserveer een tafel voor vier vanavond',
    'huur die auto voor het weekend',
    'koop twee kaartjes voor zaterdag',
    'verleng mijn abonnement',
    'doneer 100 euro aan de foundation',
    'schrijf 30 euro over',
    'bevestig de boeking'
  ]) assert.equal(H.geldZin(zin), true, 'niet als geld herkend: ' + zin);
});

test('13. gewone opdrachten zonder geld blijven vrij', () => {
  // De poort mag niet zo ruim worden dat alles getypt moet.
  for (const zin of [
    'zet de verwarming lager',
    'open de deur van kamer 12',
    'stuur Imran een bericht dat ik later ben',
    'zet mijn locatie aan',
    'herinner me hier vanavond aan',
    'open de Salon',
    'terug'
  ]) assert.equal(H.geldZin(zin), false, 'onterecht tegengehouden: ' + zin);
});

test('14. leeg of onzin is geen geld', () => {
  assert.equal(H.geldZin(''), false);
  assert.equal(H.geldZin('   '), false);
  assert.equal(H.geldZin(null), false);
  assert.equal(H.geldZin('!!!'), false);
});

test('15. de geldgrens staat los van de navigatie-ontleding', () => {
  /* Een sprong is nooit geld en geld is nooit een sprong: dat zijn twee aparte
     vragen aan dezelfde zin. "open de Salon" is navigatie en geen geld;
     "boek een taxi" is geen navigatie en wel geld. */
  const plekken = plekkenVan(['De Salon', 'Betalen']);
  assert.equal(H.versta('open de Salon', plekken).soort, 'ga');
  assert.equal(H.geldZin('open de Salon'), false);
  assert.equal(H.versta('boek een taxi naar huis', plekken).soort, 'vraag');
  assert.equal(H.geldZin('boek een taxi naar huis'), true);
  // ook als een PLEK "Betalen" heet blijft navigeren gewoon navigeren
  assert.equal(H.versta('ga naar Betalen', plekken).soort, 'ga');
});
