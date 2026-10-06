'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hash } = require('../server/kern/bewijsvlak/canon');
const contract = require('../server/kern/bewijsvlak/v3-contract');
const retention = require('../server/kern/bewijsvlak/v3-source-retention');
const { normaliseer: normaliseerProfiel } = require('../server/kern/bewijsvlak/v3-profiles');
const { maakRegister: maakAuthorities } = require('../server/kern/bewijsvlak/v3-authorities');
const { maakResolver } = require('../server/kern/bewijsvlak/v3-resolver');

const at = '2026-10-01T12:00:00.000Z';
const later = '2026-10-01T13:00:00.000Z';
const digest = value => hash(value);
const authority = { id: 'rtg:payment', scopes: ['payment.ledger'], basis: 'domain-ownership', validFrom: at };

function draft(options) {
  const o = options || {}, valueDigest = o.valueDigest || digest({ cents: 1000 });
  return retention.maakDraft({ contractRef: { id: o.contract || 'money.domain-source', version: 1 },
    locatorDigest: digest(o.locator || 'private-domain-locator'),
    retentionReceiptDigest: digest(o.receipt || 'immutable-domain-receipt'),
    retainedFrom: at, retainedUntil: o.retainedUntil || null, verifiedAt: o.verifiedAt || at,
    available: o.available, digests: o.digests || { VALUE: valueDigest },
    observedDigests: o.observedDigests });
}

function evidence(options) {
  const o = options || {}, valueDigest = o.valueDigest || digest({ cents: 1000 });
  return contract.evidence({ factType: 'payment.ledger.posted',
    subjectRef: { domain: 'money', type: 'payment', id: 'PAY-RETENTION' },
    protocol: 'COMMITMENT', truthClass: 'DOMAIN',
    source: { type: 'rtg-payment-truth', ref: 'betaalwaarheid',
      eventRefDigest: o.eventRefDigest, assertionDigest: o.assertionDigest,
      receiptDigest: o.receiptDigest }, authority: o.authority || authority,
    observedAt: at, effectiveFrom: at, causality: { correlationId: 'chain-retention' },
    operation: { domain: 'money', capability: 'payment.authorize',
      name: 'payment.ledger.posted', attempt: 1 }, valueDigest,
    sourceRetention: o.sourceRetention === undefined ? draft({ valueDigest }) : o.sourceRetention
  }, () => at);
}

function requirement(extra) {
  return { retention: retention.normaliseerRequirement({ critical: true, roles: ['VALUE'],
    contracts: [{ id: 'money.domain-source', version: 1 }], ...(extra || {}) }) };
}

test('source-retention bewaart uitsluitend versiegebonden digests en een actuele MATCH', () => {
  const record = evidence(), text = JSON.stringify(record.sourceRetention);
  assert.doesNotMatch(text, /private-domain-locator|PAY-RETENTION|https?:|\/tmp\//i);
  assert.equal(record.sourceRetention.schemaVersion, 1);
  assert.equal(record.sourceRetention.bindings[0].verification.result, 'MATCH');
  const result = retention.inspect(record, requirement(), at);
  assert.equal(result.ok, true);
  assert.deepEqual(result.debt, []);
  assert.match(record.sourceRetention.attestationDigest, /^[a-f0-9]{64}$/);
});

test('ontbrekende, onbeschikbare en verlopen broninhoud blijven expliciete evidence debt', () => {
  const missing = retention.inspect(evidence({ sourceRetention: null }), requirement(), at);
  assert.equal(missing.ok, false);
  assert.equal(missing.debt[0].status, 'MISSING');

  const unavailable = retention.inspect(evidence({ sourceRetention: draft({ available: false }) }),
    requirement(), at);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.debt[0].status, 'UNAVAILABLE');

  const expired = retention.inspect(evidence({ sourceRetention: draft({
    retainedUntil: '2026-10-01T12:30:00.000Z' }) }), requirement(), later);
  assert.equal(expired.ok, false);
  assert.equal(expired.debt[0].status, 'EXPIRED');
});

