'use strict';

const context = require('./context');
const contract = require('./contract');
const { id, hash, kopie } = require('./canon');

function maakClaims({ ledger, issuer }) {
  if (!ledger) throw new Error('bewijsvlak claims: ledger ontbreekt');

  function maak(invoer) {
    const i = invoer || {}, ctx = i.context || context.huidige() || context.maak({ phase: i.phase });
    const inhoud = {
      issuer: i.issuer || issuer || 'rtg:unknown', predicate: i.predicate,
      subjectRef: kopie(i.subjectRef), phase: i.phase,
      state: i.state || 'PROPOSED', scope: i.scope || null,
      validFrom: i.validFrom || null, expiresAt: i.expiresAt || null,
      valueDigest: i.value === undefined ? null : hash(i.value),
      chain: { chainId: ctx.chainId, stepId: ctx.stepId, causedBy: ctx.causedBy },
      contract: kopie(i.contract), policy: kopie(i.policy),
      evidenceRefs: (i.evidenceRefs || []).map(kopie)
    };
    const claimId = id('claim', inhoud);
    const c = contract.claim({ claimId, ...inhoud });
    const record = ledger.append({ boundary: i.boundary || 'platform', chainId: ctx.chainId,
      stepId: ctx.stepId, claimId, generationId: i.generationId || null,
      kind: 'claim.' + c.state.toLowerCase(), decision: c.state,
      reasonCodes: i.reasonCodes || [], evidenceRefs: c.evidenceRefs,
      contractRef: c.contract, policyRef: c.policy, inputHash: c.valueDigest });
    return { claim: c, record };
  }

  function verander(eerdere, state, invoer) {
    if (!eerdere || !eerdere.claimId) throw new Error('bewijsvlak claims: eerdere claim ontbreekt');
    return maak(Object.assign({}, eerdere, invoer || {}, {
      state, predicate: eerdere.predicate,
      subjectRef: eerdere.subjectRef,
      phase: eerdere.phase,
      contract: eerdere.contract,
      policy: eerdere.policy,
      evidenceRefs: (invoer && invoer.evidenceRefs) || eerdere.evidenceRefs,
      reasonCodes: ['SUPERSEDES:' + eerdere.claimId].concat((invoer && invoer.reasonCodes) || [])
    }));
  }

  return Object.freeze({ maak, prove: (c, i) => verander(c, 'PROVEN', i),
    reject: (c, i) => verander(c, 'REJECTED', i),
    revoke: (c, i) => verander(c, 'REVOKED', i),
    expire: (c, i) => verander(c, 'EXPIRED', i) });
}

module.exports = { maakClaims };
