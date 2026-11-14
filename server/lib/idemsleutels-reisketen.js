/* De domeinontvangst en economische sleutel zijn duurzaam. De generieke
   antwoordcache mag geen actuele bevoegdheid of versiecontrole overslaan. */
'use strict';
const eigen = { nietIdempotent: true, waarom: 'De keten bewaart zelf actor + actie + idem + inhoud onder een transactioneel slot. Een retry krijgt de actuele toegestane projectie; een oude generieke antwoordcache zou intrekking of een nieuwere reisstand verbergen.' };
const SLEUTELS = {
  'POST /api/reisbureau/keten': { leest: true },
  'POST /api/reisbureau/keten/start': eigen,
  'POST /api/reisbureau/keten/akkoord': eigen,
  'POST /api/reisbureau/keten/betaal': eigen,
  'POST /api/reisbureau/keten/nazorg': eigen,
  'POST /api/office/reisbureau/keten': { leest: true },
  'POST /api/office/reisbureau/keten/offerte': eigen,
  'POST /api/office/reisbureau/keten/afronden': eigen,
  'POST /api/office/reisbureau/keten/nazorg/antwoord': eigen,
  'POST /api/supplier/reisbureau/keten': { leest: true },
  'POST /api/supplier/reisbureau/keten/offerte': eigen,
  'POST /api/supplier/reisbureau/keten/afronden': eigen,
  'POST /api/supplier/reisbureau/keten/nazorg/antwoord': eigen,
  'POST /api/supplier/reisbureau/opdrachten': { leest: true },
  'POST /api/supplier/reisbureau/opdracht/besluit': eigen
};
// Ook de transport- en offlinegrens lezen deze bestaande routecontracten.
// De router accepteert hoofdletters en één afsluitende slash; geen prefix-
// vrijstelling waarmee een nieuwe route onbedoeld dezelfde rechten krijgt.
const isReisketenPad = pad => Object.prototype.hasOwnProperty.call(SLEUTELS,
  'POST ' + String(pad || '').toLowerCase().replace(/\/$/, ''));
module.exports = { SLEUTELS, isReisketenPad };
