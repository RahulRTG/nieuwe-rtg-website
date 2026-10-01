'use strict';

const runtime = require('./runtime');

const subject = payment => ({ domain: 'money', type: 'payment', id: String(payment.id) });
const correlation = payment => 'payment_' + String(payment.id).toLowerCase();

function confirmed(payment, providerEventId) {
  try {
    const v3 = runtime.current().v3, s = subject(payment), at = payment.bijgewerktAt || new Date().toISOString();
    const common = { subjectRef: s, correlationId: correlation(payment), provider: payment.provider,
      capability: 'payment.authorize', at };
    const external = v3.pilots.moneyEvidence({ ...common, factType: 'payment.provider.settled',
      truthClass: 'EXTERNAL', scope: 'payment.settlement', protocol: 'SETTLEMENT',
      source: { type: 'verified-payment-provider', ref: String(payment.provider) },
      value: { providerEventId: providerEventId || null, providerStatus: payment.providerStatus,
        amountCents: payment.centen, currency: payment.valuta } });
    const domain = v3.pilots.moneyEvidence({ ...common, factType: 'payment.ledger.posted',
      truthClass: 'DOMAIN', scope: 'payment.ledger', protocol: 'COMMITMENT',
      source: { type: 'rtg-payment-truth', ref: 'betaalwaarheid' },
      value: { paymentRef: payment.id, status: payment.status, amountCents: payment.centen, currency: payment.valuta } });
    /* Een provider-event plus onze eigen boeking is nog GEEN reconciliatie.
       `payment.reconciliation.matched` mag uitsluitend ontstaan uit een aparte
       vergelijking met de providerafrekening/het statement. Dezelfde
       webhookafhandeling hier als derde waarheid opvoeren maakte één bron ten
       onrechte RECONCILED en kon de evidence debt onzichtbaar maken. */
    return v3.pilots.assessMoney({ subjectRef: s,
      evidenceRefs: [external.evidenceId, domain.evidenceId], correlationId: correlation(payment), at });
  } catch (e) { return { ok: false, shadow: true, code: 'MONEY_EVIDENCE_FAILED' }; }
}

function unknown(payment, error) {
  try {
    const v3 = runtime.current().v3, s = subject(payment), at = new Date().toISOString();
    const technical = v3.pilots.moneyEvidence({ subjectRef: s, correlationId: correlation(payment),
      factType: 'payment.provider.outcome_unknown', truthClass: 'TECHNICAL', scope: 'payment.execution',
      protocol: 'EXECUTION', provider: payment.provider, at,
      value: { code: String(error && error.code || 'PROVIDER_ERROR'), outcome: 'UNKNOWN' } });
    return v3.pilots.assessMoney({ subjectRef: s, evidenceRefs: [technical.evidenceId],
      correlationId: correlation(payment), at });
  } catch (e) { return { ok: false, shadow: true, code: 'MONEY_UNKNOWN_EVIDENCE_FAILED' }; }
}

module.exports = { confirmed, unknown };
