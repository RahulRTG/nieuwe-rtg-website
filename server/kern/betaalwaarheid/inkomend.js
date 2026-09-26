/* De afhandelaars van de betaalwaarheid voor facturen en directe betalingen
   (MONEY-012, de inkomende kant).

   Facturen (routes/member/betalen.js) en directe betalingen aan een partner
   (kern/directpay/betalen.js) riepen elk een kale betaal.maakBetaling aan en
   parkeerden een wachtende betaling in kaartWachtend. Daar was geen veegronde,
   boven de 20.000 rijen werd de oudste stil gewist, en een verloren antwoord
   liet niets achter. Nu legt de betaalwaarheid de betaling vast VOOR de aanroep
   en loopt de afwikkeling hier.

   ER KOMT GEEN TWEEDE AFWIKKELING BIJ. Beide gaan door kern/settlement.js, die
   de factuur al per betaal-id ontdubbelt (betaalBewijzen) en de directe
   betaling via de idem-sleutel van directpay. Het betaal-id is hier het id van
   de betaalwaarheid: dat is stabiel, ook als de provider zijn eigen referentie
   pas later noemt. Faalt de afwikkeling, dan gooit hij, zodat de betaalwaarheid
   het opnieuw aanbiedt (./afhandeling.js) in plaats van "afgehandeld" te zeggen. */
'use strict';

module.exports = function hangInkomend({ betaalWaarheid, settleFactuur }) {
  if (!betaalWaarheid || typeof settleFactuur !== 'function') return;

  async function wikkelAf(ctx, betaling) {
    const uit = await settleFactuur(ctx, betaling);
    if (!uit || uit.ok !== true) throw new Error((uit && uit.error) || 'De betaling kon niet worden afgewikkeld.');
  }

  betaalWaarheid.registreerAfhandeling('factuur', (w) => wikkelAf(
    Object.assign({ soort: 'factuur' }, w.context || {}),
    { id: w.id, centen: w.centen, hoe: 'Zojuist betaald' }));

  betaalWaarheid.registreerAfhandeling('direct', (w) => {
    const c = w.context || {};
    return wikkelAf(Object.assign({ soort: 'direct', betaalwijze: 'kaart' }, c,
      { centen: w.centen, idem: c.idem || ('waarheid:' + w.id) }), { id: w.id, centen: w.centen });
  });
};
