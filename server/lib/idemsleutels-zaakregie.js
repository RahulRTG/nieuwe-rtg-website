/* ============================================================================
   DE WORKOS-ZAAKREGIEPROJECTIE.

   POST /api/bedrijf/zaakregie gebruikt POST omdat de bestaande WorkOS-client
   een gekozen werkruimte, brondomein en zaak als JSON-context aanlevert. De
   handler schrijft niets: hij controleert het actuele account, het actieve
   WorkOS-lidmaatschap en het eigendom van de bronzaak en bouwt daarna een
   regiebeeld uit bestaande lezers. Een herhaling moet daarom de actuele
   projectie opnieuw lezen en is geen tweede handeling.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  'POST /api/bedrijf/zaakregie': { leest: true },
};

module.exports = { SLEUTELS };
