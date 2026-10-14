'use strict';

/* Publieke ingang van de interne Revenue-laag. Alleen lezen: v1 bevat geen
   betaal-, tegoed-, abonnement- of entitlementmutatie. */
module.exports = {
  catalogusV1: require('./catalogus-v1')
};
