/* De Live Circle van Reizen & Veilig (kern/veiligheid/moment.js, scherm
   /apps/reizen-veilig.html; 11 oktober 2026).

   `moment/maak` stond in geen enkele verklaring, en de voltooiproef vond wat dat
   kostte: een dubbeltik op "Moment starten" maakte TWEE Live Circles, en de
   zaak die als ontvanger was gekozen zag de aankomst twee keer
   (VOLTOOIPROEF.json, link:reizen, herstelbaar schakel 2).

   `zelfdeVerzoek` en geen `nietIdempotent`. De route krijgt geen id uit het
   verzoek, en de regel van ./idemsleutels-bescherming.js ("een route die iets
   AANMAAKT zonder identiteit uit het verzoek mag nooit zelfdeVerzoek dragen")
   gaat daar over een GEDEELDE kantoorcode: twee medewerkers die twee mensen
   aanmelden. Hier is de afzender een lid met een eigen sessie (wieVan() in
   ./idem-sleutelbepaling.js), en het lijf draagt titel, bestemming, duur en de
   ontvangers. Woordelijk dezelfde Live Circle naar dezelfde ontvangers binnen
   vijf seconden is een dubbeltik en geen tweede reis. De prijs, uitgeschreven:
   wie bewust binnen vijf seconden twee identieke cirkels start, krijgt er een --
   en een tweede is met een ander woord of een andere ontvanger zo gemaakt.

   De andere vier moment-routes staan hier met opzet NIET: pauze, status en stop
   dragen een id en vinden de stand al zo (een toestandscontrole, gemeten in de
   voltooiproef), en de lijst leest. */
'use strict';
const SLEUTELS = {
  'POST /api/veiligheid/moment/maak': { zelfdeVerzoek: true }
};
module.exports = { SLEUTELS };
