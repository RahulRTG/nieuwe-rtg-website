/* De Loop Fabric-routes hebben een eigen domein-idempotentie op operationId en
   payloadhash. Deze verklaring sluit daarnaast de bestaande vijfsecondenpoort
   aan: een woordelijk gelijke transport-retry is dezelfde overdracht en nooit
   een tweede observatie, recall-dispositie, bronwijziging of bewijslezing.

   Ook inbox en proof staan als `zelfdeVerzoek`: zij lezen bronwaarheid maar
   mogen tijdens die lezing een duurzaam outbox-checkpoint vooruitzetten. Ze
   zijn daarom niet zuiver `leest`; dezelfde retry mag wel hetzelfde antwoord
   krijgen en de checkpointmutatie is zelf replay-safe. */
'use strict';

const SLEUTELS = {
  'POST /api/loop/observation/inbox': { zelfdeVerzoek: true },
  'POST /api/loop/recall/present': { zelfdeVerzoek: true },
  'POST /api/loop/recall/disposition': { zelfdeVerzoek: true },
  'POST /api/loop/proof': { zelfdeVerzoek: true },
  'POST /api/bedrijf/loop/procedure/change': { zelfdeVerzoek: true }
};

module.exports = { SLEUTELS };
