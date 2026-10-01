'use strict';

const runtime = require('./runtime');

function reservation(stage, input) {
  try {
    const i = input || {}, v3 = runtime.current().v3;
    const subjectRef = { domain: 'hospitality', type: 'reservation', id: String(i.reservationRef) };
    const common = { subjectRef, correlationId: 'reservation_' + String(i.reservationRef).toLowerCase(),
      capability: 'reservation.request', provider: i.provider || 'hospitality', at: i.at };
    if (stage === 'commitment') return v3.pilots.externalEvidence({ ...common,
      factType: 'external.commitment.recorded', truthClass: 'DOMAIN', scope: 'external.commitment',
      protocol: 'COMMITMENT', value: i.value });
    if (stage === 'confirmed') return v3.pilots.externalEvidence({ ...common,
      factType: 'external.provider.confirmed', truthClass: 'EXTERNAL', scope: 'external.confirmation',
      protocol: 'CONFIRMATION', source: { type: 'hospitality-provider', ref: String(i.provider || 'hospitality') },
      value: i.value });
    if (stage === 'outcome') return v3.pilots.externalEvidence({ ...common,
      factType: 'external.outcome.observed', truthClass: 'OPERATIONAL', scope: 'external.outcome',
      protocol: 'OUTCOME', source: { type: 'authorized-fulfillment-observer', ref: String(i.observer || 'hospitality') },
      value: i.value });
    return null;
  } catch (e) { return null; }
}

function assess(reservationRef, evidenceRefs, at) {
  try {
    return runtime.current().v3.derive({ profileId: 'external.fulfillment', profileVersion: 3,
      subjectRef: { domain: 'hospitality', type: 'reservation', id: String(reservationRef) }, evidenceRefs, effectiveAt: at });
  } catch (e) { return null; }
}

module.exports = { reservation, assess };
