/* HET REISGEZELSCHAP, DE RITBEVESTIGING EN DE WERKRUIMTERECHTEN -- wat is hier
   "hetzelfde verzoek"? (routes/reis-opgave.js, routes/mobiliteit.js,
   routes/ik-workspace-rechten.js)

   Lezen is lezen: de eigen opgave, de voortgang (een aantal zonder namen), het
   groepsbeeld (de teller loopt bij het ZETTEN, niet bij het kijken) en de
   rechten van de werkruimte veranderen niets.

   Alles wat zet, zet een STAND en telt niet op: dezelfde opgave twee keer is
   dezelfde opgave, dezelfde instemming op dezelfde versie is een stem. Een
   woordelijk gelijke herhaling is dus een dubbeltik. Bij een optie is dat
   meer dan netheid: een tweede toetsing telt mee voor de grens van zes per
   etmaal die de plafonds van anderen beschermt (kern/reisgezelschap-opties.js
   vangt een ongewijzigde optie zelf ook al op). Wissen en intrekken gaan over
   de reis (en de optie), en een tweede keer wissen is niets. */
'use strict';
const SLEUTELS = {
  'POST /api/reis/gezelschap/opgave': { leest: true },
  'POST /api/reis/gezelschap/opgave/voortgang': { leest: true },
  'POST /api/reis/gezelschap/opties': { leest: true },
  'POST /api/ik/workspace/rechten': { leest: true },
  'POST /api/reis/gezelschap/opgave/zet': { zelfdeVerzoek: true },
  'POST /api/reis/gezelschap/opgave/wis': { velden: ['reis'] },
  'POST /api/reis/gezelschap/opties/zet': { zelfdeVerzoek: true },
  'POST /api/reis/gezelschap/opties/wis': { velden: ['reis', 'id'] },
  'POST /api/reis/gezelschap/voorstel/leg': { velden: ['reis', 'optie'] },
  'POST /api/reis/gezelschap/voorstel/trek': { velden: ['reis'] },
  'POST /api/reis/gezelschap/instem': { zelfdeVerzoek: true },
  'POST /api/reis/gezelschap/instem/terug': { velden: ['reis'] },
  /* De reiziger bevestigt zijn rit, of meldt dat er iets niet klopt: een
     tweede gelijke tik binnen het venster is dezelfde bevestiging. */
  'POST /api/mob/ontvangst': { zelfdeVerzoek: true },
  'POST /api/mob/ontvangst/probleem': { zelfdeVerzoek: true }
};
module.exports = { SLEUTELS };
