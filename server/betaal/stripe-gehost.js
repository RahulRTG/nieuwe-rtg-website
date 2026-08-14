/* Stripe Checkout als kleine adapter. De gewone PaymentIntent-rail blijft
   beschikbaar voor bestaande RTG-domeinen; het klantenscherm gebruikt deze
   gehoste variant zodat kaartgegevens nooit door RTG gaan. */
'use strict';

module.exports = function stripeGehost(stripe) {
  function betaalId(p) {
    return p && p.payment_intent && (typeof p.payment_intent === 'string'
      ? p.payment_intent : p.payment_intent.id) || null;
  }
  function status(p) {
    if (p && p.payment_status === 'paid') return 'succeeded';
    if (p && p.status === 'expired') return 'canceled';
    if (p && p.status === 'complete') return 'processing';
    return 'requires_action';
  }
  async function maak(o) {
    if (!o.returnUrl) throw new Error('Stripe Checkout heeft een vaste terugkeer-URL nodig. Er is niets afgeschreven.');
    const parameters = { mode: 'payment', success_url: String(o.returnUrl), cancel_url: String(o.returnUrl),
      client_reference_id: String(o.referentie || ''), metadata: { referentie: o.referentie || '' },
      payment_intent_data: { metadata: { referentie: o.referentie || '' } },
      line_items: [{ quantity: 1, price_data: { currency: String(o.valuta).toLowerCase(),
        unit_amount: Math.round(o.bedrag), product_data: {
          name: String(o.omschrijving || o.referentie || 'RTG-betaling').slice(0, 120) } } }] };
    if (o.bestemming) parameters.payment_intent_data.transfer_data = { destination: o.bestemming };
    const p = await stripe.checkout.sessions.create(parameters, { idempotencyKey: o.sleutel });
    return { id: p.id, status: status(p), checkoutUrl: p.url, betaalId: betaalId(p), aanbieder: 'stripe',
      bedrag: Math.round(o.bedrag), valuta: o.valuta, referentie: o.referentie };
  }
  async function haal(id) {
    const p = await stripe.checkout.sessions.retrieve(id);
    return { id: p.id, status: status(p), aanbieder: 'stripe',
      referentie: p.client_reference_id || (p.metadata && p.metadata.referentie),
      bedrag: Math.round(Number(p.amount_total) || 0), valuta: p.currency,
      checkoutUrl: p.url, betaalId: betaalId(p) };
  }
  return { maak, haal };
};
