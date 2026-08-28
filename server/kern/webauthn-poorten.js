/* WebAuthn: twee begrensde poorten op dezelfde implementatie.

   Auth krijgt registratie, login en beheer. RTG PIN krijgt alleen de
   action-bound bevestiging. Beide objecten wijzen naar dezelfde functies,
   challenge-opslag en credentials; dit is grensbedrading, geen tweede laag. */
'use strict';

module.exports = (ctx) => {
  const { regOpties, regMaak, loginOpties, loginMaak, publiekeLijst, weg,
    actieNodig, actieOpties, actieMaak } = ctx;
  return {
    webauthn: {
      registratie: { opties: regOpties, maak: regMaak },
      login: { opties: loginOpties, maak: loginMaak },
      lijst: user => ({ status: 200, sleutels: publiekeLijst(user) }),
      weg
    },
    pinBeveiliging: { nodig: actieNodig, opties: actieOpties, maak: actieMaak }
  };
};
