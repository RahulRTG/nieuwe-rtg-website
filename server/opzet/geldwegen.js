/* ============================================================================
   WELKE WEGEN GAAN OM DE DUBBELTIK HEEN -- een beleidsregel, geen bedrading.

   Dit stond in poortwachters.js, tussen het monteren van middleware. Het hoort
   daar niet: WELKE routes een sterkere laag hebben is een besluit met een
   verhaal, en dat verhaal groeit. Hier staat het bij elkaar en is het los te
   lezen; poortwachters.js zegt alleen nog dat hij het toepast.

   DE GELDWEGEN GAAN OM DE DUBBELTIK HEEN, en dat is geen uitzondering maar de
   regel "waar een sterkere laag staat, hoort deze niet ervoor". server/lib/idem.js
   doet idempotentie voor geld DUURZAAM (de sleutel landt in dezelfde commit als
   de boeking, dus hij overleeft een herstart) en met een afdruk van de
   geld-bepalende velden. Sommige van die routes geven op een herhaling ook een
   EIGEN antwoord: /api/pakket/koop zegt `alBetaald: true` in plaats van de
   eerste bon nog eens.

   Zet je de dubbeltik daarvoor, dan vervangt een geheugenlaag dat antwoord door
   een kopie van de eerste -- zonder er veiligheid aan toe te voegen, want die
   zat er al. Precies dat gebeurde: test/synergie.test.js zag `alBetaald`
   verdwijnen. De volle suite is hier de bewaker: raakt er een geldpad los van
   deze lijst, dan verandert zijn antwoord en vallen de geldtoetsen om.

   TWEE WEGEN ONDER /api/pay VERPLAATSEN GEEN GELD, en die horen er dus wel
   langs. `kascode` en `tikcode` MAKEN een code van vijf minuten; ze boeken
   niets. De staatproef betrapte ze: een herhaling met dezelfde sleutel legde een
   tweede rij in `payCodes` en verdrong de code die de gast op zijn scherm had
   staan -- precies wat er misgaat als een load balancer één keer opnieuw
   probeert. Voor een token dat vijf minuten leeft in hetzelfde proces is de
   geheugenlaag de juiste maat; de duurzame laag van idem.js is dat voor GELD.

   Dit is met opzet een lijst met NAMEN en geen versoepeling van GELDWEGEN: een
   nieuwe route onder /api/pay blijft standaard overgeslagen, en wie hem hier bij
   zet moet opschrijven waarom er geen geld beweegt.
   ========================================================================== */
'use strict';

const GELDWEGEN = /^\/api\/(pay|bank|pakket|podium|directpay|betaal|munt|supplier\/(kassa|betaalverzoek))\b/;
const GEEN_GELD = new Set(['/api/pay/kascode', '/api/pay/tikcode']);

/* De vraag die poortwachters.js stelt: moet de dubbeltik dit pad overslaan? */
const slaOver = (pad) => GELDWEGEN.test(pad) && !GEEN_GELD.has(pad);

module.exports = { GELDWEGEN, GEEN_GELD, slaOver };
