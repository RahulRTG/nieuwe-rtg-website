/* WELKE CAPABILITY EEN BETAALOPDRACHT IS (server/kern/vrijgave/).

   De opdrachtenrij (./index.js) kent geen enkele rail en geen enkele betekenis:
   een opdracht is een bedrag, een bestemming en een soort. De vrijgavepoort aan
   de rail (server/betaal/uitbetaling.js) wil weten WAT er naar buiten gaat, want
   een uitbetaling naar een lid, een partner of de RTFoundation zijn financieel
   drie verschillende handelingen en gaan los aan en uit.

   Een GESLOTEN tabel, per soort die een maker in dit huis gebruikt. Een soort die
   hier niet staat, krijgt GEEN capability, en dan weigert de rail hem zodra er
   echt geld zou bewegen -- dat is met opzet: een nieuwe soort uitbetaling hoort
   eerst een plek in het vrijgaveregister te krijgen voordat hij naar buiten kan.

     pay-terug     kern/pay/terug.js      saldo van een lid naar zijn eigen IBAN
     pay-uit       kern/pay/partner.js    het saldo van een partner naar zijn bank

   Wat er NIET in staat en waarom: `sepa-uit` (kern/bank/overboeken.js, de SEPA van
   de RTG Bank) en `economic-settlement` (kern/fonds/uitbetalen.js, de sociale
   afdracht) hebben nog geen regel in het register. Ze staan dus dicht op een
   echte rail, precies zoals daarvoor. */
'use strict';

const CAPABILITY = Object.freeze({
  'pay-terug': 'geld.lid_iban_uitbetaling',
  'pay-uit': 'geld.partnerafrekening'
});

function capabilityVan(soort) {
  return Object.prototype.hasOwnProperty.call(CAPABILITY, String(soort)) ? CAPABILITY[String(soort)] : undefined;
}

module.exports = { CAPABILITY, capabilityVan };
