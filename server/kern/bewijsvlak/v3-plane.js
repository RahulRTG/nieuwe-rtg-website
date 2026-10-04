'use strict';

const context = require('./context');
const { hash, bevries } = require('./canon');
const contract = require('./v3-contract');
const { maakStore } = require('./v3-store');
const { maakRegister } = require('./v3-profiles');
const { maakRegister: maakAuthorityRegister } = require('./v3-authorities');
const { maakResolver } = require('./v3-resolver');
const { maakDecisions } = require('./v3-decisions');
const { maakReconciliation } = require('./v3-reconciliation');
const { maakPilots } = require('./v3-pilots');
const { maakCoordinator } = require('./v3-transaction');

function maakV3(opties) {
  const o = opties || {}, state = o.state || {}, nu = o.nu || (() => new Date().toISOString());
  const transaction = o.transaction || maakCoordinator({ state, save: o.save, nu });
  const atomic = (label, fn) => transaction.atomic(label, fn);
  const store = maakStore({ state, stateFor: o.stateFor, save: o.save,
    limits: o.storeLimits, transaction });
  const authorities = maakAuthorityRegister(o.authorityContracts);
  const profiles = maakRegister(o.profiles, authorities);
  const ledger = o.ledger;

  function recordInternal(input, grant) {
    const ctx = context.huidige() || context.maak({ phase: input && input.protocol });
    const enriched = { ...(input || {}), causality: { correlationId: ctx.chainId,
      causationId: ctx.causedBy || ctx.stepId, ...((input && input.causality) || {}) } };
    const basis = contract.evidence(enriched, nu);
    const authorityContract = authorities.attest(grant, input, basis);
    const evidence = contract.bindAuthority(basis, authorityContract);
    const vast = store.put('evidence', evidence.evidenceId, evidence);
    if (ledger) ledger.append({ boundary: 'trust:v3:' + vast.operation.domain, chainId: vast.causality.correlationId,
      stepId: vast.evidenceId, kind: 'v3.evidence.recorded', evidenceRefs: [{ evidenceId: vast.evidenceId,
        digest: vast.recordDigest }], inputHash: vast.recordDigest });
    return vast;
  }

  function recordAuthorized(authorityContract, input) {
    return atomic('evidence.record', () => {
      const grant = authorities.issue(authorityContract, input);
      return recordInternal(input, grant);
    });
  }

  function recordUntrusted() {
    const error = new Error('bewijsvlak v3 authority: caller-supplied strings zijn geen authority proof; gebruik een vertrouwde adapter');
    error.code = 'AUTHORITY_PROOF_REQUIRED';
    throw error;
  }

  const resolver = maakResolver({ store, profiles, authorities, nu });
  function deriveClaim(input) {
    return atomic('claim.derive', () => {
      const claim = resolver.derive(input);
      if (ledger) ledger.append({ boundary: 'trust:v3:claims', claimId: claim.claimId,
        kind: 'v3.claim.derived', decision: claim.finality,
        evidenceRefs: claim.evidenceRefs.map(evidenceId => ({ evidenceId })), inputHash: claim.derivationDigest,
        contractRef: claim.requirementProfile });
      return claim;
    });
  }
  const decisions = maakDecisions({ store,
    recordEvidence: input => recordAuthorized({ id: 'trust.decision', version: 1 }, input), nu });
  function decide(input) {
    return atomic('decision.record', () => {
      const result = decisions.decide(input);
      if (ledger) ledger.append({ boundary: 'trust:v3:decisions', claimId: result.decision.claimRefs[0],
        kind: 'v3.decision.recorded', decision: result.decision.outcome,
        evidenceRefs: [{ evidenceId: result.decisionEvidence.evidenceId }], inputHash: result.decision.decisionDigest,
        policyRef: result.decision.policy });
      return result;
    });
  }
  const reconciliation = maakReconciliation({ store, nu });
  function reconcileClaim(input) {
    return atomic('reconciliation.transition', () => {
      const result = reconciliation.transition(input);
      if (ledger) ledger.append({ boundary: 'trust:v3:reconciliation', claimId: result.claimRef,
        kind: 'v3.reconciliation.' + result.state.toLowerCase(), decision: result.state,
        evidenceRefs: result.evidenceRefs.map(evidenceId => ({ evidenceId })), inputHash: hash(result) });
      return result;
    });
  }
  maakPilots({ recordAuthorized, derive: deriveClaim, decide, reconcile: reconcileClaim, atomic, now: nu,
    verifyProviderProof: o.verifyProviderProof,
    verifyMoneyOwnerProof: o.verifyMoneyOwnerProof,
    verifyAuthorityOwnerProof: o.verifyAuthorityOwnerProof,
    verifyExternalOwnerProof: o.verifyExternalOwnerProof });
  const publicStore = Object.freeze({ get: store.get, list: store.list,
    counts: store.counts, capacity: store.capacity });
  return Object.freeze({ version: 3, mode: o.mode || 'shadow', record: recordUntrusted,
    derive: deriveClaim, decide, reconcile: reconcileClaim,
    reproduce: resolver.reproduce, profiles, store: publicStore,
    evidence: id => store.get('evidence', id), claim: id => store.get('claims', id),
    snapshot: () => {
      const health = transaction.snapshot();
      const claimDebt = store.list('claims').filter(c =>
        ['UNKNOWN', 'UNVERIFIED', 'SOURCE_ATTESTED', 'DISPUTED'].includes(c.finality) ||
        c.completeness.missing.length || c.completeness.conflicting.length ||
        (c.completeness.evidenceDebt || []).length)
        .map(c => ({ type: 'CLAIM_EVIDENCE_DEBT', claimId: c.claimId,
          subjectRefDigest: hash(c.subjectRef), finality: c.finality,
          missing: c.completeness.missing, conflicting: c.completeness.conflicting,
          sourceRetention: c.completeness.evidenceDebt || [] }));
      const writeDebt = health.incidents.map(i => ({ type: 'SYSTEM_EVIDENCE_DEBT',
        incidentId: i.incidentId, operation: i.operation, code: i.code,
        attemptedWrites: i.attemptedWrites, at: i.at }));
      return bevries({ version: 3, mode: o.mode || 'shadow', counts: store.counts(),
        capacity: store.capacity(), health,
        authorityContracts: authorities.list().map(a => ({ id: a.id, version: a.version,
          digest: a.contractDigest, signer: a.signer })),
        profiles: profiles.list().map(p => ({ id: p.id, version: p.version, digest: p.profileDigest })),
        claimDebt, writeDebt, evidenceDebt: claimDebt.concat(writeDebt) });
    } });
}

module.exports = { maakV3 };
