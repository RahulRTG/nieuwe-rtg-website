/* Betaalnaad (deelmodule): OPZOEKEN en TERUGBETALEN.

   WAAROM DIT EEN EIGEN BESTAND IS. ./ontvangst.js liep over de 10 kB-grens van
   keuringsregel 13 toen de simulatiebank erbij kwam. De snede ligt op een
   familie en niet op een regelnummer: hier staan de twee handelingen die een
   betaling volgen NADAT hij bestaat -- hem opzoeken bij de provider, en hem
   terugbetalen. Wat er in ./ontvangst.js overblijft, gaat over hem STARTEN.

   Dat is dezelfde snede als bij kern/horeca/dienstmeting-tijden.js en
   kern/pay/poort.js: de naad met de minste bedrading eroverheen. */
'use strict';

module.exports = function naslag({ crypto, stripe, mollie, adyen, stripeGehost, weigerUit, mollieBedrag }) {
  /* Wie er betaalde en vanaf welk IBAN: ./betaler.js. Daar staat ook waarom
     alleen Mollie dat geeft, en -- belangrijker -- wat je er NIET mee mag doen:
     een bevestiging zet nooit een uitbetaalbestemming, hij bevestigt er alleen
     een die het lid zelf heeft ingevoerd. */
  const { betalerVan } = require('./betaler');

  async function haalBetaling(aanbieder, id) {
    weigerUit();
    if (aanbieder === 'mollie' && mollie) {
      const p = await mollie.payments.retrieve(id);
      return { id: p.id, status: p.status, aanbieder: 'mollie',
        referentie: p.metadata && p.metadata.referentie,
        bedrag: p.amount && Math.round(Number(p.amount.value) * 100),
        valuta: p.amount && String(p.amount.currency || '').toLowerCase(),
        checkoutUrl: p._links && p._links.checkout && p._links.checkout.href,
        ...betalerVan(p.details) };
    }
    if (aanbieder === 'stripe' && stripe) {
      const isSessie = String(id).startsWith('cs_');
      if (isSessie) return stripeGehost.haal(id);
      const p = await stripe.paymentIntents.retrieve(id);
      return { id: p.id, status: p.status, aanbieder: 'stripe',
        referentie: p.metadata && p.metadata.referentie,
        bedrag: Math.round(Number(p.amount_received != null ? p.amount_received : p.amount) || 0),
        valuta: p.currency, clientSecret: p.client_secret };
    }
    if (aanbieder === 'adyen' && adyen) {
      const p = await adyen.paymentLinks.retrieve(id);
      return { id: p.id, status: p.status, aanbieder: 'adyen', referentie: p.reference,
        bedrag: p.amount && Math.round(Number(p.amount.value)),
        valuta: p.amount && String(p.amount.currency || '').toLowerCase(),
        checkoutUrl: p.url, betaalId: p.pspReference || null };
    }
    throw new Error('Deze betaalprovider is niet beschikbaar.');
  }

  async function maakTerugbetaling(opdracht) {
    weigerUit();
    const { aanbieder, providerId, bedrag, valuta = 'eur', idempotentieSleutel } = opdracht || {};
    if (!providerId) throw new Error('Een terugbetaling heeft een providerbetaling nodig.');
    if (!Number.isFinite(bedrag) || bedrag <= 0) throw new Error('Terugbetaalbedrag moet positief zijn.');
    if (aanbieder === 'mollie' && mollie) {
      const r = await mollie.refunds.create(providerId, { amount: mollieBedrag(bedrag, valuta),
        description: String(opdracht.omschrijving || 'RTG-terugbetaling').slice(0, 255) },
      { idempotencyKey: idempotentieSleutel });
      return { id: r.id, status: r.status, aanbieder: 'mollie', providerId, bedrag: Math.round(bedrag), valuta };
    }
    if (aanbieder === 'stripe' && stripe) {
      const r = await stripe.refunds.create({ payment_intent: providerId, amount: Math.round(bedrag),
        metadata: { referentie: opdracht.referentie || '' } }, { idempotencyKey: idempotentieSleutel });
      return { id: r.id, status: r.status, aanbieder: 'stripe', providerId, bedrag: Math.round(bedrag), valuta };
    }
    if (aanbieder === 'adyen' && adyen) {
      const r = await adyen.refunds.create(providerId, { amount: { value: Math.round(bedrag),
        currency: String(valuta).toUpperCase() }, merchantAccount: adyen.merchantAccount,
        reference: String(opdracht.referentie || idempotentieSleutel || '').slice(0, 80) },
      { idempotencyKey: idempotentieSleutel });
      return { id: r.pspReference || r.id, status: r.status || 'received',
        aanbieder: 'adyen', providerId, bedrag: Math.round(bedrag), valuta };
    }
    if (aanbieder === 'magnaat-test' && !stripe && !mollie && !adyen)
      return { id: 'magnaat_ref_' + crypto.randomBytes(8).toString('hex'), status: 'refunded',
        aanbieder: 'magnaat-test', providerId, bedrag: Math.round(bedrag), valuta };
    throw new Error('Deze betaalprovider is niet beschikbaar voor terugbetalen.');
  }


  return { haalBetaling, maakTerugbetaling };
};
