'use strict';

const { hash } = require('./canon');

function maakPilots(api) {
  const { record, derive, decide, reconcile, now } = api;
  const correlation = input => String(input.correlationId || 'chain_' + hash({ subjectRef: input.subjectRef }).slice(0, 24));
  const source = (input, standaard) => input.source || { type: standaard, ref: standaard };
  const operation = (input, domain, capability, name) => ({ domain, capability, name,
    attempt: input.attempt || 1, provider: input.provider || null });

  function moneyEvidence(input) {
    const i = input || {}, at = i.at || now();
    return record({ factType: i.factType, subjectRef: i.subjectRef, protocol: i.protocol,
      truthClass: i.truthClass, source: source(i, i.truthClass === 'EXTERNAL' ? 'payment-provider' : 'rtg-payment'),
      authority: i.authority || { id: i.truthClass === 'EXTERNAL' ? String(i.provider || 'payment-provider') : 'rtg:payment',
        scopes: [i.scope], basis: i.truthClass === 'EXTERNAL' ? 'verified-provider-channel' : 'domain-ownership', validFrom: at },
      observedAt: at, effectiveFrom: i.effectiveFrom || at,
      causality: { correlationId: correlation(i), causationId: i.causationId || null,
        parentEvidenceId: i.parentEvidenceId || null },
      operation: operation(i, 'money', i.capability || 'payment.authorize', i.operation || i.factType),
      transition: i.transition, value: i.value, purpose: 'money-integrity' });
  }

  function assessMoney(input) {
    const i = input || {};
    const claim = derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: i.subjectRef,
      evidenceRefs: i.evidenceRefs, effectiveAt: i.at || now(), previousClaimId: i.previousClaimId });
    let decision = null, reconciliation = null;
    if (['UNKNOWN', 'UNVERIFIED', 'SOURCE_ATTESTED', 'DISPUTED'].includes(claim.finality)) {
      decision = decide({ subjectRef: i.subjectRef, claimRefs: [claim.claimId], action: 'payment.retry',
        outcome: 'DO_NOT_RETRY', reasonCodes: ['PAYMENT_FINALITY_' + claim.finality], consequential: true,
        policy: { id: 'money-integrity-v3', version: 3 }, correlationId: correlation(i) });
      reconciliation = reconcile({ subjectRef: i.subjectRef, claimRef: claim.claimId, state: 'REQUESTED',
        reasonCodes: ['PAYMENT_OUTCOME_NOT_FINAL'], evidenceRefs: i.evidenceRefs });
    }
    return { claim, decision, reconciliation };
  }

  function externalEvidence(input) {
    const i = input || {}, at = i.at || now();
    return record({ factType: i.factType, subjectRef: i.subjectRef, protocol: i.protocol,
      truthClass: i.truthClass, source: source(i, i.truthClass === 'EXTERNAL' ? 'external-provider' : 'rtg-domain'),
      authority: i.authority || { id: String(i.provider || 'rtg:external'), scopes: [i.scope],
        basis: i.truthClass === 'EXTERNAL' ? 'verified-provider-channel' : 'domain-ownership', validFrom: at },
      observedAt: at, effectiveFrom: i.effectiveFrom || at,
      causality: { correlationId: correlation(i), causationId: i.causationId || null,
        parentEvidenceId: i.parentEvidenceId || null },
      operation: operation(i, 'external', i.capability || 'external.fulfill', i.operation || i.factType),
      transition: i.transition, value: i.value, purpose: 'external-dependency-integrity' });
  }

  function authorityEvidence(input) {
    const i = input || {}, at = i.at || now();
    return record({ factType: i.factType, subjectRef: i.subjectRef, protocol: i.protocol || 'AUTHORITY',
      truthClass: i.truthClass || 'DOMAIN', source: source(i, 'rtg-authority'),
      authority: i.authority || { id: 'rtg:authority', scopes: [i.scope], basis: 'authority-owner', validFrom: at },
      observedAt: at, effectiveFrom: i.effectiveFrom || at,
      causality: { correlationId: correlation(i), causationId: i.causationId || null,
        parentEvidenceId: i.parentEvidenceId || null },
      operation: operation(i, 'authority', i.capability || 'authority.revoke', i.operation || i.factType),
      transition: i.transition, value: i.value, purpose: 'authority-revocation-integrity' });
  }
  return Object.freeze({ moneyEvidence, assessMoney, externalEvidence, authorityEvidence });
}

module.exports = { maakPilots };
