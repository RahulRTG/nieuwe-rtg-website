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
const TB = 'test/vrijheid-teambeeld.test.js';
const TS = 'test/vrijheid-saldo.test.js';
const SCHAKELS = Object.freeze([
  { schakel: 'PERSON', stand: 'STAAT', waar: 'server/kern/vrijheid/teambeeld.js', bewijs: [TS, 'het teambeeld en het saldo uit de echte bronnen: dienstverband, contract, en de regel die open blijft'] },
  { schakel: 'POLICY', stand: 'DEELS', waar: 'server/kern/vrijheid/rtgbeleid.js', bewijs: [T, 'het besluit van de eigenaar staat, en de rest blijft open'],
    ontbreekt: 'Besloten (27 september 2026): tien RTG Days, en een verjaardag op een vrije dag schuift naar de vorige werkdag. Besloten (11 oktober 2026, B1): een Nederlandse rekenregel voor het vakantierecht die WorkOS uitvoert (vakantieregel.js: art. 7:634 en 7:635 BW, als laag LEGAL_BASELINE onder het beleid van een Nederlandse zaak), achter een productiepoort die DICHT staat tot de juridische toets is afgerond (vakantiepoort.js). Nog open: nachtdienst, schrikkeldag, alle drempels, de juridische toets zelf, en ouderschaps- en zorgverlof in de opbouwtabel. Niets ervan is juridisch en loonadministratief gevalideerd.' },
  { schakel: 'ROSTER', stand: 'DEELS', waar: 'server/kern/vrijheid/teambeeld.js', bewijs: [TB, 'het teambeeld komt uit de bronnen, en zegt wat ontbreekt'],
    ontbreekt: 'Het rooster wordt GELEZEN uit kern/personeel.js, maar kijkt maar zeven dagen vooruit en een dag zonder vastgesteld rooster is een patroon. De haak `pas`/`heeft` schrijft sinds 27 september in het verzuimregister (verzuimbrug.js), en elke planner van een zaak leest dat (kern/payroll/inplanbaar.js: weekrooster, de twee autoplanners, OV, festival en taxi; de school heeft een eigen register).' },
  { schakel: 'WORK', stand: 'DEELS', waar: 'server/kern/vrijheid/werkstand.js', bewijs: [T, 'zelf afvinken is geen WORK_COMPLETE'],
    ontbreekt: 'Geen domein legt vandaag verantwoordelijkheden per dienst vast; zonder bron is de werkstand UNKNOWN en komt er geen automatisch aanbod.' },
  { schakel: 'COVERAGE', stand: 'STAAT', waar: 'server/kern/vrijheid/dekking.js', bewijs: [T, 'vier aanwezigen zijn te weinig zonder de specialist'] },
  { schakel: 'FAIRNESS', stand: 'STAAT', waar: 'server/kern/vrijheid/eerlijkheid.js', bewijs: [T, 'gouden bewijs D: schaars moment eerlijk verdeeld'] },
  { schakel: 'DECISION', stand: 'STAAT', waar: 'server/kern/vrijheid/besluit.js', bewijs: [T, 'gouden bewijs C: eerder weg aangevraagd'] },
  { schakel: 'HANDOVER', stand: 'DEELS', waar: 'server/kern/vrijheid/aanbod.js', bewijs: [T, 'gouden bewijs B: eerder naar huis'],
    ontbreekt: 'Brug naar een echte overdracht (kern/horeca/wijk-overdracht.js kent aanbieden en aanvaarden, maar alleen voor een horecawijk).' },
  { schakel: 'TIME', stand: 'DEELS', waar: 'server/kern/vrijheid/verzuimbrug.js', bewijs: ['test/vrijheid-verzuim.test.js', 'een toegekende RTG Day staat in het verzuimregister en op de strook als RTG Day, volledig betaald'],
    ontbreekt: 'Een toegekende hele vrije dag staat in het verzuimregister en daarmee op de strook, en intrekken haalt hem er weer af. Het vakantierecht wordt gelezen uit de bestaande bronnen (saldobron.js: dienstverband, contractversie in de payroll, verzuimregister) en gerekend met de rekenregel (vakantieregel.js: naar rato, wisselende arbeidsduur per contractversie, ziekte telt door), maar dat getal draagt de graad vermoed en wordt GEEN recht zolang de productiepoort dicht is (juridische toets niet afgerond); een vakantieverzoek blijft dan UNKNOWN met die reden (test/vrijheid-vakantieregel.test.js). Ook open: contracten zonder vaste omvang, meer dan een contract, ouderschaps- en zorgverlof, en vakantie uit de verlofroute (in dagen). Bovenwettelijk verlof draagt geen enkel contract. Nog niet: een deel van een dag (eerder weg, later beginnen) heeft geen vorm in de payroll, een oproepkracht krijgt een handmatige bevinding in plaats van een bedrag, en niets hiervan is loonadministratief gevalideerd.' },
  { schakel: 'IMPACT', stand: 'ONTBREEKT', waar: null, bewijs: null,
    ontbreekt: 'Werkelijke impact (geklokte uren uit db.data.klok, feitelijke dekking) wordt niet teruggelezen.' },
  { schakel: 'CAPACITY', stand: 'STAAT', waar: 'server/kern/vrijheid/capaciteit.js', bewijs: [T, 'gouden bewijs F: capaciteit leert en de lus sluit'] },
  { schakel: 'IMPROVEMENT', stand: 'DEELS', waar: 'server/kern/vrijheid/capaciteit.js', bewijs: [T, 'gouden bewijs F: capaciteit leert en de lus sluit'],
    ontbreekt: 'Er is geen Academy-module; een opleidingsbehoefte wordt vastgelegd maar door niemand opgepakt. Sluiten gebeurt via een afgetekende bevoegdheid (kern/vakbewijs.js).' }
]);

const OVERIG = Object.freeze([
  'Geen zaak in de zaaiset hangt aan een entiteit met een lopend dienstverband. Langs de gewone routes (entiteit, vestiging, zaak koppelen, dienstverband inhalen) leest het teambeeld het wel (test/vrijheid-saldo.test.js), maar een proef op de zaaiset eindigt nog bij die reden.',
  'De schermen staan (Mijn tijd in de personeelsapp, Tijd van het team in het Kantoor; test/vrijheid-scherm.e2e.js), maar de gouden lus -- vragen, dekking, besluit, vrij -- is in een browser nog nooit rond gelopen: zonder dienstverband eindigt elk verzoek op het scherm bij die reden.',
  'Drie routes zijn niet beproefd omdat de proefopstelling de wereld niet kan bouwen (intrekken, beoordelen, afdelingen zetten): BLOCKED_BY_TEST_FIXTURE in server/lib/mutatiecontracten-vrijheid.js.',
  'Een zetel met een kamer in de RTG-zaak opent het kantoor op naam (rtgzetel.js), maar de gedeelde OFFICE_CODE werkt nog en de kamers worden alleen in de schaduw geteld: afdwingen per kamer is een apart besluit.',
  'Geen productiebewijs.'
]);

function status() {
  const blockers = SCHAKELS.filter(s => s.stand !== 'STAAT').map(s => s.schakel + ': ' + s.ontbreekt).concat(OVERIG);
  return { PEOPLE_TIME_STATUS: blockers.length ? 'BLOCKED' : 'READY', schakels: SCHAKELS, blockers };
}

module.exports = { SCHAKELS, OVERIG, status };
