'use strict';

const { hash, id, kopie, bevries } = require('./canon');
const { DECISIONS } = require('./v3-contract');

function maakDecisions(opties) {
  const o = opties || {}, store = o.store, recordEvidence = o.recordEvidence,
    nu = o.nu || (() => new Date().toISOString());
  if (!store || !recordEvidence) throw new Error('bewijsvlak v3: decisions mist afhankelijkheden');

  function decide(input) {
    const i = input || {}, outcome = String(i.outcome || '').toUpperCase();
    if (!DECISIONS.includes(outcome)) throw new Error('bewijsvlak v3: onbekend besluit');
    const claims = [...new Set((i.claimRefs || []).map(String))].sort().map(x => store.get('claims', x));
    if (!claims.length || claims.some(x => !x)) throw new Error('bewijsvlak v3: besluit vereist bestaande claims');
    const consequential = i.consequential !== false;
    if (consequential && claims.some(c => ['UNKNOWN', 'UNVERIFIED', 'DISPUTED'].includes(c.finality)) &&
      ['ALLOW', 'RETRY'].includes(outcome))
      throw new Error('bewijsvlak v3: onzeker bewijs kan geen onomkeerbare actie of blinde retry toestaan');
    const body = { schemaVersion: 3, subjectRef: kopie(i.subjectRef), claimRefs: claims.map(c => c.claimId).sort(),
      policy: { id: String(i.policy && i.policy.id || 'trust-default'),
        version: Number(i.policy && i.policy.version) || 1,
        digest: hash(i.policy || { id: 'trust-default', version: 1 }) },
      action: String(i.action || ''), outcome, reasonCodes: (i.reasonCodes || []).map(String).sort(),
      consequential, decidedAt: String(i.decidedAt || nu()) };
    if (!body.action) throw new Error('bewijsvlak v3: besluitactie ontbreekt');
    body.decisionDigest = hash(body); body.decisionId = id('decision_v3', body);
    const decision = store.put('decisions', body.decisionId, bevries(body));
    const decisionEvidence = recordEvidence({ factType: 'decision.recorded', subjectRef: {
      domain: 'trust', type: 'decision', id: decision.decisionId }, protocol: 'COMMITMENT', truthClass: 'TECHNICAL',
      source: { type: 'rtg-policy-engine', ref: decision.policy.id },
      authority: { id: decision.policy.id, scopes: ['decision.record'], basis: 'policy:' + decision.policy.version,
        validFrom: decision.decidedAt }, observedAt: decision.decidedAt,
      causality: { correlationId: String(i.correlationId || decision.decisionId), causationId: claims[0].claimId },
      operation: { domain: 'trust', capability: 'trust.decision', name: body.action, attempt: 1 },
      value: { decisionId: decision.decisionId, outcome }, purpose: 'decision-audit' });
    return bevries({ decision, decisionEvidence });
  }
  return Object.freeze({ decide });
}

module.exports = { maakDecisions };
