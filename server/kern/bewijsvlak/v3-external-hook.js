'use strict';

const { hash } = require('./canon');

let adapter = null;
function installExternalHook(value) {
  if (!value || typeof value.externalEvidence !== 'function' ||
    typeof value.verifyOwnerProof !== 'function')
    throw new Error('bewijsvlak v3: ongeldige external-adapter');
  adapter = value;
}
function eis() {
  if (!adapter) throw new Error('bewijsvlak v3: external-adapter is niet geïnstalleerd');
  return adapter;
}
function externalFailure(error) {
  return Object.freeze({ ok: false, shadow: true,
    code: error && error.code || 'EXTERNAL_EVIDENCE_FAILED',
    incidentId: error && error.incidentId || null });
}
function afhandelen(error) { if (error && error.incidentId) throw error; return externalFailure(error); }

function reservation(stage, input) {
  try {
    const i = input || {};
    const subjectRef = { domain: 'hospitality', type: 'reservation', id: String(i.reservationRef) };
    const common = { subjectRef, correlationId: 'reservation_' + String(i.reservationRef).toLowerCase(),
      capability: 'reservation.request', provider: i.provider || 'hospitality', at: i.at };
    if (stage === 'commitment') {
      const assertion = i.ownerAssertion || {}, value = i.value || {};
      if (!i.ownerProof || !assertion.subjectRef ||
        hash(assertion.subjectRef) !== hash(subjectRef) ||
        assertion.factType !== 'external.commitment.recorded' ||
        assertion.providerReservationRef !== String(value.providerReservationRef || '') ||
        assertion.provider !== String(i.provider || '').toLowerCase() ||
        assertion.valueDigest !== hash(value)) {
        const error = new Error('bewijsvlak v3: hospitality-domeinbewijs hoort niet bij deze aanvraag');
        error.code = 'OWNER_PROOF_INVALID';
        throw error;
      }
      const receipt = eis().verifyOwnerProof(i.ownerProof, { owner: 'hospitality-domain',
        purpose: 'external-domain', factType: 'external.commitment.recorded',
        eventRef: i.ownerEventRef, subjectRef, assertion });
      return eis().externalEvidence({ ...common, factType: 'external.commitment.recorded',
        ownerReceipt: receipt, value });
    }
    if (stage === 'confirmed') {
      if (!i.providerProof) {
        const error = new Error('bewijsvlak v3: geverifieerd providerbewijs ontbreekt');
        error.code = 'INGRESS_PROOF_REQUIRED';
        throw error;
      }
      const assertion = i.providerAssertion || {};
      const value = i.value || {}, provider = String(i.provider || '').toLowerCase();
      if (assertion.provider !== provider || assertion.reservationRef !== String(i.reservationRef) ||
        assertion.providerReservationRef !== String(value.providerReservationRef || '') ||
        assertion.status !== String(value.status || '').toLowerCase() ||
        ((assertion.decisionRef || value.decisionRef) &&
          assertion.decisionRef !== String(value.decisionRef || ''))) {
        const error = new Error('bewijsvlak v3: providerassertion hoort niet bij deze reservering');
        error.code = 'INGRESS_ASSERTION_MISMATCH';
        throw error;
      }
      return eis().externalEvidence({ ...common, factType: 'external.provider.confirmed',
        ingressProof: i.providerProof, providerAssertion: assertion, value: i.value });
    }
    if (stage === 'outcome') return eis().externalEvidence({ ...common,
      factType: 'external.outcome.observed', observer: String(i.observer || ''),
      observerProof: i.observerProof, value: i.value });
    return externalFailure(Object.assign(new Error('onbekende external stage'), { code: 'EXTERNAL_STAGE_UNKNOWN' }));
  } catch (error) { return afhandelen(error); }
}

function assess(reservationRef, evidenceRefs, at) {
  try {
    return require('./runtime').current().v3.derive({ profileId: 'external.fulfillment', profileVersion: 3,
      subjectRef: { domain: 'hospitality', type: 'reservation', id: String(reservationRef) },
      evidenceRefs, effectiveAt: at });
  } catch (error) { return afhandelen(error); }
}

module.exports = { install: installExternalHook, reservation, assess };
