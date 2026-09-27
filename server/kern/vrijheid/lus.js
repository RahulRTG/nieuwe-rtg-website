/* VRIJHEID: PEOPLE_TIME_LOOP_COMPLETENESS_CHECK -- geen groen zolang een schakel
   ontbreekt.

   PERSON -> POLICY -> ROSTER -> WORK -> COVERAGE -> FAIRNESS -> DECISION ->
   HANDOVER -> TIME -> IMPACT -> CAPACITY -> IMPROVEMENT

   Elke schakel noemt WAAR hij woont en WELKE toets hem bewijst, en
   test/vrijheid-lus.test.js houdt beide tegen de boom: een schakel die naar
   een bestand of toets wijst die er niet is, laat de bouw zakken. De stand is
   met opzet grof -- STAAT, DEELS, ONTBREEKT -- en de totaalstand is READY
   alleen als ELKE schakel staat. Er is geen percentage: een lus die voor 90%
   rond is, is niet rond.

   DEELS betekent hier altijd hetzelfde: de logica staat en is beproefd op een
   teambeeld, maar de BRON die dat teambeeld in productie zou vullen is nog
   niet aangesloten. Dat is precies het verschil tussen "de motor werkt" en
   "de belofte bestaat" (BETROUWBAARHEID.md). */
'use strict';

const T = 'test/vrijheid.test.js';
const SCHAKELS = Object.freeze([
  { schakel: 'PERSON', stand: 'DEELS', waar: 'server/kern/vrijheid/dekking.js', bewijs: [T, 'uit dienst telt niet mee'],
    ontbreekt: 'Adapter van kern/concern/employment.js en accounts/staff.js naar het teambeeld; staff draagt vandaag geen verjaardag (MM-DD) en die moet rechtmatig worden vastgelegd.' },
  { schakel: 'POLICY', stand: 'DEELS', waar: 'server/kern/vrijheid/rtgbeleid.js', bewijs: [T, 'het besluit van de eigenaar staat, en de rest blijft open'],
    ontbreekt: 'Besloten (27 september 2026): tien RTG Days, en een verjaardag op een vrije dag schuift naar de vorige werkdag. Nog open: nachtdienst, schrikkeldag en alle drempels. Niets ervan is juridisch en loonadministratief gevalideerd.' },
  { schakel: 'ROSTER', stand: 'DEELS', waar: 'server/kern/vrijheid/jaarplan.js', bewijs: [T, 'onbekende rooster-uitkomst wordt eerst afgestemd'],
    ontbreekt: 'Rooster-adapter (pas/heeft) naar de bestaande roosters: kern/personeel.js, kern/beveiliging/rooster/, kern/festival/dienst.js.' },
  { schakel: 'WORK', stand: 'DEELS', waar: 'server/kern/vrijheid/werkstand.js', bewijs: [T, 'zelf afvinken is geen WORK_COMPLETE'],
    ontbreekt: 'Geen domein legt vandaag verantwoordelijkheden per dienst vast; zonder bron is de werkstand UNKNOWN en komt er geen automatisch aanbod.' },
  { schakel: 'COVERAGE', stand: 'STAAT', waar: 'server/kern/vrijheid/dekking.js', bewijs: [T, 'vier aanwezigen zijn te weinig zonder de specialist'] },
  { schakel: 'FAIRNESS', stand: 'STAAT', waar: 'server/kern/vrijheid/eerlijkheid.js', bewijs: [T, 'gouden bewijs D: schaars moment eerlijk verdeeld'] },
  { schakel: 'DECISION', stand: 'STAAT', waar: 'server/kern/vrijheid/besluit.js', bewijs: [T, 'gouden bewijs C: eerder weg aangevraagd'] },
  { schakel: 'HANDOVER', stand: 'DEELS', waar: 'server/kern/vrijheid/aanbod.js', bewijs: [T, 'gouden bewijs B: eerder naar huis'],
    ontbreekt: 'Brug naar een echte overdracht (kern/horeca/wijk-overdracht.js kent aanbieden en aanvaarden, maar alleen voor een horecawijk).' },
  { schakel: 'TIME', stand: 'DEELS', waar: 'server/kern/vrijheid/categorieen.js', bewijs: [T, 'categorieen schrijven nooit van elkaars saldo af'],
    ontbreekt: 'kern/payroll/samenstellen.js leest de nieuwe categorieen nog niet; betaalde vrije tijd bereikt de loonstrook dus niet.' },
  { schakel: 'IMPACT', stand: 'ONTBREEKT', waar: null, bewijs: null,
    ontbreekt: 'Werkelijke impact (geklokte uren uit db.data.klok, feitelijke dekking) wordt niet teruggelezen.' },
  { schakel: 'CAPACITY', stand: 'STAAT', waar: 'server/kern/vrijheid/capaciteit.js', bewijs: [T, 'gouden bewijs F: capaciteit leert en de lus sluit'] },
  { schakel: 'IMPROVEMENT', stand: 'DEELS', waar: 'server/kern/vrijheid/capaciteit.js', bewijs: [T, 'gouden bewijs F: capaciteit leert en de lus sluit'],
    ontbreekt: 'Er is geen Academy-module; een opleidingsbehoefte wordt vastgelegd maar door niemand opgepakt. Sluiten gebeurt via een afgetekende bevoegdheid (kern/vakbewijs.js).' }
]);

const OVERIG = Object.freeze([
  'Geen HTTP-route en geen scherm: de motor is niet gemount (VRIJHEID.md par. 7).',
  'Geen duurzame opslag: de motor schrijft via de meegegeven opslag en is nog niet op db.data aangesloten.',
  'Geen productiebewijs.'
]);

function status() {
  const blockers = SCHAKELS.filter(s => s.stand !== 'STAAT').map(s => s.schakel + ': ' + s.ontbreekt).concat(OVERIG);
  return { PEOPLE_TIME_STATUS: blockers.length ? 'BLOCKED' : 'READY', schakels: SCHAKELS, blockers };
}

module.exports = { SCHAKELS, OVERIG, status };
