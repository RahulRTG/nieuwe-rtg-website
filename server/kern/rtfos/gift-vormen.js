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
const ANBI_STANDEN = ['onbekend', 'nee', 'ja'];

module.exports = { STANDEN, VORMEN, ANBI_STANDEN };
