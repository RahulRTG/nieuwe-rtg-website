/* ============================================================================
   IDEMSLEUTELS -- een lid en zijn eigen lidmaatschap (twee lezers).

   Deel van ./idemsleutels.js; zie de kop daar voor wat `leest`, `zelfdeVerzoek`
   en `nietIdempotent` betekenen.

   TWEE VAN DE DRIE ROUTES STAAN HIER, EN DE DERDE MET OPZET NIET.

     POST /api/mijn/abonnement                  leest    -- hier
     POST /api/mijn/abonnement/opzegvoorbeeld   leest    -- hier
     POST /api/mijn/abonnement/opzeggen         NOOIT    -- ./idemsleutels-nooit-routes.js

   Beide lezers veranderen niets. Dat is niet aangenomen maar gemeten en
   vastgelegd: server/lib/mutatiecontracten-lidabonnement.js draagt voor elk de
   gemeten ronde (twee oproepen, identieke uitslag, geen spoor in de opslag), en
   test/lidabonnement.test.js toets 10 telt de `save()`-aanroepen en eist nul.

   DAT LAATSTE BESTAAT OM EEN REDEN. Het opzegVOORBEELD rekende zijn einddatum
   eerst uit met een `zegOp` op een wegwerpkopie van het contract. Geen rij
   veranderde, dus een opslagmeter zag niets -- maar `zet()` in
   kern/commercie/contract.js roept `save()` aan, dus deze "lezer" schreef de
   hele database naar schijf. Een `leest: true` was op dat moment een leugen
   geweest. Sinds `contracten.opzegEinde()` is hij er een. */
'use strict';

const SLEUTELS = {
  'POST /api/mijn/abonnement': { leest: true },
  'POST /api/mijn/abonnement/opzegvoorbeeld': { leest: true }
};

module.exports = { SLEUTELS };
