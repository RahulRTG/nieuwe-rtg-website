/* Inkomende kaart-/bankbetalingen achter de RTG-betaalnaad. Providerkeuze en
   transport wonen hier; de economische statusovergangen wonen bewust in
   kern/betaalwaarheid. */
'use strict';

module.exports = function ontvangst({ crypto, stripe, mollie, adyen, standaard, get, set, env, uit, simulatie }) {
  const stripeGehost = stripe && require('./stripe-gehost')(stripe);
  /* De simulatiebank (./synthetisch.js) is de vierde rail en gedraagt zich als
     de andere drie: hij is er of hij is er niet, en als hij er niet is zegt hij
     waarom. Zie de kop daar voor de drie grendels. */
  const simAan = !!(simulatie && simulatie.aan());
  const weigerUit = () => {
    if (uit) throw new Error('Betalen staat bewust uitgeschakeld. Er is niets afgeschreven.');
  };
  function mogelijkheden() {
    if (uit) return { standaard: 'uit', rails: [], uit: true,
      uitleg: 'Betalen staat bewust uitgeschakeld; er is geen betaalrail actief.' };
    const rails = [];
    if (stripe) rails.push({ id: 'stripe', label: 'Stripe · kaart, iDEAL of wallet', soort: 'doorsturen', echt: true });
    if (mollie) rails.push({ id: 'mollie', label: 'Mollie · iDEAL of bankbetaling', soort: 'doorsturen', echt: true });
    if (adyen) rails.push({ id: 'adyen', label: 'Adyen · kaart, iDEAL of wallet', soort: 'doorsturen', echt: true });
    /* De simulatiebank staat VOOR de demo in de lijst, en dat is met opzet: een
       testhal die stilzwijgend de altijd-slaagt-demo krijgt, bewijst niets. */
    if (!rails.length && simAan)
      rails.push({ id: 'simulatie', label: 'Simulatiebank · testhal, geen echt geld', soort: 'simulatie', echt: false });
    if (!rails.length && standaard === 'magnaat-test')
      rails.push({ id: 'magnaat-test', label: 'Magnaat Test-betaling', soort: 'test', echt: false });
    if (!rails.length) return { standaard: 'uit', rails: [], uit: true,
      uitleg: 'Geen echte betaalprovider actief; de betaalrail staat fail-closed.' };
    return { standaard, rails };
  }

  function kiesAanbieder(opdracht) {
    weigerUit();
    const gevraagd = String(opdracht && opdracht.aanbieder || '').toLowerCase();
    if (gevraagd) {
      if (gevraagd === 'stripe' && stripe) return 'stripe';
      if (gevraagd === 'mollie' && mollie) return 'mollie';
      if (gevraagd === 'adyen' && adyen) return 'adyen';
      if (gevraagd === 'magnaat-test' && standaard === 'magnaat-test' && !stripe && !mollie && !adyen)
        return 'magnaat-test';
      /* Wie de simulatiebank vraagt terwijl die dichtzit, hoort te horen WELKE
         grendel dichtzit -- niet "niet beschikbaar", want dan zoekt iemand een
         kwartier naar een sleutel die er niet toe doet. */
      if (gevraagd === 'simulatie') {
        if (simAan) return 'simulatie';
        throw new Error(simulatie ? simulatie.belet()
          : 'De simulatiebank is niet gekoppeld. Er is niets afgeschreven.');
      }
      throw new Error('Betaalprovider "' + gevraagd + '" is niet beschikbaar. Er is niets afgeschreven.');
    }
    if (String(opdracht && opdracht.methode || '').toLowerCase() === 'ideal' && mollie) return 'mollie';
    return standaard;
  }

  const mollieBedrag = (centen, valuta) => ({ currency: String(valuta || 'eur').toUpperCase(),
    value: (Math.round(centen) / 100).toFixed(2) });

  async function maakBetaling(opdracht) {
    weigerUit();
    const { bedrag, valuta = 'eur', referentie, idempotentieSleutel, omschrijving,
      returnUrl, webhookUrl, methode, bestemming } = opdracht || {};
    if (!Number.isFinite(bedrag) || bedrag <= 0) throw new Error('Bedrag moet een positief bedrag in centen zijn.');
    const sleutel = idempotentieSleutel || (referentie ? 'ref:' + referentie : crypto.randomUUID());
    const bestaand = get(sleutel);
    if (bestaand) return Object.assign({}, bestaand, { herhaald: true });

    const rail = kiesAanbieder(opdracht);
    let res;
    if (rail === 'stripe' && String(methode || '').toLowerCase() === 'hosted') {
      res = await stripeGehost.maak({ bedrag, valuta, referentie, omschrijving,
        returnUrl, bestemming, sleutel });
    } else if (rail === 'stripe') {
      const parameters = { amount: Math.round(bedrag), currency: valuta, description: omschrijving,
        metadata: { referentie: referentie || '' } };
      if (bestemming) parameters.transfer_data = { destination: bestemming };
      const p = await stripe.paymentIntents.create(parameters, { idempotencyKey: sleutel });
      res = { id: p.id, status: p.status, clientSecret: p.client_secret, aanbieder: 'stripe',
        bedrag: Math.round(bedrag), valuta, referentie };
    } else if (rail === 'mollie') {
      if (!returnUrl || !webhookUrl)
        throw new Error('Mollie heeft een vaste terugkeer- en webhook-URL nodig. Er is niets afgeschreven.');
      const parameters = { amount: mollieBedrag(bedrag, valuta),
        description: String(omschrijving || referentie || 'RTG-betaling').slice(0, 255),
        redirectUrl: String(returnUrl), webhookUrl: String(webhookUrl),
        metadata: { referentie: referentie || '' } };
      if (methode && methode !== 'online') parameters.method = methode;
      if (env.MOLLIE_PROFILE_ID) parameters.profileId = env.MOLLIE_PROFILE_ID;
      const p = await mollie.payments.create(parameters, { idempotencyKey: sleutel });
      res = { id: p.id, status: p.status,
        checkoutUrl: p._links && p._links.checkout && p._links.checkout.href,
        aanbieder: 'mollie', bedrag: Math.round(bedrag), valuta, referentie };
    } else if (rail === 'adyen') {
      if (!returnUrl) throw new Error('Adyen heeft een vaste terugkeer-URL nodig. Er is niets afgeschreven.');
      if (!adyen.merchantAccount) throw new Error('Adyen mist het merchant account. Er is niets afgeschreven.');
      const parameters = { amount: { value: Math.round(bedrag), currency: String(valuta).toUpperCase() },
        reference: String(referentie || sleutel).slice(0, 80), merchantAccount: adyen.merchantAccount,
        description: String(omschrijving || referentie || 'RTG-betaling').slice(0, 280),
        countryCode: String(env.ADYEN_COUNTRY_CODE || 'NL').toUpperCase(),
        shopperLocale: String(env.ADYEN_SHOPPER_LOCALE || 'nl-NL'),
        returnUrl: String(returnUrl), reusable: false };
      if (env.ADYEN_ALLOWED_METHODS) parameters.allowedPaymentMethods = String(env.ADYEN_ALLOWED_METHODS)
        .split(',').map(x => x.trim()).filter(Boolean).slice(0, 20);
      if (env.ADYEN_THEME_ID) parameters.themeId = String(env.ADYEN_THEME_ID);
      const p = await adyen.paymentLinks.create(parameters, { idempotencyKey: sleutel });
      res = { id: p.id, status: p.status, checkoutUrl: p.url, aanbieder: 'adyen',
        betaalId: p.pspReference || null, bedrag: Math.round(bedrag), valuta, referentie };
    } else if (rail === 'simulatie') {
      res = simulatie.maak({ bedrag, valuta, referentie, idempotentieSleutel: sleutel,
        simulatie: opdracht && opdracht.simulatie });
    } else if (rail === 'magnaat-test') {
      res = { id: 'magnaat_' + crypto.randomBytes(8).toString('hex'), status: 'betaald',
        aanbieder: 'magnaat-test', bedrag: Math.round(bedrag), valuta, referentie };
    } else {
      const e = new Error('Geen betaalprovider actief. Koppel een echte provider; oefenen kan uitsluitend in Magnaat Test.');
      e.code = 'BETAALRAIL_UIT';
      throw e;
    }
    set(sleutel, res);
    return res;
  }

  /* Opzoeken en terugbetalen wonen in ./naslag.js -- dit bestand gaat over een
     betaling STARTEN. Zie de kop daar voor waarom die snede daar ligt. */
  const { haalBetaling, maakTerugbetaling } = require('./naslag')({
    crypto, stripe, mollie, adyen, stripeGehost, weigerUit, mollieBedrag });

  return { mogelijkheden, kiesAanbieder, maakBetaling, haalBetaling, maakTerugbetaling };
};