test('content-, attestation- en authority-tamper worden MISMATCH en nooit MATCH', () => {
  const original = evidence(), changed = JSON.parse(JSON.stringify(original));
  changed.sourceRetention.bindings[0].contentDigest = digest('other-content');
  let result = retention.inspect(changed, requirement(), at);
  assert.equal(result.ok, false);
  assert.equal(result.debt[0].status, 'MISMATCH');
  assert.ok(result.debt[0].reasonCodes.includes('CONTENT_MISMATCH'));

  const otherAuthority = JSON.parse(JSON.stringify(original));
  otherAuthority.sourceRetention.bindings[0].owner.authorityRefDigest = digest('other-authority');
  result = retention.inspect(otherAuthority, requirement(), at);
  assert.equal(result.ok, false);
  assert.ok(result.debt[0].reasonCodes.includes('AUTHORITY_MISMATCH'));
});

test('runtime-export kan niet als domain source-retentioncontract worden opgevoerd', () => {
  assert.throws(() => retention.maakDraft({ contractRef: { id: 'runtime-evidence-export', version: 1 },
    locatorDigest: digest('x'), retentionReceiptDigest: digest('y'), retainedFrom: at,
    digests: { VALUE: digest('z') } }), error => error.code === 'SOURCE_RETENTION_CONTRACT_UNKNOWN');
});

function resolverSetup(record) {
  const authorityContracts = maakAuthorities();
  const profile = normaliseerProfiel({ id: 'test.retention', version: 1,
    claimType: 'test.retained', requirements: [{ id: 'retained-value',
      factType: 'payment.ledger.posted', truthClass: 'DOMAIN', scope: 'payment.ledger', min: 1,
      authorityContract: { id: 'money.domain', version: 1 },
      retention: { critical: true, roles: ['VALUE'],
        contracts: [{ id: 'money.domain-source', version: 1 }] } }],
    completeFinality: 'RECONCILED', corrections: [] }, authorityContracts);
  const boxes = { evidence: new Map([[record.evidenceId, record]]), claims: new Map() };
  const store = { get(type, id) { return boxes[type].get(id) || null; },
    list(type) { return [...boxes[type].values()]; },
    put(type, id, value) { boxes[type].set(id, value); return value; } };
  const profiles = { get(id, version) { return id === profile.id && version === profile.version ? profile : null; } };
  const authorities = { verifyStored() { return true; } };
  return { resolver: maakResolver({ store, profiles, authorities, nu: () => at }), boxes, profile };
}

test('claim is reproduceerbaar en ontbrekende retention forceert UNKNOWN met debt', () => {
  const record = evidence(), setup = resolverSetup(record);
  const claim = setup.resolver.derive({ profileId: setup.profile.id, profileVersion: 1,
    subjectRef: record.subjectRef, evidenceRefs: [record.evidenceId], effectiveAt: at, derivedAt: at });
  assert.equal(claim.finality, 'RECONCILED');
  assert.equal(setup.resolver.reproduce(claim.claimId).ok, true);

  const absent = evidence({ sourceRetention: null }), second = resolverSetup(absent);
  const unknown = second.resolver.derive({ profileId: second.profile.id, profileVersion: 1,
    subjectRef: absent.subjectRef, evidenceRefs: [absent.evidenceId], effectiveAt: at, derivedAt: at });
  assert.equal(unknown.finality, 'UNKNOWN');
  assert.equal(unknown.completeness.evidenceDebt[0].status, 'MISSING');
  assert.equal(second.resolver.reproduce(unknown.claimId).ok, true);
});

test('na opgeslagen tamper kan een historische claim niet opnieuw worden bewezen', () => {
  const record = evidence(), setup = resolverSetup(record);
  const claim = setup.resolver.derive({ profileId: setup.profile.id, profileVersion: 1,
    subjectRef: record.subjectRef, evidenceRefs: [record.evidenceId], effectiveAt: at, derivedAt: at });
  const changed = JSON.parse(JSON.stringify(record));
  changed.sourceRetention.bindings[0].locatorDigest = digest('replaced-locator');
  setup.boxes.evidence.set(record.evidenceId, changed);
  const reproduced = setup.resolver.reproduce(claim.claimId);
  assert.equal(reproduced.ok, false);
  assert.equal(reproduced.finality, 'DISPUTED');
});
