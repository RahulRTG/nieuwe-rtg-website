/* De weerbaarheidsronde van 9 september 2026: de tweede handtekening onder twee
   bankknoppen (kern/kantoor/tweedehandtekening.js) en de schaduwteller van de
   herkomstpoort (kern/stuur/schaduwtelling.js).

   BEVESTIG EN INTREK ZIJN NIET IDEMPOTENT, en dat is hier geen tekortkoming
   maar de kern van de ceremonie: een handtekening wordt OPGEBRUIKT, ook wanneer
   de uitvoering erna faalt. Een tweede oproep hoort dus de echte stand te
   krijgen ("er staat geen aanvraag met dit kenmerk open") en niet een bewaard
   `ok`. Zou de poort dat oude antwoord teruggeven, dan meldt het scherm een
   uitvoering die niet heeft plaatsgevonden -- precies de fout die de kop van
   ./idem-poort.js beschrijft bij /api/wbw/verreken. Alleen de ceremonie zelf kan
   een trage retry van een tweede poging onderscheiden; zelfde vorm en zelfde
   reden als /api/supplier/salon/deal/redeem in ./idemsleutels-salon.js.

   OPEN LEEST. Hij geeft de openstaande aanvragen terug en ruimt daarbij de
   VERLOPEN aanvragen op -- dat is een verlooptijd die zichtbaar wordt en geen
   tweede handeling, dus herhalen is veilig en er valt niets te dedupliceren.
   Een cache zou hier bovendien actief schade doen: het scherm leest deze lijst
   opnieuw meteen NA een bevestiging, en een bewaard antwoord van vijf seconden
   oud toont dan een aanvraag die zojuist is opgebruikt.

   HERKOMSTSCHADUW LEEST ECHT: hij telt op wat de herkomstpoort zou hebben
   geweigerd en verandert niets. */
'use strict';
const SLEUTELS = {
  'POST /api/office/bank/handtekening/open': { leest: true },
  'POST /api/office/bank/handtekening/bevestig': { nietIdempotent: true,
    waarom: 'de handtekening wordt eenmalig opgebruikt; een bewaard antwoord zou een uitvoering melden die niet plaatsvond' },
  'POST /api/office/bank/handtekening/intrek': { nietIdempotent: true,
    waarom: 'intrekken haalt de aanvraag weg; een tweede oproep hoort te horen dat er niets meer openstaat' },
  'POST /api/office/stuur/herkomstschaduw': { leest: true }
};
module.exports = { SLEUTELS };
