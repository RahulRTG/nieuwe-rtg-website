/* Declarative source-retention contracts. They describe which domain owns a
   re-verifiable source; they are not proof that a source was retained. */
'use strict';

const { hash, kopie, bevries } = require('./canon');

const ROLES = Object.freeze(['EVENT', 'ASSERTION', 'RECEIPT', 'VALUE']);
const RESULTS = Object.freeze(['MATCH', 'MISMATCH', 'EXPIRED', 'UNAVAILABLE']);
const MEDIA = Object.freeze(['DOMAIN_LEDGER', 'PROVIDER_RECEIPT', 'SIGNED_ARCHIVE']);
const IMMUTABILITY = Object.freeze(['CONTENT_ADDRESSED', 'APPEND_ONLY']);
const DEFINITIONS = [
  ['money.domain-source', 'money', 'rtg.payment-truth', ['VALUE']],
  ['money.provider-source', 'money', 'rtg.payment-truth-provider-source', ['EVENT', 'ASSERTION', 'RECEIPT']],
  ['hospitality.domain-source', 'hospitality', 'rtg.reservation-domain', ['VALUE']],
  ['hospitality.provider-source', 'hospitality', 'rtg.reservation-provider-source', ['EVENT', 'ASSERTION', 'RECEIPT']],
  ['external.operational-source', 'external', 'rtg.fulfillment-observer', ['VALUE']],
  ['authority.owner-source', 'authority', 'rtg.consent-kernel', ['VALUE']],
  ['authority.propagation-source', 'authority', 'rtg.connection-runtime', ['VALUE']]
];
const CONTRACTS = Object.freeze(DEFINITIONS.map(([id, ownerDomain, adapterId, roles]) => {
  const body = { id, version: 1, ownerDomain, adapter: { id: adapterId, version: 1 },
    medium: 'DOMAIN_LEDGER', immutability: 'CONTENT_ADDRESSED', roles: [...roles].sort() };
  return bevries({ ...body, contractDigest: hash(body) });
}));
const MAP = new Map(CONTRACTS.map(c => [c.id + '@' + c.version, c]));

function fout(code, message) {
  const error = new Error('bewijsvlak v3 source-retention: ' + message);
  error.code = code;
  return error;
}
function contract(ref) {
  const found = MAP.get(String(ref && ref.id || '') + '@' + Number(ref && ref.version));
  if (!found) throw fout('SOURCE_RETENTION_CONTRACT_UNKNOWN', 'onbekend retentioncontract');
  if (ref && ref.digest && ref.digest !== found.contractDigest)
    throw fout('SOURCE_RETENTION_CONTRACT_MISMATCH', 'retentioncontract-digest wijkt af');
  return found;
}
function contractRef(ref) {
  const found = contract(ref);
  return bevries({ id: found.id, version: found.version, digest: found.contractDigest });
}
function authorityDigest(authority) {
  const a = authority || {};
  return hash({ id: String(a.id || ''), scopes: [...(a.scopes || [])].map(String).sort(),
    basis: String(a.basis || ''), validFrom: String(a.validFrom || ''),
    validUntil: a.validUntil == null ? null : String(a.validUntil) });
}
function ownerAuthorityDigest(value) {
  const found = value && value.contractDigest ? value : contract(value);
  return hash({ ownerDomain: found.ownerDomain, adapter: found.adapter,
    contract: { id: found.id, version: found.version, digest: found.contractDigest } });
}
function roleDigest(evidence, role) {
  const source = evidence && evidence.source || {};
  if (role === 'EVENT') return source.eventRefDigest || null;
  if (role === 'ASSERTION') return source.assertionDigest || null;
  if (role === 'RECEIPT') return source.receiptDigest || null;
  return role === 'VALUE' && evidence && evidence.valueDigest || null;
}
function normaliseerRequirement(input) {
  if (!input) return null;
  const i = kopie(input), roles = [...new Set((i.roles || []).map(x => String(x).toUpperCase()))].sort();
  if (!roles.length || roles.some(role => !ROLES.includes(role)))
    throw fout('SOURCE_RETENTION_REQUIREMENT_INVALID', 'retentionrollen ontbreken');
  const contracts = (i.contracts || []).map(contractRef).sort((a, b) =>
    (a.id + '@' + a.version).localeCompare(b.id + '@' + b.version));
  if (!contracts.length) throw fout('SOURCE_RETENTION_REQUIREMENT_INVALID', 'retentioncontract ontbreekt');
  for (const role of roles) if (!contracts.some(ref => contract(ref).roles.includes(role)))
    throw fout('SOURCE_RETENTION_REQUIREMENT_INVALID', 'geen contract dekt rol ' + role);
  const max = i.maxVerificationAgeMs == null ? null : Number(i.maxVerificationAgeMs);
  if (max != null && (!Number.isSafeInteger(max) || max < 0))
    throw fout('SOURCE_RETENTION_REQUIREMENT_INVALID', 'maxVerificationAgeMs is ongeldig');
  return bevries({ critical: i.critical !== false, roles, contracts, maxVerificationAgeMs: max });
}

module.exports = { ROLES, RESULTS, MEDIA, IMMUTABILITY, CONTRACTS, fout,
  contract, contractRef, authorityDigest, ownerAuthorityDigest, roleDigest, normaliseerRequirement };
