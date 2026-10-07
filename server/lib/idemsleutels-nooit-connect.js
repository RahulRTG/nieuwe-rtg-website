/* De Stripe Connect-webhook bij ./idemsleutels-nooit-routes.js
   (server/opzet/connectwebhook.js). Hij ontdubbelt zelf, op de ondertekende
   event-id, en bevestigt pas als de stand en haar boeking duurzaam staan. Een
   antwoordcache ervoor zou een melding die NIET verwerkt kon worden (500, Stripe
   probeert opnieuw) bij de volgende poging als verwerkt kunnen terugspelen. */
'use strict';

module.exports = Object.freeze({
  'POST /api/betaal/webhook/connect':
    'eigen deduplicatie op de ondertekende Stripe-event-id (server/betaal/connect/melding.js `gezien`), duurzaam vastgelegd voor de 200; een antwoordcache zou een onverwerkte melding als verwerkt terugspelen'
});
