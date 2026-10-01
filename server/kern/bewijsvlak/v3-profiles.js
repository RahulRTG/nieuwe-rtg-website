'use strict';

const { hash, kopie, bevries } = require('./canon');

const BUILTIN = Object.freeze([
  { id: 'money.settlement', version: 3, claimType: 'payment.settled',
    requirements: [
      { id: 'domain-posting', factType: 'payment.ledger.posted', truthClass: 'DOMAIN', scope: 'payment.ledger', min: 1 },
      { id: 'provider-settlement', factType: 'payment.provider.settled', truthClass: 'EXTERNAL', scope: 'payment.settlement', min: 1 },
      { id: 'reconciliation-match', factType: 'payment.reconciliation.matched', truthClass: 'DOMAIN', scope: 'payment.reconcile', min: 1 }
    ], completeFinality: 'RECONCILED', correctionFacts: ['payment.reversed', 'payment.disputed'] },
  { id: 'external.fulfillment', version: 3, claimType: 'external.fulfilled',
    requirements: [
      { id: 'domain-commitment', factType: 'external.commitment.recorded', truthClass: 'DOMAIN', scope: 'external.commitment', min: 1 },
      { id: 'provider-confirmation', factType: 'external.provider.confirmed', truthClass: 'EXTERNAL', scope: 'external.confirmation', min: 1 },
      { id: 'operational-outcome', factType: 'external.outcome.observed', truthClass: 'OPERATIONAL', scope: 'external.outcome', min: 1 }
    ], completeFinality: 'CROSS_VERIFIED', correctionFacts: ['external.cancelled', 'external.disputed'] },
  { id: 'authority.revocation', version: 3, claimType: 'authority.revoked',
    requirements: [
      { id: 'revocation', factType: 'authority.revoked', truthClass: 'DOMAIN', scope: 'authority.revoke', min: 1 },
      { id: 'propagation', factType: 'authority.revocation.propagated', truthClass: 'TECHNICAL', scope: 'authority.propagate', min: 1 }
    ], completeFinality: 'CROSS_VERIFIED', correctionFacts: [] }
]);

function normaliseer(input) {
  const p = kopie(input || {});
  if (!p.id || !Number.isInteger(p.version) || !p.claimType || !Array.isArray(p.requirements) || !p.requirements.length)
    throw new Error('bewijsvlak v3: ongeldig requirement-profiel');
  p.requirements = p.requirements.map(r => ({ id: String(r.id), factType: String(r.factType),
    truthClass: String(r.truthClass), scope: String(r.scope), min: Math.max(1, Number(r.min) || 1),
    maxAgeMs: r.maxAgeMs == null ? null : Math.max(0, Number(r.maxAgeMs)) }));
  p.correctionFacts = (p.correctionFacts || []).map(String).sort();
  p.completeFinality = String(p.completeFinality || 'CROSS_VERIFIED');
  p.resolver = p.resolver || { id: 'rtg.requirements', version: 3 };
  p.resolver.artifactDigest = p.resolver.artifactDigest || hash({ id: p.resolver.id, version: p.resolver.version,
    algorithm: 'authorized-temporal-requirements-v1' });
  p.profileDigest = hash({ ...p, profileDigest: undefined });
  return bevries(p);
}

function maakRegister(extra) {
  const map = new Map();
  for (const p of [...BUILTIN, ...(extra || [])]) {
    const vast = normaliseer(p), key = vast.id + '@' + vast.version;
    if (map.has(key) && map.get(key).profileDigest !== vast.profileDigest)
      throw new Error('bewijsvlak v3: profielversie heeft conflicterende inhoud');
    map.set(key, vast);
  }
  return Object.freeze({
    get(id, version) { return map.get(String(id) + '@' + Number(version)) || null; },
    list() { return [...map.values()].map(kopie); }
  });
}

module.exports = { BUILTIN, normaliseer, maakRegister };
