'use strict';

const context = require('./context');
const { hash, kopie, bevries } = require('./canon');
const contract = require('./v3-contract');
const { maakStore } = require('./v3-store');
const { maakRegister } = require('./v3-profiles');
const { maakResolver } = require('./v3-resolver');
const { maakDecisions } = require('./v3-decisions');
const { maakReconciliation } = require('./v3-reconciliation');
const { maakPilots } = require('./v3-pilots');

function maakV3(opties) {
  const o = opties || {}, state = o.state || {}, nu = o.nu || (() => new Date().toISOString());
  const store = maakStore({ state, save: o.save });
  const profiles = maakRegister(o.profiles);
  const ledger = o.ledger;

  function record(input) {
    const ctx = context.huidige() || context.maak({ phase: input && input.protocol });
    const enriched = { ...(input || {}), causality: { correlationId: ctx.chainId,
      causationId: ctx.causedBy || ctx.stepId, ...((input && input.causality) || {}) } };
    const evidence = contract.evidence(enriched, nu);
    const vast = store.put('evidence', evidence.evidenceId, evidence);
    if (ledger) ledger.append({ boundary: 'trust:v3:' + vast.operation.domain, chainId: vast.causality.correlationId,
      stepId: vast.evidenceId, kind: 'v3.evidence.recorded', evidenceRefs: [{ evidenceId: vast.evidenceId,
        digest: vast.recordDigest }], inputHash: vast.recordDigest });
    return vast;
  }

  const resolver = maakResolver({ store, profiles, nu });
  function derive(input) {
    const claim = resolver.derive(input);
    if (ledger) ledger.append({ boundary: 'trust:v3:claims', claimId: claim.claimId,
      kind: 'v3.claim.derived', decision: claim.finality,
      evidenceRefs: claim.evidenceRefs.map(evidenceId => ({ evidenceId })), inputHash: claim.derivationDigest,
      contractRef: claim.requirementProfile });
    return claim;
  }
  const decisions = maakDecisions({ store, recordEvidence: record, nu });
  function decide(input) {
    const result = decisions.decide(input);
    if (ledger) ledger.append({ boundary: 'trust:v3:decisions', claimId: result.decision.claimRefs[0],
      kind: 'v3.decision.recorded', decision: result.decision.outcome,
      evidenceRefs: [{ evidenceId: result.decisionEvidence.evidenceId }], inputHash: result.decision.decisionDigest,
      policyRef: result.decision.policy });
    return result;
  }
  const reconciliation = maakReconciliation({ store, nu });
  function reconcile(input) {
    const result = reconciliation.transition(input);
    if (ledger) ledger.append({ boundary: 'trust:v3:reconciliation', claimId: result.claimRef,
      kind: 'v3.reconciliation.' + result.state.toLowerCase(), decision: result.state,
      evidenceRefs: result.evidenceRefs.map(evidenceId => ({ evidenceId })), inputHash: hash(result) });
    return result;
  }
  const pilots = maakPilots({ record, derive, decide, reconcile, now: nu });
  return Object.freeze({ version: 3, mode: o.mode || 'shadow', record, derive, decide, reconcile,
    reproduce: resolver.reproduce, profiles, store, pilots,
    evidence: id => store.get('evidence', id), claim: id => store.get('claims', id),
    snapshot: () => bevries({ version: 3, mode: o.mode || 'shadow', counts: store.counts(),
      profiles: profiles.list().map(p => ({ id: p.id, version: p.version, digest: p.profileDigest })),
      evidenceDebt: store.list('claims').filter(c => !['RECONCILED', 'CROSS_VERIFIED'].includes(c.finality))
        .map(c => ({ claimId: c.claimId, subjectRef: kopie(c.subjectRef), finality: c.finality,
          missing: c.completeness.missing, conflicting: c.completeness.conflicting })) }) });
}

module.exports = { maakV3 };
