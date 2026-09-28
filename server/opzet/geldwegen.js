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

   TWEE WEGEN ONDER /api/pay VERPLAATSEN GEEN GELD: `kascode` en `tikcode`
   maken een code. Ze stonden hier tot 27 september 2026 met naam, zodat de
   dubbeltik een retry dezelfde code teruggaf. Dat was precies het probleem: een
   geheugencache die een kale betaalcode bewaart en herhaalt. Ze staan nu in
   lib/eenmalig-geheim-routes.js (buiten elke retrycache), en de bak zelf
   (kern/pay/kasbak.js) weigert dezelfde sleutel met 409 zonder code en zonder
   de vorige in te trekken. De lijst hieronder is daardoor leeg.

   Dit is met opzet een lijst met NAMEN en geen versoepeling van GELDWEGEN: een
   nieuwe route onder /api/pay blijft standaard overgeslagen, en wie hem hier bij
   zet moet opschrijven waarom er geen geld beweegt.
   ========================================================================== */
'use strict';

const GELDWEGEN = /^\/api\/(pay|bank|pakket|podium|directpay|betaal|munt|supplier\/(kassa|betaalverzoek|giftcard))\b/;
const GEEN_GELD = new Set();
const { ROUTES: EENMALIGE_ROUTES } = require('../lib/eenmalig-geheim-routes');
const EENMALIGE_PADEN = new Set([...EENMALIGE_ROUTES].map(x => x.split(' ')[1]));

/* De vraag die poortwachters.js stelt: moet de dubbeltik dit pad overslaan? */
const slaOver = (pad) => EENMALIGE_PADEN.has(String(pad || '').replace(/\/$/, '')) ||
  (GELDWEGEN.test(pad) && !GEEN_GELD.has(pad));

module.exports = { GELDWEGEN, GEEN_GELD, EENMALIGE_PADEN, slaOver };
