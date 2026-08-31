/* De woordenlijsten van de giftstand, apart omdat ./gift.js en
   ./gift-voornemen.js ze allebei nodig hebben.

   WAAROM EEN EIGEN BESTAND EN GEEN KOPIE. Toen het voornemen werd afgesplitst,
   was de snelste weg om VORMEN daar opnieuw op te schrijven. Drie woorden, wat
   kan er misgaan -- precies de redenering waar SEMANTIEK.json 78 gevallen van
   telt. Ze staan hier een keer.

   En het zijn LIJSTEN en geen instellingen: de drie giftvormen verschillen
   juridisch, en `onbekend` is met opzet iets anders dan `nee`. */
'use strict';

const STANDEN = ['dicht', 'open'];
const VORMEN = ['eenmalig', 'geoormerkt', 'periodiek'];
/* VIER STANDEN EN NIET DRIE. `aangevraagd` is er bij gekomen omdat het de
   werkelijke stand van de RTFoundation is (31 augustus 2026): nog geen ANBI,
   aanvraag loopt. Dat leest anders dan `nee` en anders dan `onbekend`, en de
   zin die de gever te zien krijgt hoort mee te bewegen met de knop.

   WAT `aangevraagd` NIET BELOOFT: dat deze gift later alsnog aftrekbaar wordt.
   Dat hangt af van de beschikking en de datum ervan, en dat is niets wat dit
   systeem kan vaststellen. Het zegt dus wat het weet -- de aanvraag loopt -- en
   niet wat het hoopt. */
const ANBI_STANDEN = ['onbekend', 'nee', 'aangevraagd', 'ja'];

module.exports = { STANDEN, VORMEN, ANBI_STANDEN };
