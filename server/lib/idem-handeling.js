/* DE HANDELING WAARIN EEN BOEKING VALT -- gedeeld door ./idem.js (die hem
   opent rond het werk) en kern/pay/boeking.js (die er per boeking een stap uit
   neemt). Een eigen bestand omdat het een eigen onderwerp is: idem.js gaat over
   de JS-opslag van een sleutel, dit over de sleutel die het ANDERE grootboek
   moet kennen. */
'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

/* DE HANDELING WAARIN EEN BOEKING VALT, en waarom de motor die moet kennen.

   De idem-sleutel en het antwoord van ./idem.js staan in de JS-opslag, en die
   commit pas NA het werk. In motorstand (RTG_MOTOR_GELD=motor) is het werk een
   boeking bij een ANDER grootboek, dat zelf al duurzaam heeft bevestigd. Valt
   het proces tussen die twee om -- of faalt de JS-commit -- dan is de
   JS-sleutel weg en het geld bij de motor niet, en de retry waar deze sleutel
   voor bestaat boekt dan een tweede keer bij de autoriteit. Zo gevonden met
   een `kill -9` en de echte motor (test/geld-motorsleutel.test.js).

   De ontdubbeling hoort dus OOK bij de motor, en dat kan alleen als elke
   boeking een sleutel draagt die bij een herhaling HETZELFDE is. Die sleutel
   is er al: dit is de idem-sleutel van de handeling, plus het volgnummer van
   de boeking binnen het werk. Het werk is deterministisch in de volgorde
   waarin het boekt; een herhaling die ANDERS zou boeken krijgt van de motor een
   409 (andere afdruk onder dezelfde sleutel) en nooit een stille tweede
   boeking.

   AsyncLocalStorage en geen extra parameter: de boekingen zitten in tientallen
   deelbestanden een paar lagen onder het werk, en een parameter die een van
   hen vergeet door te geven is precies het gat dat dit dichtmaakt. Een geneste
   handeling met een eigen sleutel krijgt een eigen telling; een geneste stap
   ZONDER sleutel telt mee in die van zijn ouder. */
const handeling = new AsyncLocalStorage();
function volgendeStap() {
  const h = handeling.getStore();
  if (!h) return null;
  return { naam: h.naam, sleutel: h.sleutel, stap: h.stappen++ };
}

module.exports = { handeling, volgendeStap };
