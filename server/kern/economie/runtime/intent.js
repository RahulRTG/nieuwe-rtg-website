/* Intent, commitment, obligation, claim en de eerste ledger-postings.

   `registreerVerdeling` is de huidige golden-path ingang: een betaling is door
   een bevoegde bron bevestigd en wordt onder een versieerbaar beleid verdeeld.
   De functie legt afspraak, rechten en boekingen in één bundel vast. Ze
   verplaatst geen extern geld; dat mag uitsluitend settlement.js. */
'use strict';

const { SCHEMA_VERSIE, CLAIM_STATUS, fout, derive } = require('./regels');
const { valideer } = require('./intent-validatie');
const { veiligGelijk } = require('../../util');

module.exports = function intentEngine(opslag) {
  const { wortel, tijd, sha, id, kopie, idem, fact, ledger, bewijs, zet, pak, waarden } = opslag;

  function herbereken(intentId) {
    const intent = pak('intents', intentId);
    if (!intent) return null;
    const claims = waarden('claims').filter(c => c.intentId === intentId);
    const settlements = waarden('settlements').filter(s => s.intentId === intentId);
    const capture = waarden('evidence').some(e => e.intentId === intentId && e.kind === 'PAYMENT_CAPTURE' && e.authenticity !== 'UNVERIFIED');
    const dynamisch = derive({ claims, settlements, heeftCaptureEvidence: capture,
      recovery: intent.state.recovery || 'NONE' });
    intent.state = Object.assign({}, intent.state, dynamisch);
    intent.updatedAt = tijd();
    opslag.wortel().intents[intentId] = intent;
    return intent;
  }

  function registreerVerdeling(input) {
    const bezwaar = valideer(input);
    if (bezwaar) return bezwaar;
    const fingerprintInput = kopie(input);
    delete fingerprintInput.idempotencyKey;
    const fingerprint = sha(fingerprintInput);
    const intentId = id('EI', input.idempotencyKey);
    const bekend = wortel().idempotency[input.idempotencyKey];
    if (bekend) {
      if (!veiligGelijk(bekend.fingerprint, fingerprint))
        return fout('IDEMPOTENCY_CONFLICT', 'Deze idempotency key hoort al bij een andere economische handeling.', 409,
          { intentId: bekend.intentId });
      return { ok: true, replay: true, intent: publiek(herbereken(bekend.intentId)) };
    }

    const now = tijd();
    const currency = String(input.requestedValue.currency).toUpperCase();
    const intent = {
      id: intentId, schemaVersion: SCHEMA_VERSIE, purpose: input.purpose,
      principalRef: input.principalRef, actingRef: input.actingRef || input.principalRef,
      sourceRef: input.sourceRef, requestedValue: { amountMinor: input.requestedValue.amountMinor, currency },
      legalContext: kopie(input.legalContext), economicContext: kopie(input.economicContext || {}),
      pricingSnapshot: kopie(input.pricingSnapshot || null), taxSnapshot: kopie(input.taxSnapshot || null),
      policySnapshot: kopie(input.policyDecision), authorizationContext: kopie(input.authorizationContext || {}),
      state: {
        intent: 'ACTIVE', authorization: 'AUTHORIZED', commitment: 'ACCEPTED',
        fulfillment: input.fulfillmentStatus || 'COMPLETE', financial: 'CAPTURED',
        allocation: 'COMPLETE', settlement: 'NOT_READY', reconciliation: 'UNRECONCILED',
        evidence: 'INCOMPLETE', recovery: 'NONE', lifecycle: 'OPEN'
      },
      commitmentIds: [], obligationIds: [], claimIds: [], ledgerTransactionIds: [],
      settlementIds: [], evidenceIds: [], caseIds: [], factCount: 0, lastFactHash: null,
      createdAt: now, updatedAt: now
    };
    zet('intents', intentId, intent);
    idem(input.idempotencyKey, fingerprint, intentId);
    fact(intentId, 'EconomicIntentCreated', {
      principalRef: intent.principalRef, actingRef: intent.actingRef, purpose: intent.purpose,
      sourceRef: intent.sourceRef, requestedValue: intent.requestedValue,
      legalContext: intent.legalContext, economicContext: intent.economicContext
    }, 'intent-created', input.clock);
    fact(intentId, 'PolicyResolved', {
      decisionId: input.policyDecision.decisionId, policyId: input.policyDecision.policyId,
      version: input.policyDecision.version, inputHash: input.policyDecision.inputHash || sha(fingerprintInput),
      decision: 'ALLOW', reasonCodes: kopie(input.policyDecision.reasonCodes || [])
    }, 'policy:' + input.policyDecision.decisionId, input.clock);
    fact(intentId, 'AuthorizationGranted', {
      principalRef: intent.principalRef, actingRef: intent.actingRef,
      authorityRef: input.authorizationContext && input.authorizationContext.authorityRef || null,
      limitsSnapshot: kopie(input.authorizationContext && input.authorizationContext.limitsSnapshot || null)
    }, 'authorization', input.clock);

    const commitmentId = id('EC', intentId + ':commitment:primary');
    const obligationPayId = id('EO', commitmentId + ':pay');
    const obligationAllocateId = id('EO', commitmentId + ':allocate');
    const settlementEntityRef = input.legalContext.settlementEntityRef;
    zet('commitments', commitmentId, {
      id: commitmentId, intentId, status: 'ACCEPTED', acceptedAt: now,
      parties: [intent.principalRef, settlementEntityRef], policyDecisionId: input.policyDecision.decisionId
    });
    zet('obligations', obligationPayId, { id: obligationPayId, intentId, commitmentId,
      debtorRef: intent.principalRef, creditorRef: settlementEntityRef, performance: 'PAY_VALUE',
      value: intent.requestedValue, status: 'FULFILLED' });
    zet('obligations', obligationAllocateId, { id: obligationAllocateId, intentId, commitmentId,
      debtorRef: settlementEntityRef, creditorRef: 'rtg:value-beneficiaries', performance: 'ALLOCATE_VALUE',
      value: intent.requestedValue, status: 'ACTIVE' });
    intent.commitmentIds.push(commitmentId);
    intent.obligationIds.push(obligationPayId, obligationAllocateId);
    fact(intentId, 'CommitmentAccepted', { commitmentId, obligationIds: [obligationPayId, obligationAllocateId] },
      'commitment:' + commitmentId, input.clock);

    const clearing = input.ledgerAccounts && input.ledgerAccounts.clearing || 'asset:provider-clearing';
    const unallocated = input.ledgerAccounts && input.ledgerAccounts.unallocated || 'liability:unallocated-value';
    const captureTx = ledger(intentId, 'CAPTURE', input.sourceRef, [
      { account: clearing, amountMinor: intent.requestedValue.amountMinor, currency },
      { account: unallocated, amountMinor: -intent.requestedValue.amountMinor, currency }
    ], { sourceRef: input.sourceRef }, input.clock);
    if (captureTx.error) return captureTx;
    intent.ledgerTransactionIds.push(captureTx.id);
    fact(intentId, 'PaymentCaptured', { sourceRef: input.sourceRef, amount: intent.requestedValue,
      ledgerTransactionId: captureTx.id }, 'capture:' + input.sourceRef, input.clock);

    const claimPostings = [{ account: unallocated, amountMinor: intent.requestedValue.amountMinor, currency }];
    for (const a of input.allocations) {
      const claimId = id('CL', intentId + ':' + a.component);
      const claim = {
        id: claimId, intentId, commitmentId, obligationId: obligationAllocateId,
        component: a.component, creditorRef: a.beneficiaryRef, debtorRef: settlementEntityRef,
        amountMinor: a.amountMinor, currency, basis: a.basis || 'ALLOCATION_LOCKED', mode: a.mode,
        status: a.mode === 'INTERNAL' ? CLAIM_STATUS.SATISFIED : CLAIM_STATUS.HELD,
        destinationRef: null, settlementIds: [], createdAt: now, settledAt: a.mode === 'INTERNAL' ? now : null
      };
      zet('claims', claimId, claim);
      intent.claimIds.push(claimId);
      claimPostings.push({ account: 'liability:claim:' + claimId, amountMinor: -a.amountMinor, currency });
      fact(intentId, 'ClaimCreated', { claimId, component: a.component, creditorRef: a.beneficiaryRef,
        amountMinor: a.amountMinor, currency, mode: a.mode }, 'claim:' + claimId, input.clock);
    }
    const allocationTx = ledger(intentId, 'ALLOCATION', input.policyDecision.decisionId,
      claimPostings, { policyDecisionId: input.policyDecision.decisionId, claimIds: intent.claimIds }, input.clock);
    if (allocationTx.error) return allocationTx;
    intent.ledgerTransactionIds.push(allocationTx.id);
    fact(intentId, 'AllocationLocked', { policyDecisionId: input.policyDecision.decisionId,
      claimIds: intent.claimIds, ledgerTransactionId: allocationTx.id }, 'allocation-locked', input.clock);

    for (const a of input.allocations.filter(x => x.mode === 'INTERNAL')) {
      const claim = pak('claims', id('CL', intentId + ':' + a.component));
      const tx = ledger(intentId, 'INTERNAL_CLAIM_SATISFIED', claim.id, [
        { account: 'liability:claim:' + claim.id, amountMinor: claim.amountMinor, currency },
        { account: a.ledgerAccount, amountMinor: -claim.amountMinor, currency }
      ], { claimId: claim.id }, input.clock);
      intent.ledgerTransactionIds.push(tx.id);
      fact(intentId, 'ClaimSatisfied', { claimId: claim.id, ledgerTransactionId: tx.id },
        'claim-satisfied:' + claim.id, input.clock);
    }

    if (input.captureEvidence) {
      const ev = bewijs(intentId, 'PAYMENT_CAPTURE', input.captureEvidence.externalRef || input.sourceRef,
        input.captureEvidence, input.clock);
      intent.evidenceIds.push(ev.id);
    }
    herbereken(intentId);
    zet('intents', intentId, intent);
    return { ok: true, replay: false, intent: publiek(intent) };
  }

  function publiek(intent) {
    if (!intent) return null;
    return kopie(intent);
  }

  return { registreerVerdeling, herbereken, publiek };
};
