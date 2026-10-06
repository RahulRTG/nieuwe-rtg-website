/* Private bridge from a real payment-provider adapter to Trust V3.

   `mark` is deliberately kept inside server/betaal.js and the sub-adapters to
   which it is injected. Public callers can ask for a receipt for an object,
   but cannot mark a fabricated object as provider-verified. The receipt is
   opaque, purpose-bound and consumed once by the matching Trust verifier. */
'use strict';

const { maakProviderBoundary } = require('../kern/bewijsvlak/v3-ingress');

module.exports = function maakBetaalProviderBewijs() {
  const boundary = maakProviderBoundary();
  function assertionVan(value, providerOverride) {
    const v = value || {}, provider = String(providerOverride || v.aanbieder || '').toLowerCase();
    const amount = Number(v.bedrag);
    return Object.freeze({ provider,
      paymentRef: String(v.referentie || ''),
      providerObjectId: String(v.id || v.providerId || ''),
      providerPaymentId: String(v.betaalId || v.providerPaymentId || ''),
      status: String(v.status || '').toLowerCase(),
      amountCents: Number.isFinite(amount) ? Math.round(amount) : null,
      currency: String(v.valuta || '').toLowerCase() });
  }
  const mark = (value, provider, eventRef, verifier, assertionSource) => boundary.mark(value, {
    provider, eventRef, purpose: 'money', verifier: verifier || 'payment-provider-adapter',
    assertion: assertionVan(assertionSource || value, provider)
  });
  function verifyAdyen(item, adyen) {
    const goed = !!(adyen && adyen.verifieerMelding(item));
    if (!goed) return false;
    const soort = String(item && item.eventCode || '').toUpperCase();
    const gelukt = String(item && item.success).toLowerCase() === 'true';
    const status = !gelukt ? 'refused'
      : soort === 'CAPTURE' || !adyen.handmatigeCapture ? 'captured' : 'authorised';
    const extra = item.additionalData || {};
    mark(item, 'adyen', ['adyen', item.pspReference, soort, item.success].join(':'), 'adyen-hmac',
      { id: extra.paymentLinkId || item.pspReference, betaalId: item.pspReference,
        status, referentie: item.merchantReference,
        bedrag: item.amount && Math.round(Number(item.amount.value)),
        valuta: item.amount && String(item.amount.currency || '').toLowerCase() });
    return true;
  }
  return Object.freeze({ mark, assertionVan, verifyAdyen,
    issue: boundary.issue, verify: boundary.verify });
};
