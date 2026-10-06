/* Eerste verticale client van de Trust & Evidence Plane. De runner bezit geen
   beschikbaarheid, boeking of geld: zes verplichte adapters blijven eigenaar.
   Hij verbindt hun bewezen resultaten met één correlation chain. */
'use strict';

const context = require('./context');
const { hash } = require('./canon');

const STAPPEN = Object.freeze([
  ['availability', 'hospitality.availability.check', 'hospitality.availability.proven'],
  ['experience', 'experience.propose', 'experience.proposed'],
  ['booking', 'reservation.request', 'reservation.held'],
  ['payment', 'payment.authorize', 'payment.authorized'],
  ['fulfillment', 'hospitality.fulfill', 'hospitality.fulfilled'],
  ['outcome', 'outcome.observe', 'outcome.observed']
]);

async function run(opties) {
  const o = opties || {}, plane = o.plane, adapters = o.adapters || {};
  if (!plane || typeof plane.observe !== 'function') throw new Error('hospitality chain: plane ontbreekt');
  for (const [phase] of STAPPEN) if (typeof adapters[phase] !== 'function')
    throw new Error('hospitality chain: werkende adapter ontbreekt voor ' + phase);
  const root = o.context || context.maak({ phase: 'availability', actorRef: o.actorRef || null,
    tenantRef: o.tenantRef || null, economicPrincipalRef: o.economicPrincipalRef || null,
    purpose: 'hospitality-booking' });
  const inputHash = hash(o.input || {}), results = {}, evidence = [];
  let parent = root;

  for (const [phase, capability, predicate] of STAPPEN) {
    const phaseStarted = process.hrtime.bigint();
    const stapContext = context.kind(phase, { chainId: root.chainId, causedBy: parent.stepId,
      actorRef: root.actorRef, tenantRef: root.tenantRef,
      economicPrincipalRef: root.economicPrincipalRef, purpose: root.purpose });
    const operationId = root.chainId + ':' + capability;
    const idempotencyKey = 'rtg:' + hash({ chainId: root.chainId, capability, inputHash }).slice(0, 40);
    const attempts = [];
    const uitvoering = await context.inContext(stapContext, () => plane.retry.voerUit({
      operationId, idempotencyKey, inputHash,
      money: phase === 'payment', reconcile: phase === 'payment' ? adapters.reconcilePayment : null,
      policy: (o.retryPolicies && o.retryPolicies[phase]) || { maxAttempts: 3, baseMs: 250, maxMs: 5000 },
      wait: o.wait || (() => Promise.resolve()),
      onAttempt: receipt => {
        attempts.push(receipt);
        plane.ledger.append({ boundary: o.boundary || 'hospitality', chainId: root.chainId,
          stepId: stapContext.stepId, kind: 'attempt.' + phase, decision: receipt.outcome,
          reasonCodes: receipt.classification ? [receipt.classification] : [], inputHash,
          contractRef: { id: capability, version: 1 } });
      },
      execute: async meta => {
        const antwoord = await adapters[phase]({ input: o.input || {}, previous: { ...results },
          context: stapContext, operationId, idempotencyKey, inputHash, attempt: meta.attempt });
        if (!antwoord || antwoord.error || antwoord.ok === false) throw Object.assign(
          new Error((antwoord && antwoord.error) || phase + ' gaf geen geldige uitkomst'),
          { status: (antwoord && antwoord.status) || 500, code: antwoord && antwoord.code,
            ambiguous: !!(antwoord && antwoord.ambiguous) });
        return antwoord;
      }
    }));
    if (!uitvoering.ok) {
      plane.measure({ context: stapContext, capability, boundary: o.boundary || 'hospitality',
        measurementKey: idempotencyKey, durationMs: Number(process.hrtime.bigint() - phaseStarted) / 1e6,
        outcome: uitvoering.classification === 'TERMINAL' ? 'DENIED' : 'FAILED',
        domainOutcome: phase.toUpperCase() + '_NOT_COMPLETED', errorClass: uitvoering.classification });
      return { ok: false, chainId: root.chainId, failedAt: phase,
        decision: uitvoering.decision, classification: uitvoering.classification,
        results, attempts: uitvoering.receipts };
    }
    results[phase] = uitvoering.result;
    const subjectRef = uitvoering.result.subjectRef || (results.booking && results.booking.subjectRef) ||
      { domain: 'hospitality', type: phase, id: hash({ chainId: root.chainId, phase }).slice(0, 24) };
    const waarneming = plane.observe({ context: stapContext, capability,
      boundary: o.boundary || 'hospitality', subjectRef, predicate,
      value: uitvoering.result.value === undefined ? { ok: true } : uitvoering.result.value,
      evidence: { domainRef: subjectRef, resultHash: hash(uitvoering.result), attempts: attempts.length },
      policy: uitvoering.result.policy || { id: capability + '-policy', version: 1, decision: 'SHADOW' } });
    evidence.push(waarneming);
    plane.measure({ context: stapContext, capability, boundary: o.boundary || 'hospitality',
      measurementKey: idempotencyKey, durationMs: Number(process.hrtime.bigint() - phaseStarted) / 1e6,
      outcome: 'SUCCEEDED', domainOutcome: uitvoering.reconciled
        ? phase.toUpperCase() + '_RECONCILED' : phase.toUpperCase() + '_COMPLETED' });
    parent = stapContext;
  }
  return { ok: true, chainId: root.chainId, finalStepId: parent.stepId, results, evidence };
}

module.exports = { STAPPEN, run };
