'use strict';

const { hash, kopie, bevries } = require('./canon');
const sourceRetention = require('./v3-source-retention');

const PROTOCOL = Object.freeze(['INTENT', 'AUTHORITY', 'COMMITMENT', 'EXECUTION',
  'CONFIRMATION', 'SETTLEMENT', 'OUTCOME']);
const TRUTH = Object.freeze(['TECHNICAL', 'DOMAIN', 'EXTERNAL', 'OPERATIONAL']);
const FINALITY = Object.freeze(['UNKNOWN', 'UNVERIFIED', 'SOURCE_ATTESTED',
  'CROSS_VERIFIED', 'RECONCILED', 'DISPUTED', 'REVERSED', 'CANCELLED']);
const DECISIONS = Object.freeze(['ALLOW', 'DENY', 'WAIT', 'DO_NOT_RETRY',
  'RECONCILE', 'ESCALATE', 'RETRY']);

function tekst(v, naam, patroon) {
  const s = String(v || '').trim();
  if (!s || (patroon && !patroon.test(s))) throw new Error('bewijsvlak v3: ongeldige ' + naam);
  return s;
}
function tijd(v, naam) {
  const s = tekst(v, naam);
  if (!Number.isFinite(Date.parse(s))) throw new Error('bewijsvlak v3: ongeldige tijd voor ' + naam);
  return s;
}
function lijst(v) { return [...new Set((Array.isArray(v) ? v : []).map(String).filter(Boolean))].sort(); }
function ref(v, naam) {
  const r = v && typeof v === 'object' ? v : {};
  return bevries({ domain: tekst(r.domain, naam + '.domain', /^[a-z0-9._-]{1,80}$/i),
    type: tekst(r.type, naam + '.type', /^[a-z0-9._-]{1,80}$/i),
    id: tekst(r.id, naam + '.id', /^[a-z0-9:._-]{1,180}$/i) });
}
function digestOf(v, naam) {
  if (v == null) return null;
  return tekst(v, naam, /^[a-f0-9]{64}$/);
}

function sluit(body) {
  const uit = kopie(body || {});
  delete uit.recordDigest; delete uit.evidenceId;
  uit.recordDigest = hash(uit);
  uit.evidenceId = 'evidence_v3_' + uit.recordDigest.slice(0, 32);
  return bevries(uit);
}

function evidence(input, nu) {
  const i = kopie(input || {}), at = typeof nu === 'function' ? nu() : new Date().toISOString();
  const protocol = tekst(i.protocol, 'protocol').toUpperCase();
  const truthClass = tekst(i.truthClass, 'truthClass').toUpperCase();
  if (!PROTOCOL.includes(protocol)) throw new Error('bewijsvlak v3: onbekende protocolstap');
  if (!TRUTH.includes(truthClass)) throw new Error('bewijsvlak v3: onbekende waarheidsklasse');
  const observedAt = tijd(i.observedAt || at, 'observedAt');
  const receivedAt = tijd(i.receivedAt || at, 'receivedAt');
  const source = i.source || {}, authority = i.authority || {}, causality = i.causality || {};
  const body = {
    schemaVersion: 3, factType: tekst(i.factType, 'factType', /^[a-z0-9._-]{3,160}$/i),
    subjectRef: ref(i.subjectRef, 'subjectRef'), protocol, truthClass,
    source: { type: tekst(source.type, 'source.type', /^[a-z0-9._-]{2,80}$/i),
      ref: tekst(source.ref, 'source.ref', /^[a-z0-9:._-]{2,180}$/i),
      eventRefDigest: digestOf(source.eventRefDigest, 'source.eventRefDigest'),
      assertionDigest: digestOf(source.assertionDigest, 'source.assertionDigest'),
      receiptDigest: digestOf(source.receiptDigest, 'source.receiptDigest') },
    authority: { id: tekst(authority.id, 'authority.id', /^[a-z0-9:._-]{2,180}$/i),
      scopes: lijst(authority.scopes), basis: tekst(authority.basis, 'authority.basis', /^[a-z0-9:._-]{2,180}$/i),
      validFrom: tijd(authority.validFrom || observedAt, 'authority.validFrom'),
      validUntil: authority.validUntil ? tijd(authority.validUntil, 'authority.validUntil') : null },
    observedAt, receivedAt,
    effectiveFrom: tijd(i.effectiveFrom || observedAt, 'effectiveFrom'),
    effectiveUntil: i.effectiveUntil ? tijd(i.effectiveUntil, 'effectiveUntil') : null,
    causality: { correlationId: tekst(causality.correlationId, 'causality.correlationId', /^[a-z0-9:._-]{2,180}$/i),
      causationId: causality.causationId ? tekst(causality.causationId, 'causality.causationId') : null,
      parentEvidenceId: causality.parentEvidenceId ? tekst(causality.parentEvidenceId, 'causality.parentEvidenceId') : null },
    operation: { domain: tekst(i.operation && i.operation.domain, 'operation.domain'),
      capability: tekst(i.operation && i.operation.capability, 'operation.capability'),
      name: tekst(i.operation && i.operation.name, 'operation.name'),
      attempt: Math.max(1, Number(i.operation && i.operation.attempt) || 1),
      provider: i.operation && i.operation.provider ? String(i.operation.provider) : null },
    transition: i.transition ? { from: i.transition.from == null ? null : String(i.transition.from),
      to: i.transition.to == null ? null : String(i.transition.to) } : null,
    valueDigest: tekst(i.valueDigest || hash(i.value == null ? null : i.value), 'valueDigest', /^[a-f0-9]{64}$/),
    classification: String(i.classification || 'intern'), purpose: String(i.purpose || 'trust-evidence')
  };
  body.sourceRetention = sourceRetention.normaliseer(i.sourceRetention, body.authority);
  return sluit(body);
}

function bindAuthority(record, authorityContract) {
  const body = kopie(record || {});
  delete body.recordDigest; delete body.evidenceId;
  if (!authorityContract || typeof authorityContract !== 'object')
    throw new Error('bewijsvlak v3: authority/source-attestatie ontbreekt');
  body.authorityContract = kopie(authorityContract);
  return sluit(body);
}

module.exports = { PROTOCOL, TRUTH, FINALITY, DECISIONS, evidence, bindAuthority, ref, lijst, tijd };
