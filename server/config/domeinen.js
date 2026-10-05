/* De domeinen die een serverproces kan bedienen (RTG_DOMAINS). Een lijst op een
   plek: ../opzet/routes.js monteert ze, ./productie-opslag.js rekent ermee uit
   of een opgesplitst RTG_DOMAINS een tweede schrijver op SQLite maakt
   (RTG-V1-RELEASE C6). Een kopie per lezer zou bij het eerste nieuwe domein
   uiteenlopen, en dan telt de keuring een volledig proces als half. */
'use strict';

const ALLE_DOMEINEN = Object.freeze(['auth', 'member', 'supplier', 'office', 'staff', 'social', 'techniek', 'zakelijk', 'wereld']);

module.exports = { ALLE_DOMEINEN };
