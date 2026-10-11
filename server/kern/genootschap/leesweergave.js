/* Genootschap (deelmodule): de leesweergave voor Rahul.

   WAAROM EEN APARTE WEERGAVE. kern/genootschap/ai.js kreeg het hele prikbord, de
   hele bijeenkomstmodule en het hele genootschap mee, en daarmee lagen `stem`,
   `weg`, `plaats`, `roepBijeen` en `afgelast` binnen bereik van de code die met
   een model praat. De regel van die module -- hij stelt voor, de mens plaatst --
   werd door niets afgedwongen (GEMEENSCHAP-FASE0.md par. 6, gebrek 4).

   Deze weergave draagt precies wat de AI-laag LEEST, en verder niets. Zij is
   bevroren, zodat er niemand onderweg een functie bij kan hangen, en zij geeft
   functies door en geen objecten, zodat er geen weg terug is naar de module.
   Een nieuwe leesbehoefte is een regel hier, en een toets
   (test/genootschap-ai-leesweergave.test.js) die meekijkt. Een SCHRIJFfunctie
   hoort hier nooit bij: wat de AI klaarzet, plaatst een mens. */
'use strict';

function leesweergave({ genootschap, prikbord, bijeenkomst }) {
  return Object.freeze({
    groepMet: (id) => genootschap.groepMet(id),
    isLid: (gr, key) => genootschap.isLid(gr, key),
    regels: (groepId, hoeveel) => prikbord.regels(groepId, hoeveel),
    agenda: (sess, groepId) => bijeenkomst.agenda(sess, groepId)
  });
}

module.exports = { leesweergave };
