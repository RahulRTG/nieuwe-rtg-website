/* WebAuthn: drie begrensde poorten op dezelfde implementatie.

   Auth krijgt registratie, login en beheer. RTG PIN krijgt alleen de
   action-bound bevestiging voor zijn drie handelingen. De zware poort krijgt
   dezelfde bevestiging voor de handelingen die een gestolen open sessie nooit
   zelfstandig mag doen. Alle drie wijzen ze naar dezelfde functies,
   challenge-opslag en credentials; dit is grensbedrading, geen tweede laag.

   DE POORTEN VERSCHILLEN ALLEEN IN HUN WOORDENLIJST, en dat is met opzet de
   enige scheiding: welke namen ze accepteren staat in ./webauthn-acties.js, en
   die twee lijsten hebben geen enkel woord gemeen. Een ceremonie die voor
   `rtg-pin-vernieuw` is uitgegeven kan daardoor niet worden ingewisseld voor
   `eigenaar-overdracht` -- de zware poort kent die naam niet en keurt hem af
   voordat er iets geverifieerd wordt. Zou er ooit een naam in beide lijsten
   komen te staan, dan valt die grens weg zonder dat er iets zichtbaar breekt;
   test/eigenaarbevestiging.test.js meet daarom of de lijsten disjunct blijven. */
'use strict';

module.exports = (ctx) => {
  const { regOpties, regMaak, loginOpties, loginMaak, publiekeLijst, weg,
    actieNodig, actieOpties, actieMaak,
    zwaarNodig, zwaarOpties, zwaarMaak } = ctx;
  return {
    webauthn: {
      registratie: { opties: regOpties, maak: regMaak },
      login: { opties: loginOpties, maak: loginMaak },
      lijst: user => ({ status: 200, sleutels: publiekeLijst(user) }),
      weg
    },
    pinBeveiliging: { nodig: actieNodig, opties: actieOpties, maak: actieMaak },
    zwaarBeveiliging: { nodig: zwaarNodig, opties: zwaarOpties, maak: zwaarMaak }
  };
};
