/* DE CORRELATIE VAN EEN VERZOEK MAAKT DE SERVER, ALTIJD (Fase 2, besluit B1a).

   Hier stond `req.headers['x-request-id'] || randomBytes(8)`: de aanroeper koos
   het id, in elke lengte (4000 tekens kwamen gewoon terug). Dat id is geen
   versiering. De effectbon (server/effectbon.js) en de geldketen
   (kern/kantoor/geldketen.js, `uitvoerVerzoek`) KOPPELEN erop: een proxy die bij
   een herhaling hetzelfde id meestuurt gaf twee uitvoeringen dezelfde sleutel,
   en `voorspellingVan` pakte dan het dossier van de eerste.

   Een X-Request-Id van de client blijft bruikbaar, maar als `extern`: alleen de
   tekens [A-Za-z0-9._-], hooguit 64 lang, en alleen om een logregel aan een
   klacht of een proxylog te koppelen. Nooit als sleutel, en nooit terug in het
   antwoord als X-Request-Id -- daar staat de correlatie van de server.

   Een kop met een teken buiten de set wordt NIET schoongepoetst tot iets anders:
   een id dat we zelf herschreven, koppelt aan niets en lijkt wel op iets. Dan is
   `extern` gewoon null. Te lang wordt afgekapt: het begin koppelt nog. */
'use strict';
const crypto = require('crypto');

const MAX_EXTERN = 64;
const TEKENS = /^[A-Za-z0-9._-]+$/;

function nieuw() { return crypto.randomBytes(8).toString('hex'); }

function extern(kop) {
  if (typeof kop !== 'string' || !TEKENS.test(kop)) return null;
  return kop.slice(0, MAX_EXTERN);
}

module.exports = { nieuw, extern, MAX_EXTERN };
