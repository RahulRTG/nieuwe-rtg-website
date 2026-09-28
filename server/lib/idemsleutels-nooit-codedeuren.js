/* DE VIER CODEDEUREN VAN 27 SEPTEMBER 2026 bij ./idemsleutels-nooit-routes.js:
   de concernuitnodiging, de kantooruitnodiging, de terugvalcode van de
   supportbevestiging en de toegangscode van een Magnaat-teamkamer
   (RELEASEKANDIDAAT.md B9, CODECREDENTIALS.json). Elk antwoord hier draagt een
   kaal geheim dat maar een keer bestaat, of beslist in een collectietransactie
   over de actuele stand ervan; een generieke antwoordcache mag daar niets van
   herhalen. Eigen bestand, zodat parallelle migraties elkaars lijst niet raken. */
'use strict';

const CLAIM = 'de claim beslist in een collectietransactie op de verse stand; een tweede keer is een ' +
  'toestandscontrole (op, ingetrokken of verlopen) en geen gecachet antwoord';

module.exports = Object.freeze({
  'POST /api/concern/uitnodigen':
    'de uitnodiging toont haar 128-bit code eenmaal (kern/concern/uitnodiging-toegang.js); een tweede oproep is een tweede uitnodiging en een antwoordcache zou een code heronthullen',
  'POST /api/concern/bulk/verstuur':
    'elk antwoord draagt de kale codes van nieuwe uitnodigingen precies een keer; een afgespeeld antwoord zou ze heronthullen',
  'POST /api/concern/uitnodiging/roteer':
    'roteren geeft een nieuwe code en trekt de vorige in; een herhaald antwoord zou een ingetrokken code tonen',
  'POST /api/concern/uitnodiging/accepteer': CLAIM + ', en het dienstverband landt in dezelfde commit',
  'POST /api/concern/uitnodiging/intrek':
    'intrekken leest de verse stand in de transactie; een geaccepteerde uitnodiging geeft 409 en dat antwoord mag geen cache overschrijven',
  'POST /api/office/kantoor/uitnodiging/intrek':
    'intrekken leest de actuele stand in kern/kantoor/uitnodiging.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
  'POST /api/office/service/bevestiging/code': CLAIM + '; een foute poging telt mee in de rem, en een afgespeeld antwoord zou die rem omzeilen',
  'POST /api/service/bevestiging/toon':
    'elke oproep maakt een nieuwe terugvalcode en maakt de vorige ongeldig (kern/service/bevestiging-code.js); een herhaald antwoord zou een dode code tonen en de uitgifteteller omzeilen',
  'POST /api/supplier/service/bevestiging/toon':
    'zelfde reden als de ledenkant: opvragen is roteren, en de teller van drie uitgiften zit in de kern',
  'POST /api/service/bevestig': CLAIM + ', en een geweigerde machtiging geeft de claim terug',
  'POST /api/supplier/service/bevestig': CLAIM + ', en een geweigerde machtiging geeft de claim terug',
  'POST /api/service/weiger': CLAIM,
  'POST /api/supplier/service/weiger': CLAIM,
  'POST /api/member/magnaat/teamkamer/maak':
    'maken toont de 128-bit toegangscode eenmaal aan de host; een tweede oproep is een tweede kamer en een antwoordcache zou de code heronthullen',
  'POST /api/member/magnaat/teamkamer/deelnemen': CLAIM + '; wie al deelnam krijgt `herhaald` zonder dat de code nog eens telt',
  'POST /api/member/magnaat/teamkamer/code':
    'roteren geeft de host een nieuwe code en trekt de vorige in; een herhaald antwoord zou een ingetrokken code tonen',
  'POST /api/member/magnaat/teamkamer/code/intrek':
    'intrekken leest de actuele kamerstand; een tweede keer is een toestandscontrole, geen gecachet antwoord'
});
