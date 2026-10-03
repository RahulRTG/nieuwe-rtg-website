/* Private domain adapters for V3.

   They are installed into narrow domain hooks and deliberately never returned
   by the public Plane/runtime API. Source, authority, scope and truth class
   follow from the selected fact contract; callers cannot promote their own
   strings. EXTERNAL provider facts additionally consume an opaque proof made
   at the verified ingress boundary. */
'use strict';

const { hash } = require('./canon');
const sourceRetention = require('./v3-source-retention');
const { MONEY, EXTERNAL, AUTHORITY } = require('./v3-pilot-facts');

function maakPilots(api) {
  const { recordAuthorized, derive, decide, reconcile, atomic, now, verifyProviderProof,
    verifyMoneyOwnerProof, verifyAuthorityOwnerProof, verifyExternalOwnerProof } = api;
  const correlation = input => String(input.correlationId ||
    'chain_' + hash({ subjectRef: input.subjectRef }).slice(0, 24));
  const externalOwnerVerifier = typeof verifyExternalOwnerProof === 'function'
    ? verifyExternalOwnerProof : () => {
      const error = new Error('bewijsvlak v3: hospitality-domeineigenaarbewijs ontbreekt');
      error.code = 'OWNER_PROOF_REQUIRED';
      throw error;
    };
  const operation = (input, domain, capability, name, provider) => ({ domain, capability, name,
    attempt: input.attempt || 1, provider: provider || null });

  function recordFact(descriptor, input, domain, capability, purpose) {
    if (!descriptor) throw new Error('bewijsvlak v3 authority: onbekend feit');
    const i = input || {}, at = i.at || now();
    let provider = i.provider ? String(i.provider).toLowerCase() : null, proof = null;
    if (descriptor.external) {
      if (typeof verifyProviderProof !== 'function') {
        const error = new Error('bewijsvlak v3 authority: geverifieerde provider-ingress ontbreekt');
        error.code = 'INGRESS_PROOF_REQUIRED';
        throw error;
      }
      proof = verifyProviderProof(i.ingressProof, { provider, purpose: domain,
        factType: i.factType, subjectRef: i.subjectRef, assertion: i.providerAssertion });
      provider = proof.provider;
    }
    if (descriptor.operational) {
      const error = new Error('bewijsvlak v3 authority: er is nog geen geverifieerde operationele ingress-adapter');
      error.code = 'OPERATIONAL_PROOF_UNAVAILABLE';
      throw error;
    }
    const ownerReceipt = i.ownerReceipt || null;
    if (descriptor.owner) {
      const subjectDigest = hash(i.subjectRef || {});
      if (!ownerReceipt || ownerReceipt.owner !== descriptor.owner ||
        ownerReceipt.factType !== i.factType || ownerReceipt.subjectRefDigest !== subjectDigest ||
        !/^[a-f0-9]{64}$/.test(String(ownerReceipt.eventRefDigest || '')) ||
        !/^[a-f0-9]{64}$/.test(String(ownerReceipt.assertionDigest || ''))) {
        const error = new Error('bewijsvlak v3 authority: domeineigenaarbewijs ontbreekt of hoort bij een andere overgang');
        error.code = 'OWNER_PROOF_REQUIRED';
        throw error;
      }
    }
    const sourceRef = descriptor.external ? provider : descriptor.operational
      ? String(i.observer) : descriptor.sourceRef;
    const authorityId = descriptor.external ? 'provider:' + provider : descriptor.operational
      ? 'observer:' + String(i.observer) : descriptor.authorityId;
    const authorityBasis = descriptor.external ? 'verified-provider-channel' : descriptor.operational
      ? 'authorized-observer' : descriptor.authorityBasis;
    if (proof && !/^[a-f0-9]{64}$/.test(String(proof.receiptDigest || ''))) {
      const error = new Error('bewijsvlak v3 authority: providerreceipt mist een vaste digest');
      error.code = 'INGRESS_PROOF_INVALID';
      throw error;
    }
    const receipt = proof || ownerReceipt;
    const receiptDigest = proof ? proof.receiptDigest : ownerReceipt ? hash(ownerReceipt) : null;
    const value = proof ? { providerReceiptDigest: receiptDigest,
      providerAssertionDigest: proof.assertionDigest,
      assertionDigest: hash(i.value == null ? null : i.value) } : ownerReceipt
      ? { ownerReceiptDigest: receiptDigest, ownerAssertionDigest: ownerReceipt.assertionDigest,
        assertionDigest: hash(i.value == null ? null : i.value) } : i.value;
    const retention = ownerReceipt && descriptor.retentionContract
      ? sourceRetention.maakDraft({ contractRef: { id: descriptor.retentionContract, version: 1 },
        digests: { VALUE: hash(value) }, locatorDigest: ownerReceipt.locatorDigest,
        retentionReceiptDigest: ownerReceipt.retentionReceiptDigest,
        retainedFrom: ownerReceipt.retainedFrom, verifiedAt: ownerReceipt.verifiedAt })
      : proof && proof.retention ? sourceRetention.maakDraft({ ...proof.retention,
        digests: { EVENT: proof.eventRefDigest, ASSERTION: proof.assertionDigest,
          RECEIPT: proof.receiptDigest } }) : i.sourceRetention || null;
    return recordAuthorized({ id: descriptor.contract, version: 1 }, {
      factType: i.factType, subjectRef: i.subjectRef, protocol: descriptor.protocol || 'AUTHORITY',
      truthClass: descriptor.truthClass,
      source: { type: descriptor.sourceType, ref: sourceRef,
        eventRefDigest: receipt && receipt.eventRefDigest,
        assertionDigest: receipt && receipt.assertionDigest,
        receiptDigest },
      authority: { id: authorityId, scopes: [descriptor.scope], basis: authorityBasis, validFrom: at,
        validUntil: i.validUntil || null },
      observedAt: at, effectiveFrom: i.effectiveFrom || at,
      causality: { correlationId: correlation(i), causationId: proof
        ? 'provider_event_' + proof.eventRefDigest : ownerReceipt
          ? 'owner_event_' + ownerReceipt.eventRefDigest : i.causationId || null,
        parentEvidenceId: i.parentEvidenceId || null },
      operation: operation(i, domain, i.capability || capability, i.operation || i.factType, provider),
      transition: i.transition, value, purpose, sourceRetention: retention
    });
  }

  function moneyEvidence(input) {
    const i = input || {};
    return recordFact(MONEY[i.factType], i, 'money', 'payment.authorize', 'money-integrity');
  }

  function assessMoney(input) {
    return atomic('money.assess', () => {
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
    });
  }

  function confirmMoney(input) {
    return atomic('money.confirm', () => {
      const i = input || {};
      let external = null;
      if (i.ingressProof) external = moneyEvidence({ ...i,
        factType: 'payment.provider.settled', value: i.externalValue });
      const domain = moneyEvidence({ ...i, ingressProof: null, providerAssertion: null,
        factType: 'payment.ledger.posted', value: i.domainValue });
      const refs = [external && external.evidenceId, domain.evidenceId].filter(Boolean);
      const result = assessMoney({ subjectRef: i.subjectRef, evidenceRefs: refs,
        correlationId: i.correlationId, at: i.at });
      return Object.freeze({ ok: true, ...result,
        ingress: external ? { ok: true } : { ok: false, code: 'INGRESS_PROOF_REQUIRED' },
        evidence: { domain, external } });
    });
  }

  function externalEvidence(input) {
    const i = input || {};
    return recordFact(EXTERNAL[i.factType], i, 'external', i.capability || 'external.fulfill',
      'external-dependency-integrity');
  }

  function authorityEvidence(input) {
    const i = input || {};
    return recordFact(AUTHORITY[i.factType], i, 'authority', 'authority.revoke',
      'authority-revocation-integrity');
  }

  require('./v3-money-hook').install(Object.freeze({ moneyEvidence, assessMoney, confirmMoney,
    verifyOwnerProof: verifyMoneyOwnerProof }));
  require('./v3-external-hook').install(Object.freeze({ externalEvidence,
    verifyOwnerProof: externalOwnerVerifier }));
  require('./v3-authority-hook').install(Object.freeze({ authorityEvidence,
    verifyOwnerProof: verifyAuthorityOwnerProof }));
}

module.exports = { maakPilots };
