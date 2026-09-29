/* Het SSO-clientgeheim bij ./idemsleutels-nooit-routes.js (besluit B16,
   CODECREDENTIALS.json identity.sso_client_secret). Elk van deze verzoeken
   draagt een geheim of beslist over de overlap; de kern beslist op de verse
   stand of een herhaling iets verandert (hetzelfde geheim nog eens = ongewijzigd,
   de overlap al dicht = 409). Een antwoordcache zou een rotatie als gelukt
   herhalen zonder te kijken, of een verzoek met een geheim erin onthouden. */
'use strict';

module.exports = Object.freeze({
  'POST /api/techniek/sso':
    'het lijf kan een clientgeheim dragen en zetten is dan roteren met overlap; de kern herkent hetzelfde geheim zelf (ongewijzigd) en een cache mag geen verzoek met een geheim onthouden',
  'POST /api/techniek/sso/geheim':
    'roteren leest de verse stand: hetzelfde geheim opnieuw geeft ongewijzigd zonder overlap met zichzelf, een ander geheim is een nieuwe rotatie; een gecachet antwoord zou een rotatie melden die niet gebeurde',
  'POST /api/techniek/sso/geheim/overlap/sluit':
    'sluiten leest de verse stand; een tweede keer is een toestandscontrole (409, er loopt geen overlap) en geen gecachet ok'
});
