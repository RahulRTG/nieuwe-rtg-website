/* RTG World is een projectie van domeinen, geen tweede personen-, voorraad-
   of transactiedatabase. Dit contract noemt ook wat nog NIET aangesloten is. */
'use strict';
const { TYPEN } = require('../mall/aanbodvorm');
const { diepBevries } = require('./contract');
module.exports = diepBevries({
  version: 1,
  primitives: ['person', 'organization', 'place', 'capability', 'resource', 'domainObject'],
  relationships: ['provides', 'locatedAt', 'offers', 'hasContext'],
  offerTypes: Object.entries(TYPEN).map(([id, t]) => ({ id, label: t.label })),
  limits: { needs: 8, alternativesPerNeed: 3, contextObjects: 40 },
  rules: {
    ownsSourceData: false, graphGrantsAuthority: false, humanRanking: false,
    crossUserCache: false, unknownIsAvailable: false, automatedBooking: false,
    sourceRecheckBeforeHandoff: true, sourceRecheckBeforeSave: true,
    paymentAuthority: false, externalMessages: false
  },
  coverage: [
    { source: 'mall', state: 'PROJECTED', owns: 'public offerings and provider references' },
    { source: 'experience', state: 'PROJECTED', owns: 'authorized current-context references' },
    { source: 'mall.lists', state: 'CONNECTED', owns: 'personal saved selections' },
    { source: 'employment', state: 'NOT_CONNECTED', owns: 'employee relationships and delegated authority' },
    { source: 'transactions', state: 'DOMAIN_OWNED', owns: 'payments, reservations and commitments' },
    { source: 'external_inventory', state: 'NOT_CONNECTED', owns: 'live external capacity' }
  ]
});
