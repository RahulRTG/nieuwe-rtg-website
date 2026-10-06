'use strict';

function basis(id, owner, phase, extra) {
  const x = extra || {};
  return {
    id, version: 1, owner, phase, implemented: x.implemented !== false,
    risk: { tier: x.risk || (phase === 'payment' ? 'critical' : phase === 'booking' ? 'high' : 'medium'),
      failureMode: x.failureMode || 'fail-closed' },
    idempotency: { mode: x.idempotency || 'required', scope: 'actor+capability+input' },
    policy: { id: x.policy || owner + '-policy', version: 1, default: 'DENY' },
    schemas: { input: id + '.input.v1', output: id + '.output.v1', event: id + '.event.v1' },
    interfaces: {
      appCore: id + '.app-core.v1', producerConsumer: id + '.event.v1',
      policyEvaluator: (x.policy || owner + '-policy') + '.evaluator.v1',
      capabilityProvider: id + '.provider.v1', aiAction: id + '.ai-action.v1'
    },
    evidence: { required: x.evidence || ['policy-decision', 'domain-observation'], ttlSeconds: x.ttlSeconds || 300 },
    slo: { profile: x.slo || 'platform-default-v1' },
    dependencies: x.dependencies || [], fallback: x.fallback || null,
    compatibility: { client: { min: 1 }, policy: { min: 1 }, event: { min: 1 } },
    privacy: { classification: x.classification || 'intern', purpose: x.purpose || phase }
  };
}

module.exports = Object.freeze([
  basis('hospitality.availability.check', 'hospitality', 'availability', { idempotency: 'declared', slo: 'availability-v1' }),
  basis('experience.propose', 'experience', 'experience', { idempotency: 'declared', slo: 'experience-v1', dependencies: ['hospitality.availability.check'] }),
  basis('reservation.request', 'hospitality', 'booking', { dependencies: ['hospitality.availability.check'], slo: 'booking-v1' }),
  basis('payment.authorize', 'pay', 'payment', { dependencies: ['reservation.request'], slo: 'payment-v1', classification: 'persoonsgegeven', risk: 'critical' }),
  basis('hospitality.fulfill', 'hospitality', 'fulfillment', { dependencies: ['reservation.request'], slo: 'fulfillment-v1' }),
  basis('outcome.observe', 'experience', 'outcome', { idempotency: 'declared', slo: 'outcome-v1', dependencies: ['hospitality.fulfill'] })
]);
