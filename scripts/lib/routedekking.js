/* WANNEER TELT EEN ROUTE ALS "KOMT IN EEN TEST VOOR".

   Deze regels stonden in scripts/keuring.js, binnen in dekking(), als een
   functie die verder niemand kon aanroepen. Toen scripts/deltapoort.js en later
   scripts/nieuweroutes.js dezelfde vraag moesten stellen over de routes die
   NIEUW zijn in een wijziging, waren er twee wegen: de regels overtypen, of ze hierheen halen.

   Overtypen is regel 4 van de lat (nooit twee plekken die een waarheid
   vasthouden), en juist bij deze regels loopt dat gegarandeerd mis: ze zijn
   drie keer bijgesteld omdat de teller de verkeerde vorm zocht. Een tweede
   kopie zou die correcties niet hebben, en dan meet de poort iets anders dan
   de ratel -- terwijl de poort er juist is om de ratel vooruit te helpen.

   WAT DIT WEL EN NIET IS. Het is een TEKSTZOEKTOCHT, en die zit er twee kanten
   op naast; de kop van dekking() in keuring.js schrijft dat uit. Het echte
   dekkingscijfer komt uit scripts/dekking.js, dat het journaal leest dat de
   server tijdens een echte testronde zelf schrijft. Dit is de indicatie. */
'use strict';

const { maakDekkingsIndex } = require('./dekkingsindex');

/* Geeft een functie terug die zegt of een route in de meegegeven testtekst
   voorkomt. De tekst gaat er ONTDAAN VAN COMMENTAAR in -- dat is geen detail
   maar de reparatie waardoor het cijfer niet meer met een zoek-en-vervang op te
   poetsen is. De aanroeper doet dat, want die weet welke bestanden het zijn. */
function maakZoeker(testTekst) {
  return maakDekkingsIndex(testTekst);
}

/* Dezelfde vraag, maar zonder eerst een zoeker te maken -- de vorm die
   scripts/nieuweroutes.js gebruikt in een filter-lus. Het register wordt per
   tekst EEN keer gebouwd en vastgehouden; zonder die cache zou elke route de
   hele toetstekst opnieuw indexeren, en dat is precies de traagheid waar
   dekkingsindex.js voor bestaat. */
const losseTeksten = new Map();
function gedektIn(route, testTekst) {
  const sleutel = typeof testTekst === 'string' ? testTekst : null;
  if (sleutel === null) return maakZoeker(String(testTekst))(route);
  let zoek = losseTeksten.get(sleutel);
  if (!zoek) { zoek = maakZoeker(sleutel); losseTeksten.set(sleutel, zoek); }
  return zoek(route);
}

module.exports = { maakZoeker, gedektIn };
