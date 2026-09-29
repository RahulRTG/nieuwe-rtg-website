/* De Foundation-routes die in productie DICHT blijven, ook met een geslaagd
   extern vrijgavedossier. Een juridisch/DPIA-dossier maakt een verouderde
   bezitssleutel niet technisch veilig; deze routes blijven dicht totdat hun
   eigen credentialregister op `migrated` staat. De beperkende uitgangen uit
   ./foundation-veilige-uitgangen.js gaan voor.

   De indeling volgt de DRAGER en niet het pad. Een route staat hier omdat hij
   een niet-gemigreerde credential UITGEEFT of LEEST:

   - het gezinsprofieltoken (rid(24), raw bewaard, lineair vergeleken). De
     consumers zijn gevonden via hun helpers en niet via een zoekwoord:
     rtf.verifieerProfiel (foundation/sollicitaties.js) en alles wat erop
     leunt (rtfSociaal, gezinsPoort, huisPoort, rtfPoort, rtfSpeler, profiel()),
     plus sessieVan/familieVan/beheerderVan onder /api/foundation. Uitgifte:
     /api/rtf/uitnodiging/accepteer maakt een profiel met een raw token, en
     /api/rtf/kanaal geeft dat token raw terug. CODECREDENTIALS.json,
     foundation.family_profile_access en
     foundation.family_profile_token_buiten_harde_poort.
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
  '/api/les',
  /* gezinsprofieltoken onder /api/foundation (sessieVan/familieVan) */
  '/api/foundation/markt',
  '/api/foundation/mail',
  /* gezinsprofieltoken onder /api/rtf */
  '/api/rtf/apply',
  '/api/rtf/baby',
  '/api/rtf/beroepen',
  '/api/rtf/bieb',
  '/api/rtf/connect',
  '/api/rtf/geloof',
  '/api/rtf/kantoorpakket',
  '/api/rtf/labfonds',
  '/api/rtf/leerling',
  '/api/rtf/leren',
  '/api/rtf/leven',
  '/api/rtf/link',
  '/api/rtf/onboarding',
  '/api/rtf/samen',
  '/api/rtf/school',
  '/api/rtf/social',
  '/api/rtf/spel',
  '/api/rtf/talent',
  '/api/rtf/tiener',
  '/api/rtf/welzijn'
]);

const ROUTES = Object.freeze([
  '/api/lab2/bewoner/paspoort',
  '/api/lab2/bewoner/paspoort-maak',
  '/api/member/sport/ticket/koop',
  '/api/member/sport/tickets',
  '/api/sport/scan',
  '/api/foundation/registratie/status',
  '/api/office/foundation/registratie/besluit',
  '/api/rtf/social/stream',
  /* gezinsprofieltoken: consumers */
  '/api/foundation/hulp/ai',
  '/api/foundation/kosten',
  '/api/rtf/toegang',
  '/api/rtf/knelpunt',
  '/api/rtf/rahul',
  '/api/rtf/solliciteer',
  /* gezinsprofieltoken: uitgifte en raw teruggave */
  '/api/rtf/uitnodiging/accepteer',
  '/api/rtf/kanaal'
]);

module.exports = { FAMILIES, ROUTES };
