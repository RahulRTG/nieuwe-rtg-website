/* HET REISGEZELSCHAP, DE RITBEVESTIGING EN DE WERKRUIMTERECHTEN -- wat is hier
   "hetzelfde verzoek"? (routes/reis-opgave.js, routes/mobiliteit.js,
   routes/ik-workspace-rechten.js)

   Lezen is lezen: de eigen opgave, de voortgang (een aantal zonder namen), het
   groepsbeeld (de teller loopt bij het ZETTEN, niet bij het kijken) en de
   rechten van de werkruimte veranderen niets.

   Alles wat zet, zet een STAND, en de handler is daar zelf al idempotent op:
   dezelfde opgave twee keer is dezelfde opgave, een ongewijzigde optie kost
   geen toetsing en zegt dat ook (`getoetst: false`, kern/reisgezelschap-
   opties.js), dezelfde instemming op dezelfde versie is een stem. Een poort
   die een woordelijk gelijke herhaling het OUDE antwoord geeft, maakt het hier
   slechter: hij gaf een dubbeltik op een optie `getoetst: true` mee, en hij
   zou leg -> trek -> leg (of instem -> terug -> instem) binnen het venster de
   derde stap stil laten opslokken. Daarom staan deze routes als
   nietIdempotent: de poort doet niets, en de handler bewaakt de stand. */
'use strict';
const STAND = 'zet een stand en de handler is daar zelf idempotent op; een herhaald oud antwoord zou een dubbeltik als toetsing of wijziging tellen en een wissel (leg/trek, instem/terug) binnen het venster opslokken';
const SLEUTELS = {
  'POST /api/reis/gezelschap/opgave': { leest: true },
  'POST /api/reis/gezelschap/opgave/voortgang': { leest: true },
  'POST /api/reis/gezelschap/opties': { leest: true },
  'POST /api/ik/workspace/rechten': { leest: true },
  'POST /api/reis/gezelschap/opgave/zet': { nietIdempotent: true, waarom: STAND },
  'POST /api/reis/gezelschap/opgave/wis': { nietIdempotent: true, waarom: STAND },
  'POST /api/reis/gezelschap/opties/zet': { nietIdempotent: true, waarom: STAND },
  'POST /api/reis/gezelschap/opties/wis': { nietIdempotent: true, waarom: STAND },
  'POST /api/reis/gezelschap/voorstel/leg': { nietIdempotent: true, waarom: STAND },
  'POST /api/reis/gezelschap/voorstel/trek': { nietIdempotent: true, waarom: STAND },
  'POST /api/reis/gezelschap/instem': { nietIdempotent: true, waarom: STAND },
  'POST /api/reis/gezelschap/instem/terug': { nietIdempotent: true, waarom: STAND },
  /* De reiziger bevestigt zijn rit, of meldt dat er iets niet klopt. De
     handler (kern/mobiliteit/ontvangst.js) houdt de eerste tijd en zegt bij een
     tweede gelijke tik zelf `gewijzigd: false`; een herhaald oud antwoord zou
     daar `gewijzigd: true` van maken. */
  'POST /api/mob/ontvangst': { nietIdempotent: true, waarom: STAND },
  'POST /api/mob/ontvangst/probleem': { nietIdempotent: true, waarom: STAND }
};
module.exports = { SLEUTELS };
