/* Shadowbewijs van de Experience Broker. Dit bestand observeert uitsluitend;
   een storing in Trust & Evidence mag een al genomen productbesluit nooit
   toestaan, weigeren of een geslaagde domeincommit terugdraaien. */
'use strict';

module.exports = function maakBrokerEvidence({ trustPlane, opslag, crypto }) {
  const beschikbaar = () => trustPlane && typeof trustPlane.observe === 'function';

  function preview(key, p) {
    if (!beschikbaar()) return;
    try {
      trustPlane.observe({ capability: 'experience.propose', boundary: 'actor:' + opslag.actor(key),
        subjectRef: p.objectRef || { domain: 'experience', type: 'preview', id: p.id },
        predicate: 'experience.preview.allowed', value: { intent: p.intent, world: p.world },
        evidence: { intent: p.intent, version: p.version, policyInputHash: p.fingerprint },
        policy: { id: p.policyDecision.policyId, version: p.policyDecision.policyVersion,
          decision: p.policyDecision.decision } });
    } catch (e) { /* shadow evidence mag de bestaande preview niet breken */ }
  }

  function bewijsVoorUitvoering(key, p, objectRef, idemKey) {
    if (!beschikbaar()) return;
    try {
      trustPlane.observe({ capability: 'experience.propose', boundary: 'actor:' + opslag.actor(key),
        subjectRef: objectRef || { domain: 'experience', type: 'preview', id: p.id },
        predicate: 'experience.action.executed', value: { intent: p.intent },
        evidence: { previewId: p.id, inputHash: p.fingerprint, idempotencyKeyHash:
          crypto.createHash('sha256').update(idemKey).digest('hex') },
        policy: { id: p.policyDecision.policyId, version: p.policyDecision.policyVersion,
          decision: p.policyDecision.decision } });
    } catch (e) { /* shadow evidence mag de domeincommit niet terugdraaien */ }
  }

  return Object.freeze({ preview, execute: bewijsVoorUitvoering });
};
