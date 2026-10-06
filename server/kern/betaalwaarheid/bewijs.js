/* Payment Truth owns the domain state; this narrow bridge binds a verified
   provider object to V3 and refuses to hide consequential evidence failures. */
'use strict';

const trustMoney = require('../bewijsvlak/v3-money-hook');
const { maakOwnerBoundary } = require('../bewijsvlak/v3-owner-proof');

const ownerProof = maakOwnerBoundary('payment-truth');

function ownerTransition(payment, factType, purpose) {
  const events = payment && Array.isArray(payment.gebeurtenissen) ? payment.gebeurtenissen : [];
  const event = events[events.length - 1];
  if (!event || !event.zegel || event.status !== payment.status) {
    const error = new Error('Payment Truth mist het duurzame domeinevent voor dit bewijs.');
    error.code = 'MONEY_OWNER_EVENT_REQUIRED';
    throw error;
  }
  if (factType === 'payment.provider.outcome_unknown' && event.soort !== 'PROVIDER_FOUT') {
    const error = new Error('Een onzekere uitkomst vereist een echt PROVIDER_FOUT-event.');
    error.code = 'MONEY_OWNER_EVENT_MISMATCH';
    throw error;
  }
  const subjectRef = { domain: 'money', type: 'payment', id: String(payment.id) };
  const assertion = { subjectRef, factType, status: String(payment.status),
    provider: String(payment.provider || '').toLowerCase(),
    providerStatus: String(payment.providerStatus || '').toLowerCase(),
    amountCents: Math.round(Number(payment.centen)), currency: String(payment.valuta || '').toLowerCase(),
    eventSeal: String(event.zegel), eventNumber: Number(event.nr), eventAt: String(event.at) };
  ownerProof.mark(event, { purpose, factType, eventRef: event.zegel, subjectRef, assertion });
  return { proof: ownerProof.issue(event), assertion, eventRef: event.zegel };
}

function maakBetaalBewijs(betaal) {
  function providerProof(value) {
    try { return betaal && typeof betaal.providerBewijsVan === 'function' ? betaal.providerBewijsVan(value) : null; }
    catch (error) {
      if (error && error.code === 'INGRESS_PROOF_REQUIRED') return null;
      throw error;
    }
  }
  const assertion = value => betaal && typeof betaal.providerAssertionVan === 'function'
    ? betaal.providerAssertionVan(value, value && value.aanbieder) : null;
  function eis(result) {
    if (!result || result.ok !== false || result.code === 'EVIDENCE_ADAPTER_UNAVAILABLE') return result;
    const error = new Error('Betaling is ontvangen, maar het verplichte bewijs kon niet veilig worden vastgelegd.');
    error.code = result.code || 'MONEY_EVIDENCE_FAILED';
    if (result.incidentId) error.incidentId = result.incidentId;
    throw error;
  }
  return Object.freeze({ providerProof,
    confirmed(payment, eventId, proof, source) {
      const owner = ownerTransition(payment, 'payment.ledger.posted', 'money-domain');
      return eis(trustMoney.confirmed(payment, eventId, proof, assertion(source), owner));
    },
    unknown(payment, error) {
      const owner = ownerTransition(payment, 'payment.provider.outcome_unknown', 'money-execution');
      return eis(trustMoney.unknown(payment, error, owner));
    } });
}

module.exports = maakBetaalBewijs;
module.exports.verifyOwnerProof = ownerProof.verify;
