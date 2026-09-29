/* De Foundation-routes die in productie DICHT blijven, ook met een geslaagd
   extern vrijgavedossier. Een juridisch/DPIA-dossier maakt een verouderde
   bezitssleutel niet technisch veilig; deze routes blijven dicht totdat hun
   eigen credentialregister op `migrated` staat. De beperkende uitgangen uit
   ./foundation-veilige-uitgangen.js gaan voor.

   De indeling volgt de DRAGER en niet het pad. Een route staat hier omdat hij
   een niet-gemigreerde credential UITGEEFT of LEEST:

   - de gezinsdeur zelf (/api/foundation/gezin: de 6-tekens gezinscode plus
     PIN, en /api/rtf/social/stream met code en token in de URL).
     CODECREDENTIALS.json, foundation.family_profile_access. Het
     gezinsPROFIELTOKEN is sinds 29 september 2026 gemigreerd (B17,
     foundation/gezinstoken.js: 128 bits, hash-only, verval, epoch, intrekken);
     zijn consumers onder /api/rtf, /api/foundation/markt, /mail, /kosten en
     /hulp/ai staan hier daarom niet meer
     (foundation.family_profile_token_buiten_harde_poort, migrated). De
     beschermde-functiepoort in ./foundation-productiepoort.js blijft voor hen
     gewoon gelden: zonder extern dossier zijn de meeste nog steeds 503.
   - de overige oude dragers (lab2, lesmaker, schoolpas, stadionticket,
     registratiebesluit), zoals ze er al stonden.

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
  '/api/foundation/gezin',
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
  '/api/office/foundation/registratie/besluit',
  '/api/rtf/social/stream'
]);

module.exports = { FAMILIES, ROUTES };
