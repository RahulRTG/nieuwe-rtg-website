/* ============================================================================
   DE BEGRIPPEN VAN EEN FACTUURCORRECTIE -- de gronden, en wat er met opzet
   niet is.

   Afgesplitst van ./factuurcorrectie.js langs dezelfde lijn als
   kern/horeca/correctielijst.js: hier de VOCABULAIRE (wat kan een grond zijn,
   en wat wordt er bewust niet gebouwd), daar de MOTOR (wie mag wat, en wat
   gebeurt er met het geld). Een grond erbij is een besluit van de eigenaar
   over zijn eigen facturen, en dat hoort niet verstopt tussen de rekenregels.

   Waarom deze weg bestaat staat in de kop van ./factuurcorrectie.js.
   ========================================================================== */
'use strict';

/* De gronden. `wie` zegt van wiens kant het signaal komt -- dat is GEEN
   bevoegdheid (corrigeren doet altijd een mens van het kantoor) maar het
   antwoord op de vraag die je achteraf over een terugbetaling stelt: kwam dit
   doordat het lid aan de bel trok, of doordat wij het zelf zagen?

   Een gesloten lijst, om dezelfde reden als bij de horeca: een vrij tekstveld
   heeft hier binnen een maand veertig varianten van "fout". */
const GRONDEN = [
  { id: 'onterecht', label: 'Onterecht gefactureerd', wie: 'lid',
    wat: 'Deze factuur had niet verstuurd mogen worden.' },
  { id: 'dubbel', label: 'Dubbel in rekening gebracht', wie: 'kantoor',
    wat: 'Hetzelfde is twee keer gefactureerd; dit is de tweede.' },
  { id: 'bedrag-te-hoog', label: 'Bedrag te hoog', wie: 'lid',
    wat: 'Er is meer gefactureerd dan afgesproken.' },
  { id: 'niet-geleverd', label: 'Niet geleverd', wie: 'lid',
    wat: 'Waar deze factuur voor was, heeft het lid niet gekregen.' },
  { id: 'coulance', label: 'Coulance', wie: 'kantoor',
    wat: 'RTG betaalt terug zonder dat de factuur fout was. Dat is een keuze en geen erkenning.' }
];
const GROND = new Map(GRONDEN.map(g => [g.id, g]));

/* Wat deze laag met opzet NIET doet. Staat hier en niet in een document, zodat
   wie de module opent het antwoord vindt op de vraag die hij komt stellen. */
const NIET_GEBOUWD = {
  'de-factuur-weer-openzetten':
    'Nooit. De factuur blijft `paid` en de correctie staat ERNAAST. Twee redenen, en de tweede is ' +
    'gemeten: (1) de eigenaar heeft vastgelegd dat financiele historie niet wordt herschreven -- ' +
    '+500 / -500 / +450 en geen stilzwijgend verdwenen 500; (2) 19 lezers in server/ en public/ ' +
    'splitsen binair op `status === "paid"`, en de ledenschermen renderen alles wat dat NIET is als ' +
    '"open" (app-main-45.js: `it.status === "paid" ? "paid" : it.status === "req" ? "req" : "open"`). ' +
    'Een derde stand zou een gecorrigeerde factuur bij het lid tonen als openstaande schuld.',
  'gedeeltelijk-corrigeren':
    'Bestaat niet. Een correctie gaat over ALLES wat er op deze factuur werkelijk is binnengekomen ' +
    '(`inv.deelbetaald`). Een deel terugbetalen vraagt een eigen bedrag, en dus een tweede besluit ' +
    'met een eigen grond; dat is een andere functie en geen parameter erbij.',
  'correctie-door-het-lid':
    'Een lid MELDT en een mens van het kantoor corrigeert. Een knop waarmee een lid zijn eigen ' +
    'betaalde factuur terugdraait, is een kas die iedereen mag bedienen.',
  'de-afdracht-terugboeken':
    'Kan vandaag niet, en dat staat in de uitslag in plaats van dat het stil blijft. De 30%-afdracht ' +
    'aan de RTFoundation is al geboekt (kern/fonds.js boekAfdracht). Het GELD ervan terughalen vraagt ' +
    'een positie om aan te betalen, en die bestaat niet -- GIFT.md: er is geen codenaam of positie ' +
    'van de RTFoundation. De correctie schrijft daarom haar eigen regel op de afdracht met ' +
    '`geld.stand = nietGeregeld` en de reden erbij, precies de vorm van kern/reisbureau-nazorg.js. ' +
    'Een leeg veld zou hier als "afgehandeld" gelezen worden.',
  'de-correctie-ongedaan-maken':
    'Bestaat niet. Een correctie is zelf een gebeurtenis; wie hem terug wil draaien, factureert ' +
    'opnieuw. Anders ontstaat er een keten van terugdraaiingen waarin niemand meer ziet wat er is ' +
    'afgesproken.'
};

module.exports = { GRONDEN, GROND, NIET_GEBOUWD };
