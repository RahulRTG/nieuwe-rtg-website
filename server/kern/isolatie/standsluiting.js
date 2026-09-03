/* WAT ELKE STAND SLUIT -- de vertaling van een stand naar effecten.

   Los van ./effecten.js omdat het de andere kant van dezelfde vraag is: dat
   bestand bepaalt welke effecten een PAD draagt, dit welke effecten een STAND
   dichtzet. De eerste groeit mee met het huis (elk nieuw pad kan een profiel
   krijgen), de tweede verandert alleen als iemand de betekenis van een stand
   verschuift -- en dat is een besluit met een heel ander gewicht.

   Ze uit elkaar houden betekent ook dat een gewone toevoeging aan de ene kant
   niet elke keer het bestand met de andere kant aanraakt. */
'use strict';

const { NAMEN } = require('./effectwoorden');

/* Uitgedrukt in het paar uit ./ordening.js, want `beschermd` is een eigenschap
   en geen trede. */

/* De eigenschap `beschermd` sluit precies wat kern/beschermstand-lijst.js met
   zijn zes bevroren categorieën bedoelt: nieuwe bevoorrechte handelingen en
   mutaties van derden. Deze zes zijn de vertaling daarvan naar effecten, en het
   is die vertaling die de schaduwmeting toetst. */
const BESCHERMD_SLUIT = Object.freeze([
  'VERTROUWENSRELATIE_AANGAAN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN',
  'GELD_BEWEGEN', 'BEVEILIGING_VERZWAKKEN', 'SCHRIJVEN_ANDERMANS'
]);

/* De tredes. `waakzaam` sluit met opzet niets -- hij markeert, en een stand die
   stiekem toch iets sluit is de reden dat niemand hem meer vertrouwt.
   `beperkt` sluit gerícht per functie en niet structureel per effect; daarom
   staat hij hier leeg met de reden en niet met een lege lijst zonder uitleg. */
const TREDE_SLUIT = Object.freeze({
  normaal:  [],
  waakzaam: [],
  beperkt:  [],
  isolatie: NAMEN.filter(n => n !== 'LEZEN_EIGEN')
});
const TREDE_WAAROM = Object.freeze({
  waakzaam: 'waakzaam markeert en sluit niets; een stand die stilletjes toch iets sluit, wordt niet meer vertrouwd',
  beperkt:  'beperkt sluit gericht per functie en niet per effect; wat er dichtgaat staat in het incident zelf'
});

/* Wat een stand sluit, uitgedrukt in effecten. */
function sluit(stand) {
  const trede = stand && stand.trede;
  const uit = new Set(TREDE_SLUIT[trede] || []);
  if (stand && stand.beschermd) for (const e of BESCHERMD_SLUIT) uit.add(e);
  return [...uit];
}

module.exports = { BESCHERMD_SLUIT, TREDE_SLUIT, TREDE_WAAROM, sluit };
