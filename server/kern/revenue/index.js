'use strict';

/* Publieke ingang van de interne Revenue-laag. Alleen lezen: v1 bevat geen
   betaal-, tegoed-, abonnement- of entitlementmutatie. */
module.exports = {
  catalogusV1: require('./catalogus-v1'),
  entitlementProjectieV1: require('./entitlement-projectie-v1'),
  entitlementOverzichtV1: require('./entitlement-overzicht-v1'),
  entitlementEligibilityV1: require('./entitlement-eligibility-v1')
};
