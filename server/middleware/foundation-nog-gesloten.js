/* De Foundation-routes die in productie DICHT blijven, ook met een geslaagd
   extern vrijgavedossier. Een juridisch/DPIA-dossier maakt een verouderde
   bezitssleutel niet technisch veilig; deze routes blijven dicht totdat hun
   eigen credentialregister op `migrated` staat. De beperkende uitgangen uit
   ./foundation-veilige-uitgangen.js gaan voor.

   De indeling volgt de DRAGER en niet het pad. Een route staat hier omdat hij
   een niet-gemigreerde credential UITGEEFT of LEEST:

   - de overige oude dragers (lab2, lesmaker, schoolpas, stadionticket,
     registratiebesluit), zoals ze er al stonden.

   De GEZINSDEUR staat hier sinds 4 oktober 2026 niet meer (B18,
   CODECREDENTIALS.json foundation.family_profile_access, migrated): de
   gezinscode is een 128-bit code die alleen als hash bestaat
   (foundation/gezinscode.js, met een rem per adres en per gezin), het
   zes-tekenadres opent niets, en /api/rtf/social/stream en het gezinskanaal
   openen met een eenmalig stroomticket in plaats van de sessie in de URL
   (foundation/gezinsstroom.js). Het gezinsPROFIELTOKEN was al gemigreerd (B17,
   foundation/gezinstoken.js; sinds B19 zeven dagen). De beschermde-functiepoort
   in ./foundation-productiepoort.js blijft voor de hele gezinsfamilie gelden:
   zonder extern dossier (B8) zijn ze in productie nog steeds 503.

   De lescredential onder /api/foundation (les, bord, schrift, opgave(n),
   agenda en /ai) staat hier NIET meer: sinds 29 september 2026 (B17) is hij
   gemigreerd (foundation/onderwijs/toegang.js: 128 bits, hash-only, verval,
   intrekken, atomaire claim; CODECREDENTIALS.json, foundation.onderwijs_les_tokens).
   Hij valt nu alleen nog onder de gewone vrijgave van ./foundation-productiepoort.js.

   Buiten productie verandert hier niets: de poort staat daar expliciet open,
   dus /api/rtf/knelpunt (MAATSTAF.md par. 7i) werkt lokaal en in de toetsen
   precies zoals hij deed. */
'use strict';

const FAMILIES = Object.freeze([
  '/api/foundation/school',
  '/api/lab2/mijn',
  '/api/les'
]);

const ROUTES = Object.freeze([
  '/api/lab2/bewoner/paspoort',
  '/api/lab2/bewoner/paspoort-maak',
  '/api/member/sport/ticket/koop',
  '/api/member/sport/tickets',
  '/api/sport/scan',
  '/api/foundation/registratie/status',
  '/api/office/foundation/registratie/besluit'
]);

module.exports = { FAMILIES, ROUTES };
