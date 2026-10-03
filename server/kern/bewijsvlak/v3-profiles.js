'use strict';

const { hash, kopie, bevries } = require('./canon');
const { normaliseerRequirement: retentionRequirement } = require('./v3-source-retention');

const retentie = (id, roles) => Object.freeze({ critical: true, roles,
  contracts: [{ id, version: 1 }] });

const BUILTIN = Object.freeze([
  { id: 'money.settlement', version: 3, claimType: 'payment.settled',
    requirements: [
      { id: 'domain-posting', factType: 'payment.ledger.posted', truthClass: 'DOMAIN', scope: 'payment.ledger', min: 1,
        authorityContract: { id: 'money.domain', version: 1 },
        retention: retentie('money.domain-source', ['VALUE']) },
      { id: 'provider-settlement', factType: 'payment.provider.settled', truthClass: 'EXTERNAL', scope: 'payment.settlement', min: 1,
        authorityContract: { id: 'money.provider', version: 1 },
        retention: retentie('money.provider-source', ['EVENT', 'ASSERTION', 'RECEIPT']) },
      { id: 'reconciliation-match', factType: 'payment.reconciliation.matched', truthClass: 'DOMAIN', scope: 'payment.reconcile', min: 1,
        authorityContract: { id: 'money.domain', version: 1 },
        retention: retentie('money.domain-source', ['VALUE']) }
    ], completeFinality: 'RECONCILED', corrections: [
      { factType: 'payment.reversed', truthClass: 'EXTERNAL', scope: 'payment.settlement',
        authorityContract: { id: 'money.provider', version: 1 },
        retention: retentie('money.provider-source', ['EVENT', 'ASSERTION', 'RECEIPT']) },
      { factType: 'payment.disputed', truthClass: 'EXTERNAL', scope: 'payment.settlement',
        authorityContract: { id: 'money.provider', version: 1 },
        retention: retentie('money.provider-source', ['EVENT', 'ASSERTION', 'RECEIPT']) }
    ] },
  { id: 'external.fulfillment', version: 3, claimType: 'external.fulfilled',
    requirements: [
      { id: 'domain-commitment', factType: 'external.commitment.recorded', truthClass: 'DOMAIN', scope: 'external.commitment', min: 1,
        authorityContract: { id: 'external.domain', version: 1 },
        retention: retentie('hospitality.domain-source', ['VALUE']) },
      { id: 'provider-confirmation', factType: 'external.provider.confirmed', truthClass: 'EXTERNAL', scope: 'external.confirmation', min: 1,
        authorityContract: { id: 'external.provider', version: 1 },
        retention: retentie('hospitality.provider-source', ['EVENT', 'ASSERTION', 'RECEIPT']) },
      { id: 'operational-outcome', factType: 'external.outcome.observed', truthClass: 'OPERATIONAL', scope: 'external.outcome', min: 1,
        authorityContract: { id: 'external.operational', version: 1 },
        retention: retentie('external.operational-source', ['VALUE']) }
    ], completeFinality: 'CROSS_VERIFIED', corrections: [
      { factType: 'external.cancelled', truthClass: 'EXTERNAL', scope: 'external.correction',
        authorityContract: { id: 'external.provider', version: 1 },
        retention: retentie('hospitality.provider-source', ['EVENT', 'ASSERTION', 'RECEIPT']) },
      { factType: 'external.disputed', truthClass: 'DOMAIN', scope: 'external.correction',
        authorityContract: { id: 'external.domain', version: 1 },
        retention: retentie('hospitality.domain-source', ['VALUE']) }
    ] },
  { id: 'authority.revocation', version: 3, claimType: 'authority.revoked',
    requirements: [
      { id: 'revocation', factType: 'authority.revoked', truthClass: 'DOMAIN', scope: 'authority.revoke', min: 1,
        authorityContract: { id: 'authority.owner', version: 1 },
        retention: retentie('authority.owner-source', ['VALUE']) },
      { id: 'propagation', factType: 'authority.revocation.propagated', truthClass: 'TECHNICAL', scope: 'authority.propagate', min: 1,
        authorityContract: { id: 'authority.propagation', version: 1 },
        retention: retentie('authority.propagation-source', ['VALUE']) }
    ], completeFinality: 'CROSS_VERIFIED', corrections: [] }
]);

function contractRef(input, authorities) {
  const r = input || {}, id = String(r.id || ''), version = Number(r.version);
  const contract = authorities && authorities.get(id, version);
  if (!contract) throw new Error('bewijsvlak v3: onbekend authority/source-contract ' + id + '@' + version);
  return { id, version, digest: contract.contractDigest };
}

function normaliseer(input, authorities) {
  const p = kopie(input || {});
  if (!p.id || !Number.isInteger(p.version) || !p.claimType || !Array.isArray(p.requirements) || !p.requirements.length)
    throw new Error('bewijsvlak v3: ongeldig requirement-profiel');
  p.requirements = p.requirements.map(r => ({ id: String(r.id), factType: String(r.factType),
    truthClass: String(r.truthClass), scope: String(r.scope), min: Math.max(1, Number(r.min) || 1),
    maxAgeMs: r.maxAgeMs == null ? null : Math.max(0, Number(r.maxAgeMs)),
    authorityContract: contractRef(r.authorityContract, authorities),
    retention: retentionRequirement(r.retention) }));
  p.corrections = (p.corrections || []).map(r => ({ factType: String(r.factType),
    truthClass: String(r.truthClass), scope: String(r.scope),
    authorityContract: contractRef(r.authorityContract, authorities),
    retention: retentionRequirement(r.retention) }))
    .sort((a, b) => a.factType.localeCompare(b.factType));
  p.correctionFacts = p.corrections.map(r => r.factType);
  p.completeFinality = String(p.completeFinality || 'CROSS_VERIFIED');
  p.resolver = p.resolver || { id: 'rtg.requirements', version: 3 };
  p.resolver.artifactDigest = p.resolver.artifactDigest || hash({ id: p.resolver.id, version: p.resolver.version,
    algorithm: 'authorized-source-retention-requirements-v3' });
  p.profileDigest = hash({ ...p, profileDigest: undefined });
  return bevries(p);
}

function maakRegister(extra, authorities) {
  const map = new Map();
  for (const p of [...BUILTIN, ...(extra || [])]) {
    const vast = normaliseer(p, authorities), key = vast.id + '@' + vast.version;
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
